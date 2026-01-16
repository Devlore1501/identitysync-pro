/**
 * Poll Klaviyo Events
 * 
 * Fetches email engagement events (opens, clicks, subscriptions) from Klaviyo API
 * and imports them into the system for bidirectional sync.
 * 
 * Run this on a schedule (e.g., every 5 minutes) to keep data in sync.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Klaviyo metrics we want to poll
const KLAVIYO_METRICS = [
  { name: 'Opened Email', intentScore: 3 },
  { name: 'Clicked Email', intentScore: 5 },
  { name: 'Received Email', intentScore: 0 },
  { name: 'Subscribed to List', intentScore: 2 },
  { name: 'Unsubscribed', intentScore: 0 },
  { name: 'Clicked SMS', intentScore: 4 },
];

interface KlaviyoEvent {
  type: string;
  id: string;
  attributes: {
    timestamp: number;
    datetime: string;
    event_properties: Record<string, unknown>;
    uuid: string;
  };
  relationships: {
    profile: {
      data: {
        type: string;
        id: string;
      };
    };
    metric: {
      data: {
        type: string;
        id: string;
      };
    };
  };
}

interface KlaviyoProfile {
  type: string;
  id: string;
  attributes: {
    email?: string;
    phone_number?: string;
    external_id?: string;
    properties?: Record<string, unknown>;
  };
}

interface KlaviyoMetric {
  type: string;
  id: string;
  attributes: {
    name: string;
  };
}

async function fetchKlaviyoEvents(
  apiKey: string,
  sinceTimestamp: string,
  metricId?: string
): Promise<{ events: KlaviyoEvent[]; profiles: Map<string, KlaviyoProfile>; metrics: Map<string, KlaviyoMetric> }> {
  const params = new URLSearchParams({
    'filter': `greater-than(datetime,${sinceTimestamp})`,
    'include': 'profile,metric',
    'page[size]': '100',
    'sort': '-datetime',
  });

  if (metricId) {
    params.set('filter', `equals(metric_id,"${metricId}"),greater-than(datetime,${sinceTimestamp})`);
  }

  const response = await fetch(`https://a.klaviyo.com/api/events/?${params.toString()}`, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'revision': '2024-02-15',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Klaviyo API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Build profile and metric maps from included data
  const profiles = new Map<string, KlaviyoProfile>();
  const metrics = new Map<string, KlaviyoMetric>();
  
  if (data.included) {
    for (const item of data.included) {
      if (item.type === 'profile') {
        profiles.set(item.id, item);
      } else if (item.type === 'metric') {
        metrics.set(item.id, item);
      }
    }
  }

  return {
    events: data.data || [],
    profiles,
    metrics,
  };
}

async function getMetricIdByName(apiKey: string, metricName: string): Promise<string | null> {
  const params = new URLSearchParams({
    'filter': `equals(name,"${metricName}")`,
  });

  const response = await fetch(`https://a.klaviyo.com/api/metrics/?${params.toString()}`, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'revision': '2024-02-15',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.data?.[0]?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request body for optional parameters
    let workspaceFilter: string | null = null;
    let lookbackMinutes = 15; // Default: poll last 15 minutes
    
    if (req.method === "POST") {
      try {
        const body = await req.json();
        workspaceFilter = body.workspace_id || null;
        lookbackMinutes = body.lookback_minutes || 15;
      } catch {
        // No body or invalid JSON, use defaults
      }
    }

    // Get all enabled Klaviyo destinations
    let query = supabase
      .from("destinations")
      .select("id, workspace_id, config")
      .eq("type", "klaviyo")
      .eq("enabled", true);

    if (workspaceFilter) {
      query = query.eq("workspace_id", workspaceFilter);
    }

    const { data: destinations, error: destError } = await query;

    if (destError) {
      throw new Error(`Failed to fetch destinations: ${destError.message}`);
    }

    if (!destinations || destinations.length === 0) {
      return new Response(
        JSON.stringify({ message: "No Klaviyo destinations configured", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sinceTimestamp = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
    console.log(`[poll-klaviyo] Polling events since ${sinceTimestamp}`);

    const results = {
      workspacesProcessed: 0,
      eventsImported: 0,
      usersUpdated: 0,
      usersCreated: 0,
      errors: [] as string[],
    };

    for (const destination of destinations) {
      const apiKey = (destination.config as Record<string, unknown>)?.api_key as string;
      if (!apiKey) {
        results.errors.push(`Workspace ${destination.workspace_id}: No API key configured`);
        continue;
      }

      try {
        // Fetch all events (no metric filter - we'll filter by metric name)
        const { events, profiles, metrics } = await fetchKlaviyoEvents(apiKey, sinceTimestamp);
        
        console.log(`[poll-klaviyo] Workspace ${destination.workspace_id}: Found ${events.length} events`);

        for (const event of events) {
          const profileId = event.relationships.profile?.data?.id;
          const metricId = event.relationships.metric?.data?.id;
          
          if (!profileId || !metricId) continue;

          const profile = profiles.get(profileId);
          const metric = metrics.get(metricId);
          
          if (!profile?.attributes?.email) {
            // Skip events without email - can't match to user
            continue;
          }

          const email = profile.attributes.email;
          const metricName = metric?.attributes?.name || 'Unknown';
          
          // Check if this is a metric we care about
          const metricConfig = KLAVIYO_METRICS.find(m => m.name === metricName);
          if (!metricConfig) {
            continue; // Skip metrics we don't track
          }

          // Check for duplicate event
          const { data: existingEvent } = await supabase
            .from("events")
            .select("id")
            .eq("workspace_id", destination.workspace_id)
            .eq("source", "klaviyo")
            .eq("properties->>klaviyo_event_id", event.id)
            .single();

          if (existingEvent) {
            continue; // Skip duplicate
          }

          // Find or create unified user
          let unifiedUser = null;
          
          const { data: existingUser } = await supabase
            .from("users_unified")
            .select("id, computed")
            .eq("workspace_id", destination.workspace_id)
            .or(`primary_email.eq.${email},emails.cs.{${email}}`)
            .single();

          if (existingUser) {
            unifiedUser = existingUser;

            // Update computed traits
            const computed = (unifiedUser.computed as Record<string, unknown>) || {};
            const intentScore = Math.min(100, ((computed.intent_score as number) || 0) + metricConfig.intentScore);
            const emailOpens = (computed.email_opens_30d as number) || 0;
            const emailClicks = (computed.email_clicks_30d as number) || 0;
            const engagementScore = (computed.email_engagement_score as number) || 0;

            const updatedComputed = {
              ...computed,
              intent_score: intentScore,
              email_opens_30d: metricName === 'Opened Email' ? emailOpens + 1 : emailOpens,
              email_clicks_30d: metricName === 'Clicked Email' ? emailClicks + 1 : emailClicks,
              email_engagement_score: metricConfig.intentScore > 0 
                ? Math.min(100, engagementScore + 10) 
                : engagementScore,
              is_subscribed: metricName === 'Subscribed to List' 
                ? true 
                : metricName === 'Unsubscribed' 
                  ? false 
                  : computed.is_subscribed,
              last_klaviyo_event: metricName,
              last_klaviyo_event_at: event.attributes.datetime,
            };

            await supabase
              .from("users_unified")
              .update({
                computed: updatedComputed,
                last_seen_at: event.attributes.datetime,
                updated_at: new Date().toISOString(),
              })
              .eq("id", unifiedUser.id);

            results.usersUpdated++;
          } else {
            // Create new user from Klaviyo data
            const { data: newUser, error: createError } = await supabase
              .from("users_unified")
              .insert({
                workspace_id: destination.workspace_id,
                primary_email: email,
                emails: [email],
                anonymous_ids: [],
                customer_ids: [],
                phone: profile.attributes.phone_number || null,
                traits: profile.attributes.properties || {},
                computed: {
                  intent_score: metricConfig.intentScore,
                  email_opens_30d: metricName === 'Opened Email' ? 1 : 0,
                  email_clicks_30d: metricName === 'Clicked Email' ? 1 : 0,
                  email_engagement_score: metricConfig.intentScore > 0 ? 10 : 0,
                  is_subscribed: metricName === 'Subscribed to List',
                  source: 'klaviyo',
                },
                external_ids: { klaviyo_profile_id: profileId },
                first_seen_at: event.attributes.datetime,
                last_seen_at: event.attributes.datetime,
              })
              .select("id")
              .single();

            if (createError) {
              console.error(`[poll-klaviyo] Error creating user:`, createError);
              continue;
            }
            
            unifiedUser = newUser;
            results.usersCreated++;
          }

          // Insert event
          await supabase.from("events").insert({
            workspace_id: destination.workspace_id,
            unified_user_id: unifiedUser.id,
            event_type: 'email',
            event_name: metricName,
            properties: {
              ...event.attributes.event_properties,
              klaviyo_event_id: event.id,
              klaviyo_profile_id: profileId,
              klaviyo_metric_id: metricId,
            },
            context: {
              source: 'klaviyo',
              imported_at: new Date().toISOString(),
            },
            source: 'klaviyo',
            event_time: event.attributes.datetime,
            status: 'processed',
          });

          results.eventsImported++;

          // Schedule profile sync back to Klaviyo if engagement event
          if (metricConfig.intentScore > 0) {
            await supabase.from("sync_jobs").insert({
              workspace_id: destination.workspace_id,
              destination_id: destination.id,
              unified_user_id: unifiedUser.id,
              job_type: 'profile_upsert',
              payload: { trigger: 'klaviyo_poll', event_type: metricName },
              status: 'pending',
            });
          }
        }

        results.workspacesProcessed++;
      } catch (wsError) {
        const errorMsg = wsError instanceof Error ? wsError.message : "Unknown error";
        results.errors.push(`Workspace ${destination.workspace_id}: ${errorMsg}`);
        console.error(`[poll-klaviyo] Error for workspace ${destination.workspace_id}:`, wsError);
      }
    }

    console.log(`[poll-klaviyo] Results:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[poll-klaviyo] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
