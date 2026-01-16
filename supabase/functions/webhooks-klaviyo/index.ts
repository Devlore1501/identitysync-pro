/**
 * Klaviyo Webhooks Handler
 * 
 * Receives webhooks from Klaviyo for bi-directional sync:
 * - Email opens, clicks, bounces
 * - Subscription events
 * - Form submissions
 * 
 * Updates user behavioral signals and re-syncs enriched profiles back to Klaviyo.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, klaviyo-signature, klaviyo-webhook-id",
};

// Event type to intent score mapping
const EVENT_SCORES: Record<string, number> = {
  'Opened Email': 3,
  'Clicked Email': 5,
  'Received Email': 0,
  'Subscribed to List': 2,
  'Unsubscribed': 0,
  'Bounced Email': 0,
  'Marked Email as Spam': 0,
  'Dropped Email': 0,
  'Subscribed to Back in Stock': 3,
  'Clicked SMS': 4,
  'Received SMS': 0,
};

// Events that indicate positive engagement
const ENGAGEMENT_EVENTS = new Set([
  'Opened Email',
  'Clicked Email',
  'Subscribed to List',
  'Clicked SMS',
  'Subscribed to Back in Stock',
]);

interface KlaviyoWebhookEvent {
  type: string;
  id: string;
  attributes: {
    metric_id: string;
    profile_id: string;
    timestamp: string;
    event_properties: Record<string, unknown>;
    profile: {
      email?: string;
      phone_number?: string;
      external_id?: string;
      properties?: Record<string, unknown>;
    };
  };
}

interface KlaviyoWebhookPayload {
  data: KlaviyoWebhookEvent | KlaviyoWebhookEvent[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get workspace from query param or header
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing workspace_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify workspace exists and get Klaviyo config
    const { data: destination, error: destError } = await supabase
      .from("destinations")
      .select("id, config")
      .eq("workspace_id", workspaceId)
      .eq("type", "klaviyo")
      .eq("enabled", true)
      .single();

    if (destError || !destination) {
      return new Response(
        JSON.stringify({ error: "Klaviyo destination not found or disabled" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse webhook payload
    const payload: KlaviyoWebhookPayload = await req.json();
    const events = Array.isArray(payload.data) ? payload.data : [payload.data];

    console.log(`[webhooks-klaviyo] Received ${events.length} events for workspace ${workspaceId}`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      syncJobsCreated: 0,
    };

    for (const event of events) {
      try {
        const email = event.attributes.profile?.email;
        const externalId = event.attributes.profile?.external_id;
        const eventType = event.type || 'unknown';
        const eventTimestamp = event.attributes.timestamp;

        // Skip events without email - can't match to unified user
        if (!email && !externalId) {
          console.log(`[webhooks-klaviyo] Skipping event without email/external_id`);
          results.skipped++;
          continue;
        }

        // Find unified user by email or external_id
        let unifiedUser = null;

        if (email) {
          const { data } = await supabase
            .from("users_unified")
            .select("id, computed")
            .eq("workspace_id", workspaceId)
            .or(`primary_email.eq.${email},emails.cs.{${email}}`)
            .single();
          unifiedUser = data;
        }

        if (!unifiedUser && externalId) {
          const { data } = await supabase
            .from("users_unified")
            .select("id, computed")
            .eq("workspace_id", workspaceId)
            .eq("id", externalId)
            .single();
          unifiedUser = data;
        }

        if (!unifiedUser) {
          // Create new unified user from Klaviyo data
          const { data: newUser, error: createError } = await supabase
            .from("users_unified")
            .insert({
              workspace_id: workspaceId,
              primary_email: email,
              emails: email ? [email] : [],
              anonymous_ids: [],
              customer_ids: [],
              traits: event.attributes.profile?.properties || {},
              computed: {
                intent_score: EVENT_SCORES[eventType] || 0,
                email_opens_30d: eventType === 'Opened Email' ? 1 : 0,
                email_clicks_30d: eventType === 'Clicked Email' ? 1 : 0,
                email_engagement_score: ENGAGEMENT_EVENTS.has(eventType) ? 10 : 0,
                is_subscribed: eventType === 'Subscribed to List',
                source: 'klaviyo',
              },
              first_seen_at: eventTimestamp,
              last_seen_at: eventTimestamp,
            })
            .select("id, computed")
            .single();

          if (createError) {
            console.error(`[webhooks-klaviyo] Error creating user:`, createError);
            results.errors++;
            continue;
          }
          unifiedUser = newUser;
          console.log(`[webhooks-klaviyo] Created new user from Klaviyo: ${unifiedUser?.id}`);
        } else {
          // Update existing user's computed traits
          const computed = (unifiedUser.computed as Record<string, unknown>) || {};
          const intentScore = (computed.intent_score as number) || 0;
          const emailOpens = (computed.email_opens_30d as number) || 0;
          const emailClicks = (computed.email_clicks_30d as number) || 0;
          const engagementScore = (computed.email_engagement_score as number) || 0;

          const updatedComputed = {
            ...computed,
            intent_score: Math.min(100, intentScore + (EVENT_SCORES[eventType] || 0)),
            email_opens_30d: eventType === 'Opened Email' ? emailOpens + 1 : emailOpens,
            email_clicks_30d: eventType === 'Clicked Email' ? emailClicks + 1 : emailClicks,
            email_engagement_score: ENGAGEMENT_EVENTS.has(eventType) 
              ? Math.min(100, engagementScore + 10) 
              : engagementScore,
            is_subscribed: eventType === 'Subscribed to List' 
              ? true 
              : eventType === 'Unsubscribed' 
                ? false 
                : computed.is_subscribed,
            last_klaviyo_event: eventType,
            last_klaviyo_event_at: eventTimestamp,
          };

          await supabase
            .from("users_unified")
            .update({
              computed: updatedComputed,
              last_seen_at: eventTimestamp,
              updated_at: new Date().toISOString(),
            })
            .eq("id", unifiedUser.id);
        }

        // Insert event into events table
        await supabase.from("events").insert({
          workspace_id: workspaceId,
          unified_user_id: unifiedUser!.id,
          event_type: 'email',
          event_name: eventType,
          properties: event.attributes.event_properties || {},
          context: {
            source: 'klaviyo',
            profile_id: event.attributes.profile_id,
            metric_id: event.attributes.metric_id,
          },
          source: 'klaviyo',
          event_time: eventTimestamp,
          status: 'processed',
        });

        // Schedule sync job to push enriched profile back to Klaviyo
        if (ENGAGEMENT_EVENTS.has(eventType)) {
          const { error: syncError } = await supabase.from("sync_jobs").insert({
            workspace_id: workspaceId,
            destination_id: destination.id,
            unified_user_id: unifiedUser!.id,
            job_type: 'profile_upsert',
            payload: { trigger: 'klaviyo_webhook', event_type: eventType },
            status: 'pending',
          });

          if (!syncError) {
            results.syncJobsCreated++;
          }
        }

        results.processed++;
      } catch (eventError) {
        console.error(`[webhooks-klaviyo] Error processing event:`, eventError);
        results.errors++;
      }
    }

    console.log(`[webhooks-klaviyo] Results:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[webhooks-klaviyo] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
