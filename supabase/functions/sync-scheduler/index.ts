import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * SYNC SCHEDULER
 * 
 * Orchestrator che esegue in sequenza:
 * 1. predictive-engine → Genera segnali predittivi
 * 2. sync-klaviyo → Sincronizza profili e triggerizza flow
 * 3. sync-meta → Sincronizza con Meta CAPI
 * 
 * Chiamare via cron ogni 15-60 minuti
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: Record<string, unknown> = {};
    const startTime = Date.now();

    console.log('[SYNC-SCHEDULER] Starting scheduled sync pipeline...');

    // 0. Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name')
      .limit(100);

    console.log(`[SYNC-SCHEDULER] Found ${workspaces?.length || 0} workspaces`);

    // 1. Run predictive engine for each workspace
    let totalSignalsCreated = 0;
    let totalSignalsUpdated = 0;
    
    for (const workspace of (workspaces || [])) {
      try {
        const predictiveResponse = await fetch(`${supabaseUrl}/functions/v1/predictive-engine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ workspace_id: workspace.id }),
        });
        
        if (predictiveResponse.ok) {
          const data = await predictiveResponse.json();
          totalSignalsCreated += data.signals_created || 0;
          totalSignalsUpdated += data.signals_updated || 0;
        }
      } catch (e) {
        console.error(`[SYNC-SCHEDULER] Predictive engine error for ${workspace.name}:`, e);
      }
    }
    
    results.predictive_engine = {
      signals_created: totalSignalsCreated,
      signals_updated: totalSignalsUpdated,
    };
    console.log(`[SYNC-SCHEDULER] Predictive engine: ${totalSignalsCreated} created, ${totalSignalsUpdated} updated`);

    // 2. Process Klaviyo sync jobs
    const klaviyoResponse = await fetch(`${supabaseUrl}/functions/v1/sync-klaviyo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });
    
    if (klaviyoResponse.ok) {
      results.klaviyo = await klaviyoResponse.json();
      console.log('[SYNC-SCHEDULER] Klaviyo sync completed:', results.klaviyo);
    } else {
      results.klaviyo = { error: 'Klaviyo sync failed', status: klaviyoResponse.status };
    }

    // 3. Process Meta sync jobs
    const metaResponse = await fetch(`${supabaseUrl}/functions/v1/sync-meta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });
    
    if (metaResponse.ok) {
      results.meta = await metaResponse.json();
      console.log('[SYNC-SCHEDULER] Meta sync completed:', results.meta);
    } else {
      results.meta = { error: 'Meta sync failed', status: metaResponse.status };
    }

    // 4. Get queue stats
    const { count: pendingCount } = await supabase
      .from('sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: failedCount } = await supabase
      .from('sync_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { count: pendingFlows } = await supabase
      .from('predictive_signals')
      .select('*', { count: 'exact', head: true })
      .eq('should_trigger_flow', true)
      .is('flow_triggered_at', null);

    const duration = Date.now() - startTime;

    console.log(`[SYNC-SCHEDULER] Completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync scheduler completed',
        duration_ms: duration,
        results,
        stats: {
          pending_jobs: pendingCount || 0,
          failed_last_24h: failedCount || 0,
          pending_flows: pendingFlows || 0,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SYNC-SCHEDULER] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Sync scheduler failed', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
