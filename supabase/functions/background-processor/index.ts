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
 * 
 * Should be called via pg_cron or external scheduler every 5 minutes
 */

interface ProcessingResult {
  recencyUpdated: number;
  abandonmentDetected: number;
  signalsRecomputed: number;
  profileSyncsScheduled: number;
  errors: string[];
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
    errors: [],
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional parameters
    let limit = 100;
    let forceRecompute = false;
    try {
      const body = await req.json();
      limit = body.limit || 100;
      forceRecompute = body.force_recompute || false;
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
        // Function might not exist, create it inline
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
      
      // Find users who have checkout events but no order events after
      const { data: checkoutAbandoners, error: checkoutError } = await supabase
        .from('users_unified')
        .select('id, computed')
        .is('computed->checkout_abandoned_at', null)
        .in('computed->>drop_off_stage', ['checkout_abandoned'])
        .limit(limit);

      if (!checkoutError && checkoutAbandoners) {
        for (const user of checkoutAbandoners) {
          // Get last checkout event
          const { data: lastCheckout } = await supabase
            .from('events')
            .select('event_time')
            .eq('unified_user_id', user.id)
            .eq('event_type', 'checkout')
            .order('event_time', { ascending: false })
            .limit(1)
            .single();

          if (lastCheckout && new Date(lastCheckout.event_time) < new Date(thirtyMinsAgo)) {
            // Check no order after this checkout
            const { data: hasOrder } = await supabase
              .from('events')
              .select('id')
              .eq('unified_user_id', user.id)
              .eq('event_type', 'order')
              .gt('event_time', lastCheckout.event_time)
              .limit(1)
              .single();

            if (!hasOrder) {
              // Mark as checkout abandoned
              const newComputed = {
                ...user.computed,
                checkout_abandoned_at: lastCheckout.event_time,
              };
              
              await supabase
                .from('users_unified')
                .update({ computed: newComputed })
                .eq('id', user.id);
              
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
    // 5. SCHEDULE PROFILE SYNCS (for recently updated profiles with email)
    // =========================================================
    try {
      // Find users with emails who were updated recently but not synced
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: profilesToSync, error: profilesError } = await supabase
        .from('users_unified')
        .select('id, workspace_id, primary_email, updated_at')
        .not('primary_email', 'is', null)
        .gt('updated_at', oneHourAgo)
        .limit(limit);

      if (!profilesError && profilesToSync) {
        for (const user of profilesToSync) {
          // Check if there's already a pending profile_upsert job
          const { data: existingJob } = await supabase
            .from('sync_jobs')
            .select('id')
            .eq('unified_user_id', user.id)
            .eq('job_type', 'profile_upsert')
            .in('status', ['pending', 'running'])
            .limit(1)
            .single();

          if (!existingJob) {
            // Get enabled Klaviyo destination for this workspace
            const { data: destination } = await supabase
              .from('destinations')
              .select('id')
              .eq('workspace_id', user.workspace_id)
              .eq('type', 'klaviyo')
              .eq('enabled', true)
              .limit(1)
              .single();

            if (destination) {
              // Schedule profile sync
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
