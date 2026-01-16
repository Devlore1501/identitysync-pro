import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface GhostProfile {
  unified_user_id: string;
  klaviyo_profile_id?: string;
  deleted: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry-run mode
    const destinationId = body.destinationId;

    if (!destinationId) {
      return new Response(
        JSON.stringify({ error: 'destinationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get destination config to get Klaviyo API key
    const { data: destination, error: destError } = await supabase
      .from('destinations')
      .select('*')
      .eq('id', destinationId)
      .eq('type', 'klaviyo')
      .single();

    if (destError || !destination) {
      return new Response(
        JSON.stringify({ error: 'Klaviyo destination not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = destination.config as { api_key?: string };
    const apiKey = config?.api_key;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Klaviyo API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find all unified_user_ids that were synced but have no email
    // These are "ghost profiles" created on Klaviyo with only external_id
    const { data: ghostJobs, error: jobsError } = await supabase
      .from('sync_jobs')
      .select('unified_user_id')
      .eq('destination_id', destinationId)
      .eq('status', 'completed')
      .in('job_type', ['profile_upsert', 'event_track'])
      .is('last_error', null);

    if (jobsError) {
      return new Response(
        JSON.stringify({ error: `Database error: ${jobsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique user IDs
    const syncedUserIds = [...new Set(
      (ghostJobs || [])
        .map(job => job.unified_user_id)
        .filter(Boolean)
    )] as string[];

    // Now check which of these users don't have an email
    const { data: usersWithEmail, error: usersError } = await supabase
      .from('users_unified')
      .select('id')
      .in('id', syncedUserIds)
      .not('primary_email', 'is', null);

    if (usersError) {
      return new Response(
        JSON.stringify({ error: `Users query error: ${usersError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const usersWithEmailIds = new Set((usersWithEmail || []).map(u => u.id));
    const ghostUserIds = syncedUserIds.filter(id => !usersWithEmailIds.has(id));

    console.log(`Found ${ghostUserIds.length} ghost profiles to cleanup`);

    if (ghostUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No ghost profiles found',
          dryRun,
          found: 0,
          deleted: 0,
          profiles: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: GhostProfile[] = [];
    let deletedCount = 0;
    let errorCount = 0;

    // Process each ghost user
    for (const userId of ghostUserIds) {
      const result: GhostProfile = {
        unified_user_id: userId,
        deleted: false
      };

      try {
        // Search for profile on Klaviyo by external_id
        const searchResponse = await fetch(
          `https://a.klaviyo.com/api/profiles/?filter=equals(external_id,"${userId}")`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Klaviyo-API-Key ${apiKey}`,
              'revision': '2024-02-15',
              'Accept': 'application/json'
            }
          }
        );

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          result.error = `Search failed: ${searchResponse.status} - ${errorText}`;
          errorCount++;
          results.push(result);
          continue;
        }

        const searchData = await searchResponse.json();
        const profiles = searchData?.data || [];

        if (profiles.length === 0) {
          result.error = 'Profile not found on Klaviyo';
          results.push(result);
          continue;
        }

        const klaviyoProfileId = profiles[0].id;
        result.klaviyo_profile_id = klaviyoProfileId;

        if (dryRun) {
          // In dry-run mode, just mark as "would be deleted"
          result.deleted = false;
          result.error = 'DRY RUN - would delete';
          results.push(result);
          continue;
        }

        // Actually delete the profile from Klaviyo
        const deleteResponse = await fetch(
          `https://a.klaviyo.com/api/profiles/${klaviyoProfileId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Klaviyo-API-Key ${apiKey}`,
              'revision': '2024-02-15'
            }
          }
        );

        if (deleteResponse.ok || deleteResponse.status === 204) {
          result.deleted = true;
          deletedCount++;
          console.log(`Deleted Klaviyo profile ${klaviyoProfileId} for user ${userId}`);
        } else {
          const errorText = await deleteResponse.text();
          result.error = `Delete failed: ${deleteResponse.status} - ${errorText}`;
          errorCount++;
        }

      } catch (err) {
        result.error = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errorCount++;
      }

      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(
      JSON.stringify({
        message: dryRun 
          ? `DRY RUN: Found ${ghostUserIds.length} ghost profiles that would be deleted`
          : `Cleanup completed: deleted ${deletedCount} profiles`,
        dryRun,
        found: ghostUserIds.length,
        deleted: deletedCount,
        errors: errorCount,
        profiles: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
