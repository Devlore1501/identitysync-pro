import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * ABANDONMENT DETECTOR
 * 
 * Scheduled job that detects cart and checkout abandonments.
 * Runs every 15 minutes to identify users who:
 * - Added to cart but didn't start checkout within 60 minutes
 * - Started checkout but didn't complete order within 180 minutes
 * 
 * Updates computed traits and schedules sync jobs to Klaviyo.
 */

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow both GET (for cron) and POST (for manual trigger)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional workspace filter
    let workspaceId: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        workspaceId = body.workspace_id || null;
      } catch {
        // No body or invalid JSON, process all workspaces
      }
    }

    console.log(JSON.stringify({
      fn: 'abandonment-detector',
      action: 'start',
      workspace_id: workspaceId || 'all',
      ts: new Date().toISOString()
    }));

    // Call detect_abandonments function
    const { data: result, error: detectError } = await supabase.rpc('detect_abandonments', {
      p_workspace_id: workspaceId
    });

    if (detectError) {
      console.error(JSON.stringify({
        fn: 'abandonment-detector',
        error: 'detect_abandonments failed',
        message: detectError.message,
        ts: new Date().toISOString()
      }));
      
      return new Response(
        JSON.stringify({ error: 'Failed to detect abandonments', details: detectError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats = result?.[0] || { users_updated: 0, cart_abandoned: 0, checkout_abandoned: 0 };

    // If any abandonments detected, schedule sync jobs
    let syncJobsCreated = 0;
    
    if (stats.cart_abandoned > 0 || stats.checkout_abandoned > 0) {
      // Get users who were just marked as abandoned (have abandonment timestamp in last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: abandonedUsers, error: usersError } = await supabase
        .from('users_unified')
        .select('id, workspace_id, primary_email, computed')
        .or(`computed->cart_abandoned_at.gte.${fiveMinutesAgo},computed->checkout_abandoned_at.gte.${fiveMinutesAgo}`)
        .not('primary_email', 'is', null);

      if (!usersError && abandonedUsers) {
        // Get enabled destinations
        const workspaceIds = [...new Set(abandonedUsers.map(u => u.workspace_id))];
        
        const { data: destinations } = await supabase
          .from('destinations')
          .select('id, workspace_id')
          .in('workspace_id', workspaceIds)
          .eq('enabled', true);

        if (destinations && destinations.length > 0) {
          const destByWorkspace = destinations.reduce((acc, d) => {
            if (!acc[d.workspace_id]) acc[d.workspace_id] = [];
            acc[d.workspace_id].push(d.id);
            return acc;
          }, {} as Record<string, string[]>);

          const now = new Date().toISOString();
          const syncJobs = [];

          for (const user of abandonedUsers) {
            const workspaceDests = destByWorkspace[user.workspace_id] || [];
            for (const destId of workspaceDests) {
              syncJobs.push({
                workspace_id: user.workspace_id,
                destination_id: destId,
                unified_user_id: user.id,
                job_type: 'profile_upsert',
                status: 'pending',
                scheduled_at: now,
                payload: { 
                  trigger: 'abandonment-detector',
                  abandonment_type: user.computed?.checkout_abandoned_at 
                    ? 'checkout_abandoned' 
                    : 'cart_abandoned'
                }
              });
            }
          }

          if (syncJobs.length > 0) {
            const { error: insertError } = await supabase
              .from('sync_jobs')
              .insert(syncJobs);
            
            if (!insertError) {
              syncJobsCreated = syncJobs.length;
            } else {
              console.error(JSON.stringify({
                fn: 'abandonment-detector',
                error: 'Failed to create sync jobs',
                message: insertError.message,
                ts: new Date().toISOString()
              }));
            }
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      fn: 'abandonment-detector',
      action: 'complete',
      users_updated: stats.users_updated,
      cart_abandoned: stats.cart_abandoned,
      checkout_abandoned: stats.checkout_abandoned,
      sync_jobs_created: syncJobsCreated,
      duration_ms: duration,
      ts: new Date().toISOString()
    }));

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          users_updated: stats.users_updated,
          cart_abandoned: stats.cart_abandoned,
          checkout_abandoned: stats.checkout_abandoned,
          sync_jobs_created: syncJobsCreated
        },
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(JSON.stringify({
      fn: 'abandonment-detector',
      error: 'unhandled_exception',
      message: error instanceof Error ? error.message : 'Unknown error',
      ts: new Date().toISOString()
    }));
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
