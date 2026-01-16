import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Background Processor Edge Function
 * 
 * FASI DISTINTE CON LOG ESPLICITI:
 * [COMPUTE] - Calcolo segnali comportamentali
 * [DECISION] - Decisioni basate sui segnali
 * [SYNC] - Schedulazione sync verso Klaviyo
 * 
 * Tasks:
 * 1. Detect cart/checkout abandonment
 * 2. Update recency decay
 * 3. Recompute behavioral signals
 * 4. IDENTITY BACKFILL - Retro-assegnazione eventi quando arriva email
 * 5. Schedule profile syncs with decisional flags
 * 6. Poll Klaviyo for email engagement events
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
  identityBackfillEvents: number;
  decisionsTriggered: number;
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

// deno-lint-ignore no-explicit-any
async function performIdentityBackfill(supabase: any, result: ProcessingResult, lookbackMinutes: number = 60): Promise<void> {
  console.log('[DECISION] Starting identity backfill...');
  
  try {
    // Find users who got email assigned in the last hour
    const oneHourAgo = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
    
    const { data: recentlyIdentifiedUsers, error: userError } = await supabase
      .from('users_unified')
      .select('id, primary_email, anonymous_ids, updated_at')
      .not('primary_email', 'is', null)
      .gt('updated_at', oneHourAgo)
      .limit(100);
    
    if (userError || !recentlyIdentifiedUsers) {
      console.log('[DECISION] No recently identified users found');
      return;
    }
    
    for (const user of recentlyIdentifiedUsers) {
      // Check if there are anonymous events that could belong to this user
      for (const anonId of user.anonymous_ids || []) {
        // Find orphaned events with this anonymous_id but no unified_user_id
        const { data: orphanedEvents, error: eventError } = await supabase
          .from('events')
          .select('id')
          .eq('anonymous_id', anonId)
          .is('unified_user_id', null)
          .gt('event_time', new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString())
          .limit(50);
        
        if (!eventError && orphanedEvents && orphanedEvents.length > 0) {
          // Reassign events to this user
          const eventIds = orphanedEvents.map((e: { id: string }) => e.id);
          const { error: updateError } = await supabase
            .from('events')
            .update({ unified_user_id: user.id })
            .in('id', eventIds);
          
          if (!updateError) {
            result.identityBackfillEvents += eventIds.length;
            console.log(`[DECISION] Identity backfill completed: events_reassigned=${eventIds.length} user=${user.primary_email}`);
          }
        }
      }
    }
  } catch (e: unknown) {
    result.errors.push(`Identity backfill: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// deno-lint-ignore no-explicit-any
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
    console.log('[SYNC] No Klaviyo destinations to poll');
    return;
  }

  const sinceTimestamp = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();
  console.log(`[SYNC] Polling Klaviyo events since ${sinceTimestamp}`);

  for (const destination of destinations) {
    const apiKey = destination.config?.api_key as string;
    if (!apiKey) continue;

    try {
      const { events, profiles, metrics } = await fetchKlaviyoEvents(apiKey, sinceTimestamp);
      console.log(`[SYNC] Workspace ${destination.workspace_id}: Found ${events.length} Klaviyo events`);

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

          console.log(`[COMPUTE] intent_score=${intentScore} email_engagement=${updatedComputed.email_engagement_score} user=${email}`);

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

// deno-lint-ignore no-explicit-any
async function scheduleDecisionalSyncs(supabase: any, result: ProcessingResult, limit: number): Promise<void> {
  console.log('[DECISION] Checking for decisional sync triggers...');
  
  try {
    // Find users with checkout_abandoned who haven't been synced yet
    const { data: usersNeedingSync, error: usersError } = await supabase
      .from('users_unified')
      .select('id, workspace_id, primary_email, computed')
      .not('primary_email', 'is', null)
      .or('computed->>drop_off_stage.eq.checkout_abandoned,computed->>drop_off_stage.eq.cart_abandoned')
      .limit(limit);
    
    if (usersError || !usersNeedingSync) {
      console.log('[DECISION] No users needing decisional sync');
      return;
    }
    
    for (const user of usersNeedingSync) {
      const computed = (user.computed || {}) as Record<string, unknown>;
      const flags = (computed.flags || {}) as Record<string, unknown>;
      const dropOffStage = computed.drop_off_stage as string;
      
      // Check if already synced for this stage
      const flagKey = `${dropOffStage}_synced`;
      if (flags[flagKey]) {
        continue;
      }
      
      // Check if there's already a pending sync job
      const { data: existingJob } = await supabase
        .from('sync_jobs')
        .select('id')
        .eq('unified_user_id', user.id)
        .in('status', ['pending', 'running'])
        .limit(1)
        .single();
      
      if (existingJob) {
        continue;
      }
      
      // Find Klaviyo destination for this workspace
      const { data: destination } = await supabase
        .from('destinations')
        .select('id')
        .eq('workspace_id', user.workspace_id)
        .eq('type', 'klaviyo')
        .eq('enabled', true)
        .limit(1)
        .single();
      
      if (!destination) {
        continue;
      }
      
      // Schedule forced sync
      await supabase.from('sync_jobs').insert({
        workspace_id: user.workspace_id,
        destination_id: destination.id,
        unified_user_id: user.id,
        job_type: 'profile_upsert',
        payload: { 
          trigger: 'decisional_sync',
          reason: dropOffStage,
        },
        status: 'pending',
      });
      
      result.decisionsTriggered++;
      console.log(`[DECISION] ${dropOffStage} detected -> sync triggered for ${user.primary_email}`);
    }
  } catch (e: unknown) {
    result.errors.push(`Decisional sync: ${e instanceof Error ? e.message : String(e)}`);
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
    identityBackfillEvents: 0,
    decisionsTriggered: 0,
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
    let identityBackfillMinutes = 60;
    try {
      const body = await req.json();
      limit = body.limit || 100;
      forceRecompute = body.force_recompute || false;
      klaviyoLookbackMinutes = body.klaviyo_lookback_minutes || 15;
      identityBackfillMinutes = body.identity_backfill_minutes || 60;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`[COMPUTE] Starting background processor with limit=${limit}, force=${forceRecompute}`);

    // =========================================================
    // 1. [COMPUTE] DETECT CART ABANDONMENT
    // =========================================================
    try {
      const { data: cartAbandoners, error: cartError } = await supabase.rpc(
        'detect_cart_abandonment',
        { p_minutes_threshold: 30 }
      );

      if (cartError) {
        const { error: createError } = await supabase.rpc('create_abandonment_detection_functions');
        if (createError) {
          console.warn('[COMPUTE] Could not create abandonment detection functions:', createError);
        }
      } else if (cartAbandoners && cartAbandoners.length > 0) {
        result.abandonmentDetected += cartAbandoners.length;
        console.log(`[COMPUTE] Detected ${cartAbandoners.length} cart abandonments`);
      }
    } catch (e: unknown) {
      result.errors.push(`Cart abandonment detection: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 2. [COMPUTE] DETECT CHECKOUT ABANDONMENT
    // =========================================================
    try {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: checkoutAbandoners, error: checkoutError } = await supabase
        .from('users_unified')
        .select('id, computed, primary_email')
        .is('computed->checkout_abandoned_at', null)
        .not('primary_email', 'is', null)
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
              const newComputed = { 
                ...user.computed, 
                checkout_abandoned_at: lastCheckout.event_time,
                drop_off_stage: 'checkout_abandoned',
              };
              await supabase.from('users_unified').update({ computed: newComputed }).eq('id', user.id);
              result.abandonmentDetected++;
              console.log(`[COMPUTE] intent_score=${(user.computed as Record<string, unknown>)?.intent_score || 0} dropoff_stage=checkout_abandoned user=${user.primary_email}`);
            }
          }
        }
      }
    } catch (e: unknown) {
      result.errors.push(`Checkout abandonment detection: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 3. [COMPUTE] UPDATE RECENCY DECAY
    // =========================================================
    try {
      const { data: recencyResult, error: recencyError } = await supabase.rpc('decay_recency_scores');
      if (recencyError) {
        result.errors.push(`Recency decay: ${recencyError.message}`);
      } else {
        result.recencyUpdated = recencyResult || 0;
        console.log(`[COMPUTE] Updated recency for ${result.recencyUpdated} users`);
      }
    } catch (e: unknown) {
      result.errors.push(`Recency decay: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 4. [COMPUTE] RECOMPUTE BEHAVIORAL SIGNALS
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
        console.log(`[COMPUTE] Recomputed signals for ${result.signalsRecomputed} users`);
      }
    } catch (e: unknown) {
      result.errors.push(`Signal recompute: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 5. [DECISION] IDENTITY BACKFILL - Retro-assign events when email arrives
    // =========================================================
    await performIdentityBackfill(supabase, result, identityBackfillMinutes);

    // =========================================================
    // 6. [SYNC] POLL KLAVIYO FOR EMAIL ENGAGEMENT EVENTS
    // =========================================================
    try {
      await pollKlaviyoEvents(supabase, result, klaviyoLookbackMinutes);
      console.log(`[SYNC] Imported ${result.klaviyoEventsImported} Klaviyo events, updated ${result.klaviyoUsersUpdated} users`);
    } catch (e: unknown) {
      result.errors.push(`Klaviyo polling: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // 7. [DECISION] SCHEDULE DECISIONAL SYNCS
    // =========================================================
    await scheduleDecisionalSyncs(supabase, result, limit);

    // =========================================================
    // 8. [SYNC] SCHEDULE PROFILE SYNCS FOR RECENTLY UPDATED USERS
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
        console.log(`[SYNC] Scheduled ${result.profileSyncsScheduled} profile syncs`);
      }
    } catch (e: unknown) {
      result.errors.push(`Profile sync scheduling: ${e instanceof Error ? e.message : String(e)}`);
    }

    // =========================================================
    // DONE
    // =========================================================
    const duration = Date.now() - startTime;
    console.log(`[COMPUTE] Background processor completed in ${duration}ms`);
    console.log(`[COMPUTE] Summary: recency=${result.recencyUpdated} abandonment=${result.abandonmentDetected} signals=${result.signalsRecomputed}`);
    console.log(`[DECISION] Summary: backfill=${result.identityBackfillEvents} decisions=${result.decisionsTriggered}`);
    console.log(`[SYNC] Summary: klaviyo_events=${result.klaviyoEventsImported} klaviyo_users=${result.klaviyoUsersUpdated} syncs=${result.profileSyncsScheduled}`);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[COMPUTE] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        ...result
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
