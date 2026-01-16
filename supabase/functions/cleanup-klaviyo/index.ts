import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface GhostProfile {
  klaviyo_profile_id: string;
  external_id?: string;
  deleted: boolean;
  error?: string;
}

interface KlaviyoProfile {
  id: string;
  attributes: {
    email?: string;
    external_id?: string;
  };
}

interface KlaviyoResponse {
  data: KlaviyoProfile[];
  links?: {
    next?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log('Fetching ALL profiles from Klaviyo...');

    // Fetch ALL profiles from Klaviyo with pagination
    const allProfiles: KlaviyoProfile[] = [];
    let nextUrl: string | null = 'https://a.klaviyo.com/api/profiles/?page[size]=100&fields[profile]=email,external_id';

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'revision': '2024-02-15',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ error: `Failed to fetch profiles: ${response.status} - ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data: KlaviyoResponse = await response.json();
      allProfiles.push(...data.data);

      // Get next page URL
      nextUrl = data.links?.next || null;

      console.log(`Fetched ${allProfiles.length} profiles so far...`);

      // Small delay to avoid rate limiting
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Total profiles fetched: ${allProfiles.length}`);

    // Filter ghost profiles: have external_id but NO email
    const ghostProfiles = allProfiles.filter(p => 
      p.attributes.external_id && !p.attributes.email
    );

    console.log(`Found ${ghostProfiles.length} ghost profiles (have external_id, no email)`);

    if (ghostProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No ghost profiles found on Klaviyo',
          dryRun,
          totalProfiles: allProfiles.length,
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

    // Process each ghost profile
    for (const profile of ghostProfiles) {
      const result: GhostProfile = {
        klaviyo_profile_id: profile.id,
        external_id: profile.attributes.external_id,
        deleted: false
      };

      if (dryRun) {
        result.error = 'DRY RUN - would delete';
        results.push(result);
        continue;
      }

      try {
        // Create a Data Privacy Deletion Job
        const deleteResponse = await fetch(
          'https://a.klaviyo.com/api/data-privacy-deletion-jobs/',
          {
            method: 'POST',
            headers: {
              'Authorization': `Klaviyo-API-Key ${apiKey}`,
              'revision': '2024-02-15',
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              data: {
                type: 'data-privacy-deletion-job',
                attributes: {
                  profile: {
                    data: {
                      type: 'profile',
                      id: profile.id
                    }
                  }
                }
              }
            })
          }
        );

        if (deleteResponse.status === 202 || deleteResponse.ok) {
          result.deleted = true;
          deletedCount++;
          console.log(`Deletion job created for profile ${profile.id} (external_id: ${profile.attributes.external_id})`);
        } else {
          const errorText = await deleteResponse.text();
          result.error = `Deletion failed: ${deleteResponse.status} - ${errorText}`;
          errorCount++;
        }
      } catch (err) {
        result.error = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errorCount++;
      }

      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    return new Response(
      JSON.stringify({
        message: dryRun 
          ? `DRY RUN: Found ${ghostProfiles.length} ghost profiles that would be deleted`
          : `Cleanup completed: ${deletedCount} deletion jobs created`,
        dryRun,
        totalProfiles: allProfiles.length,
        found: ghostProfiles.length,
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
