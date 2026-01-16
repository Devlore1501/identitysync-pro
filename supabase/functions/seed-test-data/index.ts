/**
 * Seed Test Data
 * 
 * Creates fake users with varied intent scores and drop-off stages
 * for testing the High Intent Users widget.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_USERS = [
  { email: "high-intent-checkout@test.com", intentScore: 85, dropOffStage: "checkout", productViews: 12, atc: 3 },
  { email: "high-intent-cart@test.com", intentScore: 65, dropOffStage: "cart", productViews: 8, atc: 2 },
  { email: "medium-intent@test.com", intentScore: 45, dropOffStage: "engaged", productViews: 6, atc: 1 },
  { email: "engaged-browser@test.com", intentScore: 25, dropOffStage: "engaged", productViews: 4, atc: 0 },
  { email: "low-intent@test.com", intentScore: 10, dropOffStage: "browsing", productViews: 2, atc: 0 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get workspace from request
    const { workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      usersCreated: 0,
      eventsCreated: 0,
      errors: [] as string[],
    };

    const now = new Date();

    for (const testUser of TEST_USERS) {
      try {
        // Check if user already exists
        const { data: existing } = await supabase
          .from("users_unified")
          .select("id")
          .eq("workspace_id", workspace_id)
          .eq("primary_email", testUser.email)
          .single();

        let userId: string;

        if (existing) {
          userId = existing.id;
          // Update existing user
          await supabase
            .from("users_unified")
            .update({
              computed: {
                intent_score: testUser.intentScore,
                drop_off_stage: testUser.dropOffStage,
                product_views_7d: testUser.productViews,
                atc_7d: testUser.atc,
                orders_count: 0,
                lifetime_value: 0,
                email_opens_30d: Math.floor(Math.random() * 10),
                email_clicks_30d: Math.floor(Math.random() * 5),
                email_engagement_score: Math.floor(Math.random() * 50),
                computed_at: now.toISOString(),
              },
              last_seen_at: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", userId);
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabase
            .from("users_unified")
            .insert({
              workspace_id,
              primary_email: testUser.email,
              emails: [testUser.email],
              anonymous_ids: [`anon_${Math.random().toString(36).substr(2, 9)}`],
              customer_ids: [],
              traits: { source: "seed_test_data" },
              computed: {
                intent_score: testUser.intentScore,
                drop_off_stage: testUser.dropOffStage,
                product_views_7d: testUser.productViews,
                atc_7d: testUser.atc,
                orders_count: 0,
                lifetime_value: 0,
                email_opens_30d: Math.floor(Math.random() * 10),
                email_clicks_30d: Math.floor(Math.random() * 5),
                email_engagement_score: Math.floor(Math.random() * 50),
                computed_at: now.toISOString(),
              },
              first_seen_at: new Date(now.getTime() - 7 * 24 * 3600000).toISOString(),
              last_seen_at: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
            })
            .select("id")
            .single();

          if (createError) {
            results.errors.push(`User ${testUser.email}: ${createError.message}`);
            continue;
          }
          userId = newUser!.id;
          results.usersCreated++;
        }

        // Create some test events
        const eventTypes = [
          { type: "page", name: "Page View" },
          { type: "product", name: "Product Viewed" },
        ];

        if (testUser.atc > 0) {
          eventTypes.push({ type: "cart", name: "Product Added" });
        }
        if (testUser.dropOffStage === "checkout") {
          eventTypes.push({ type: "checkout", name: "Checkout Started" });
        }

        for (const eventType of eventTypes) {
          await supabase.from("events").insert({
            workspace_id,
            unified_user_id: userId,
            event_type: eventType.type,
            event_name: eventType.name,
            properties: {
              product_id: `prod_${Math.random().toString(36).substr(2, 6)}`,
              product_name: "Test Product",
              price: Math.floor(Math.random() * 100) + 10,
              category: ["Electronics", "Clothing", "Home"][Math.floor(Math.random() * 3)],
            },
            context: { source: "seed_test_data" },
            source: "seed_test_data",
            event_time: new Date(now.getTime() - Math.random() * 86400000).toISOString(),
            status: "processed",
          });
          results.eventsCreated++;
        }
      } catch (userError) {
        results.errors.push(`User ${testUser.email}: ${userError instanceof Error ? userError.message : String(userError)}`);
      }
    }

    console.log("[seed-test-data] Results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[seed-test-data] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
