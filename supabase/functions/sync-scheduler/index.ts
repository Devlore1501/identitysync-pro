import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// This function should be called by a scheduler (e.g., cron-job.org, Supabase pg_cron, or external scheduler)
// to process pending sync jobs for all destinations

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: Record<string, unknown> = {};

    // 1. Process Klaviyo sync jobs
    const klaviyoResponse = await fetch(`${supabaseUrl}/functions/v1/sync-klaviyo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });
    results.klaviyo = await klaviyoResponse.json();

    // 2. Process Meta sync jobs
    const metaResponse = await fetch(`${supabaseUrl}/functions/v1/sync-meta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });
    results.meta = await metaResponse.json();

    // 3. Get stats
    const { data: pendingJobs } = await supabase
      .from('sync_jobs')
      .select('status', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { data: failedJobs } = await supabase
      .from('sync_jobs')
      .select('status', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync scheduler completed',
        results,
        stats: {
          pending_jobs: pendingJobs?.length || 0,
          failed_last_24h: failedJobs?.length || 0,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync scheduler error:', error);
    return new Response(
      JSON.stringify({ error: 'Sync scheduler failed', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
