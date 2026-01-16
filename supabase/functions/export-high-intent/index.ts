import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HighIntentUser {
  id: string;
  primary_email: string;
  phone: string | null;
  computed: {
    intent_score?: number;
    drop_off_stage?: string;
    top_category?: string;
    lifetime_value?: number;
    orders_count?: number;
    product_views_7d?: number;
    atc_7d?: number;
  };
  traits: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
}

interface KlaviyoProfile {
  type: "profile";
  attributes: {
    email: string;
    external_id: string;
    phone_number?: string;
    properties: Record<string, unknown>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { workspace_id, min_intent_score = 30, limit = 100 } = body;

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get enabled Klaviyo destination for workspace
    const { data: destination, error: destError } = await supabase
      .from("destinations")
      .select("id, config")
      .eq("workspace_id", workspace_id)
      .eq("type", "klaviyo")
      .eq("enabled", true)
      .single();

    if (destError || !destination) {
      return new Response(
        JSON.stringify({ error: "No active Klaviyo destination found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const klaviyoApiKey = (destination.config as { api_key?: string })?.api_key;
    if (!klaviyoApiKey) {
      return new Response(
        JSON.stringify({ error: "Klaviyo API key not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch high intent users
    const { data: users, error: usersError } = await supabase
      .from("users_unified")
      .select("id, primary_email, phone, computed, traits, first_seen_at, last_seen_at")
      .eq("workspace_id", workspace_id)
      .not("primary_email", "is", null)
      .gte("computed->intent_score", min_intent_score)
      .order("computed->intent_score", { ascending: false })
      .limit(limit);

    if (usersError) {
      throw usersError;
    }

    const highIntentUsers = (users || []).filter((u) => {
      const ordersCount = (u.computed as HighIntentUser["computed"])?.orders_count || 0;
      return ordersCount === 0; // Only users who haven't purchased
    }) as HighIntentUser[];

    if (highIntentUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, exported: 0, message: "No high intent users to export" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Klaviyo profiles
    const profiles: KlaviyoProfile[] = highIntentUsers.map((user) => ({
      type: "profile",
      attributes: {
        email: user.primary_email,
        external_id: user.id,
        phone_number: user.phone || undefined,
        properties: {
          // SignalFlow properties (prefixed with sf_)
          sf_intent_score: user.computed?.intent_score || 0,
          sf_drop_off_stage: user.computed?.drop_off_stage || "browsing",
          sf_top_category: user.computed?.top_category || null,
          sf_lifetime_value: user.computed?.lifetime_value || 0,
          sf_orders_count: user.computed?.orders_count || 0,
          sf_product_views_7d: user.computed?.product_views_7d || 0,
          sf_atc_7d: user.computed?.atc_7d || 0,
          sf_first_seen_at: user.first_seen_at,
          sf_last_seen_at: user.last_seen_at,
          sf_high_intent_export_at: new Date().toISOString(),
          // Traits from identify calls
          ...Object.fromEntries(
            Object.entries(user.traits || {}).map(([k, v]) => [`sf_trait_${k}`, v])
          ),
        },
      },
    }));

    // Batch upsert to Klaviyo (max 100 per request)
    const results = {
      exported: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Klaviyo Profile Bulk Import API
    const batchSize = 100;
    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      
      try {
        const response = await fetch("https://a.klaviyo.com/api/profile-bulk-import-jobs/", {
          method: "POST",
          headers: {
            "Authorization": `Klaviyo-API-Key ${klaviyoApiKey}`,
            "Content-Type": "application/json",
            "revision": "2024-02-15",
          },
          body: JSON.stringify({
            data: {
              type: "profile-bulk-import-job",
              attributes: {
                profiles: {
                  data: batch,
                },
              },
            },
          }),
        });

        if (response.ok) {
          results.exported += batch.length;
        } else {
          const errorText = await response.text();
          results.failed += batch.length;
          results.errors.push(`Batch ${i / batchSize + 1}: ${response.status} - ${errorText}`);
        }
      } catch (err) {
        results.failed += batch.length;
        results.errors.push(`Batch ${i / batchSize + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Log the export action
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.account_id) {
      await supabase.from("audit_logs").insert({
        account_id: profile.account_id,
        workspace_id,
        user_id: user.id,
        action: "export_high_intent",
        resource_type: "klaviyo",
        resource_id: destination.id,
        details: {
          exported: results.exported,
          failed: results.failed,
          min_intent_score,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        exported: results.exported,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Export high intent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
