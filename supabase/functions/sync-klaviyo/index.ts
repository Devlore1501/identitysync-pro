import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface KlaviyoProfile {
  type: 'profile';
  attributes: {
    email?: string;
    phone_number?: string;
    external_id?: string;
    first_name?: string;
    last_name?: string;
    properties?: Record<string, unknown>;
  };
}

interface KlaviyoEvent {
  type: 'event';
  attributes: {
    metric: {
      data: {
        type: 'metric';
        attributes: {
          name: string;
        };
      };
    };
    profile: {
      data: {
        type: 'profile';
        attributes: {
          email?: string;
          phone_number?: string;
          external_id?: string;
        };
      };
    };
    properties?: Record<string, unknown>;
    time?: string;
    unique_id?: string;
  };
}

async function upsertKlaviyoProfile(apiKey: string, profile: KlaviyoProfile): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('https://a.klaviyo.com/api/profiles/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/json',
      'revision': '2024-02-15',
    },
    body: JSON.stringify({ data: profile }),
  });

  if (response.status === 409) {
    // Profile exists, try to update
    const existing = await response.json();
    const profileId = existing?.errors?.[0]?.meta?.duplicate_profile_id;
    
    if (profileId) {
      const updateResponse = await fetch(`https://a.klaviyo.com/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15',
        },
        body: JSON.stringify({ data: { ...profile, id: profileId } }),
      });
      
      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        return { success: false, error };
      }
    }
    return { success: true };
  }

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }

  return { success: true };
}

async function trackKlaviyoEvent(apiKey: string, event: KlaviyoEvent): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('https://a.klaviyo.com/api/events/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/json',
      'revision': '2024-02-15',
    },
    body: JSON.stringify({ data: event }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending sync jobs (limit to 50 per run)
    const { data: jobs, error: jobsError } = await supabase
      .from('sync_jobs')
      .select(`
        *,
        destination:destinations(*),
        unified_user:users_unified(*),
        event:events(*)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .lt('attempts', 3)
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (jobsError) {
      console.error('Error fetching sync jobs:', jobsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sync jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let failCount = 0;

    for (const job of jobs) {
      // Mark as running
      await supabase
        .from('sync_jobs')
        .update({ 
          status: 'running', 
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1 
        })
        .eq('id', job.id);

      const destination = job.destination;
      if (!destination || destination.type !== 'klaviyo' || !destination.enabled) {
        await supabase
          .from('sync_jobs')
          .update({ 
            status: 'failed', 
            last_error: 'Destination not configured or disabled',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
        failCount++;
        continue;
      }

      const klaviyoApiKey = destination.config?.api_key as string;
      if (!klaviyoApiKey) {
        await supabase
          .from('sync_jobs')
          .update({ 
            status: 'failed', 
            last_error: 'Klaviyo API key not configured',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
        failCount++;
        continue;
      }

      let result: { success: boolean; error?: string };

      if (job.job_type === 'profile_upsert' && job.unified_user) {
        const user = job.unified_user;
        const profile: KlaviyoProfile = {
          type: 'profile',
          attributes: {
            email: user.primary_email || undefined,
            phone_number: user.phone || undefined,
            external_id: user.id,
            properties: {
              sf_unified_user_id: user.id,
              sf_first_seen_at: user.first_seen_at,
              sf_last_seen_at: user.last_seen_at,
              ...user.traits,
              ...user.computed,
            },
          },
        };
        result = await upsertKlaviyoProfile(klaviyoApiKey, profile);
      } else if (job.job_type === 'event_track' && job.event) {
        const event = job.event;
        const user = job.unified_user;
        
        // Map SignalForge events to Klaviyo events
        const eventNameMap: Record<string, string> = {
          'page_view': 'SF Page View',
          'view_item': 'SF Viewed Product',
          'add_to_cart': 'SF Added to Cart',
          'begin_checkout': 'SF Started Checkout',
          'purchase': 'SF Placed Order',
        };
        
        const klaviyoEventName = eventNameMap[event.event_type] || `SF ${event.event_name}`;
        
        const klaviyoEvent: KlaviyoEvent = {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: {
                  name: klaviyoEventName,
                },
              },
            },
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: user?.primary_email || undefined,
                  external_id: user?.id || event.anonymous_id,
                },
              },
            },
            properties: event.properties as Record<string, unknown>,
            time: event.event_time,
            unique_id: event.id,
          },
        };
        result = await trackKlaviyoEvent(klaviyoApiKey, klaviyoEvent);
      } else {
        result = { success: false, error: 'Unknown job type or missing data' };
      }

      if (result.success) {
        await supabase
          .from('sync_jobs')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString() 
          })
          .eq('id', job.id);
        successCount++;
        
        // Update destination last_sync_at
        await supabase
          .from('destinations')
          .update({ last_sync_at: new Date().toISOString(), last_error: null })
          .eq('id', destination.id);
      } else {
        const newStatus = job.attempts >= 2 ? 'failed' : 'pending';
        const scheduledAt = job.attempts >= 2 
          ? null 
          : new Date(Date.now() + Math.pow(2, job.attempts) * 60000).toISOString(); // Exponential backoff
        
        await supabase
          .from('sync_jobs')
          .update({ 
            status: newStatus,
            last_error: result.error,
            scheduled_at: scheduledAt,
            completed_at: newStatus === 'failed' ? new Date().toISOString() : null
          })
          .eq('id', job.id);
        
        if (newStatus === 'failed') {
          failCount++;
          await supabase
            .from('destinations')
            .update({ last_error: result.error })
            .eq('id', destination.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Sync completed',
        processed: jobs.length,
        success: successCount,
        failed: failCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
