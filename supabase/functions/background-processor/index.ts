import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Background Processor Edge Function
 * 
 * Runs periodically to:
 * 1. Recalculate abandonment windows (cart/checkout abandoned)
 * 2. Update recency decay for all users
 * 3. Recompute behavioral signals for active users
 * 4. Schedule profile syncs for users with updated computed traits
 * 5. Poll Klaviyo for email engagement events (bidirectional sync)
 * 
 * Should be called via pg_cron or external scheduler every 5 minutes
 */

// Klaviyo metrics we want to poll
const KLAVIYO_METRICS = [
  { name: 'Opened Email', intentScore: 3 },
  { name: 'Clicked Email', intentScore: 5 },
  { name: 'Received Email', intentScore: 0 },
  { name: 'Subscribed to List', intentScore: 2 },
  { name: 'Unsubscribed', intentScore: 0 },
  { name: 'Clicked SMS', intentScore: 4 },
];

interface ProcessingResult {
  recencyUpdated: number;
  abandonmentDetected: number;
  signalsRecomputed: number;
  profileSyncsScheduled: number;
  klaviyoEventsImported: number;
  klaviyoUsersUpdated: number;
  errors: string[];
}

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
    profile: { data: { type: string; id: string } };
    metric: { data: { type: string; id: string } };
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
  attributes: { name: string };
}

async function fetchKlaviyoEvents(
  apiKey: string,
  sinceTimestamp: string
): Promise<{ events: KlaviyoEvent[]; profiles: Map<string, KlaviyoProfile>; metrics: Map<string, KlaviyoMetric> }> {
  const params = new URLSearchParams({
    'filter': `greater-than(datetime,${sinceTimestamp})`,
    'include': 'profile,metric',
    'page[size]': '100',
    'sort': '-datetime',
  });

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
  
  const profiles = new Map<string, KlaviyoProfile>();
  const metrics = new Map<string, KlaviyoMetric>();
  
  if (data.included) {
    for (const item of data.included) {
      if (item.type === 'profile') profiles.set(item.id, item);
      else if (item.type === 'metric') metrics.set(item.id, item);
    }
  }

  return { events: data.data || [], profiles, metrics };
}

async function pollKlaviyoEvents(
  supabase: any,
  result: ProcessingResult,
  lookbackMinutes: number = 15
): Promise<void> {
  // Get all enabled Klaviyo destinations
  const { data: destinations, error: destError } = await supabase
    .from("destinations")
    .select("id, workspace_id, config")
    .eq("type", "klaviyo")
    .eq("enabled", true);

  if (destError || !destinations || destinations.length === 0) {
    console.log('[Background Processor] No Klaviyo destinations to poll');
    return;
  }

  const sinceTimestamp = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  console.log(`[Background Processor] Polling Klaviyo events since ${sinceTimestamp}`);

  for (const destination of destinations) {
    const apiKey = destination.config?.api_key as string;
    if (!apiKey) continue;

    try {
      const { events, profiles, metrics } = await fetchKlaviyoEvents(apiKey, sinceTimestamp);
      console.log(`[Background Processor] Workspace ${destination.workspace_id}: Found ${events.length} Klaviyo events`);

      for (const event of events) {
        const profileId = event.relationships.profile?.data?.id;
        const metricId = event.relationships.metric?.data?.id;
        if (!profileId || !metricId) continue;

        const profile = profiles.get(profileId);
        const metric = metrics.get(metricId);
        if (!profile?.attributes?.email) continue;

        const email = profile.attributes.email;
        const metricName = metric?.attributes?.name || 'Unknown';
        const metricConfig = KLAVIYO_METRICS.find(m => m.name === metricName);
        if (!metricConfig) continue;

        // Check for duplicate event
        const { data: existingEvent } = await supabase
          .from("events")
          .select("id")
          .eq("workspace_id", destination.workspace_id)
          .eq("source", "klaviyo")
          .eq("properties->>klaviyo_event_id", event.id)
          .single();

        if (existingEvent) continue;

        // Find or create unified user
        const { data: existingUser } = await supabase
          .from("users_unified")
          .select("id, computed")
          .eq("workspace_id", destination.workspace_id)
          .or(`primary_email.eq.${email},emails.cs.{${email}}`)
          .single();

        let unifiedUserId: string;

        if (existingUser) {
          unifiedUserId = existingUser.id;
          const computed = (existingUser.computed as Record<string, unknown>) || {};
          const intentScore = Math.min(100, ((computed.intent_score as number) || 0) + metricConfig.intentScore);
          const emailOpens = (computed.email_opens_30d as number) || 0;
          const emailClicks = (computed.email_clicks_30d as number) || 0;
          const engagementScore = (computed.email_engagement_score as number) || 0;

          const updatedComputed = {
            ...computed,
            intent_score: intentScore,
            email_opens_30d: metricName === 'Opened Email' ? emailOpens + 1 : emailOpens,
            email_clicks_30d: metricName === 'Clicked Email' ? emailClicks + 1 : emailClicks,
            email_engagement_score: metricConfig.intentScore > 0 ? Math.min(100, engagementScore + 10) : engagementScore,
            is_subscribed: metricName === 'Subscribed to List' ? true : metricName === 'Unsubscribed' ? false : computed.is_subscribed,
            last_klaviyo_event: metricName,
            last_klaviyo_event_at: event.attributes.datetime,
          };

          await supabase
            .from("users_unified")
            .update({ computed: updatedComputed, last_seen_at: event.attributes.datetime, updated_at: new Date().toISOString() })
            .eq("id", existingUser.id);

          result.klaviyoUsersUpdated++;
        } else {
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

          if (createError) continue;
          unifiedUserId = newUser!.id;
          result.klaviyoUsersUpdated++;
        }

        // Insert event
        await supabase.from("events").insert({
          workspace_id: destination.workspace_id,
          unified_user_id: unifiedUserId,
          event_type: 'email',
          event_name: metricName,
          properties: { ...event.attributes.event_properties, klaviyo_event_id: event.id, klaviyo_profile_id: profileId },
          context: { source: 'klaviyo', imported_at: new Date().toISOString() },
          source: 'klaviyo',
          event_time: event.attributes.datetime,
          status: 'processed',
        });

        result.klaviyoEventsImported++;

        // Schedule profile sync back to Klaviyo
        if (metricConfig.intentScore > 0) {
          await supabase.from("sync_jobs").insert({
            workspace_id: destination.workspace_id,
            destination_id: destination.id,
            unified_user_id: unifiedUserId,
            job_type: 'profile_upsert',
            payload: { trigger: 'klaviyo_poll' },
            status: 'pending',
          });
        }
      }
    } catch (wsError) {
      result.errors.push(`Klaviyo poll workspace ${destination.workspace_id}: ${wsError instanceof Error ? wsError.message : String(wsError)}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const result: ProcessingResult = {
    recencyUpdated: 0,
    abandonmentDetected: 0,
    signalsRecomputed: 0,
    profileSyncsScheduled: 0,
    klaviyoEventsImported: 0,
    klaviyoUsersUpdated: 0,
    errors: [],
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional parameters
    let limit = 100;
    let forceRecompute = false;
    let klaviyoLookbackMinutes = 15;
    try {
      const body = await req.json();
      limit = body.limit || 100;
      forceRecompute = body.force_recompute || false;
      klaviyoLookbackMinutes = body.klaviyo_lookback_minutes || 15;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`[Background Processor] Starting with limit=${limit}, force=${forceRecompute}`);

    // =========================================================
    // 1. DETECT CART ABANDONMENT (users with cart but no checkout in 30+ min)
    // =========================================================
    try {
      const { data: cartAbandoners, error: cartError } = await supabase.rpc(
        'detect_cart_abandonment',
        { p_minutes_threshold: 30 }
      );

      if (cartError) {
        const { error: createError } = await supabase.rpc('create_abandonment_detection_functions');
        if (createError) {
          console.warn('Could not create abandonment detection functions:', createError);
        }
      } else if (cartAbandoners && cartAbandoners.length > 0) {
        result.abandonmentDetected += cartAbandoners.length;
        console.log(`[Background Processor] Detected ${cartAbandoners.length} cart abandonments`);
      }
    } catch (e: unknown) {
      result.errors.push(`Cart abandonment detection: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 2. DETECT CHECKOUT ABANDONMENT (users with checkout but no order in 30+ min)
    // =========================================================
    try {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: checkoutAbandoners, error: checkoutError } = await supabase
        .from('users_unified')
        .select('id, computed')
        .is('computed->checkout_abandoned_at', null)
        .in('computed->>drop_off_stage', ['checkout_abandoned'])
        .limit(limit);

      if (!checkoutError && checkoutAbandoners) {
        for (const user of checkoutAbandoners) {
          const { data: lastCheckout } = await supabase
            .from('events')
            .select('event_time')
            .eq('unified_user_id', user.id)
            .eq('event_type', 'checkout')
            .order('event_time', { ascending: false })
            .limit(1)
            .single();

          if (lastCheckout && new Date(lastCheckout.event_time) < new Date(thirtyMinsAgo)) {
            const { data: hasOrder } = await supabase
              .from('events')
              .select('id')
              .eq('unified_user_id', user.id)
              .eq('event_type', 'order')
              .gt('event_time', lastCheckout.event_time)
              .limit(1)
              .single();

            if (!hasOrder) {
              const newComputed = { ...user.computed, checkout_abandoned_at: lastCheckout.event_time };
              await supabase.from('users_unified').update({ computed: newComputed }).eq('id', user.id);
              result.abandonmentDetected++;
            }
          }
        }
      }
    } catch (e: unknown) {
      result.errors.push(`Checkout abandonment detection: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 3. UPDATE RECENCY DECAY (for users not seen today)
    // =========================================================
    try {
      const { data: recencyResult, error: recencyError } = await supabase.rpc('decay_recency_scores');
      if (recencyError) {
        result.errors.push(`Recency decay: ${recencyError.message}`);
      } else {
        result.recencyUpdated = recencyResult || 0;
        console.log(`[Background Processor] Updated recency for ${result.recencyUpdated} users`);
      }
    } catch (e: unknown) {
      result.errors.push(`Recency decay: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 4. RECOMPUTE BEHAVIORAL SIGNALS (for stale profiles)
    // =========================================================
    try {
      const { data: recomputeResult, error: recomputeError } = await supabase.rpc(
        'recompute_behavioral_signals_batch',
        { p_limit: limit }
      );
      if (recomputeError) {
        result.errors.push(`Signal recompute: ${recomputeError.message}`);
      } else {
        result.signalsRecomputed = recomputeResult || 0;
        console.log(`[Background Processor] Recomputed signals for ${result.signalsRecomputed} users`);
      }
    } catch (e: unknown) {
      result.errors.push(`Signal recompute: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 5. POLL KLAVIYO FOR EMAIL ENGAGEMENT EVENTS (bidirectional sync)
    // =========================================================
    try {
      await pollKlaviyoEvents(supabase, result, klaviyoLookbackMinutes);
      console.log(`[Background Processor] Imported ${result.klaviyoEventsImported} Klaviyo events, updated ${result.klaviyoUsersUpdated} users`);
    } catch (e: unknown) {
      result.errors.push(`Klaviyo polling: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 6. SCHEDULE PROFILE SYNCS (for recently updated profiles with email)
    // =========================================================
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: profilesToSync, error: profilesError } = await supabase
        .from('users_unified')
        .select('id, workspace_id, primary_email, updated_at')
        .not('primary_email', 'is', null)
        .gt('updated_at', oneHourAgo)
        .limit(limit);

      if (!profilesError && profilesToSync) {
        for (const user of profilesToSync) {
          const { data: existingJob } = await supabase
            .from('sync_jobs')
            .select('id')
            .eq('unified_user_id', user.id)
            .eq('job_type', 'profile_upsert')
            .in('status', ['pending', 'running'])
            .limit(1)
            .single();

          if (!existingJob) {
            const { data: destination } = await supabase
              .from('destinations')
              .select('id')
              .eq('workspace_id', user.workspace_id)
              .eq('type', 'klaviyo')
              .eq('enabled', true)
              .limit(1)
              .single();

            if (destination) {
              await supabase.from('sync_jobs').insert({
                workspace_id: user.workspace_id,
                destination_id: destination.id,
                unified_user_id: user.id,
                job_type: 'profile_upsert',
                payload: { trigger: 'background_processor' },
                status: 'pending',
              });
              result.profileSyncsScheduled++;
            }
          }
        }
        console.log(`[Background Processor] Scheduled ${result.profileSyncsScheduled} profile syncs`);
      }
    } catch (e: unknown) {
      result.errors.push(`Profile sync scheduling: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // DONE
    // =========================================================
    const duration = Date.now() - startTime;
    console.log(`[Background Processor] Completed in ${duration}ms`, result);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Background Processor] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        ...result 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
