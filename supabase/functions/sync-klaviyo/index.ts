import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * IdentitySync - Klaviyo Sync Function
 * 
 * Behavior Intelligence Layer - Only syncs HIGH-VALUE signals
 * 
 * ✅ What gets synced:
 * - Profile properties with behavioral scores (sf_intent_score, sf_drop_off_stage, etc.)
 * - High-value trigger events (SF High Intent Detected, SF Dropped From Checkout, etc.)
 * 
 * ❌ What gets BLOCKED:
 * - Raw page views, product views, scroll events
 * - Users without email (prevents ghost profiles)
 * - Duplicate events
 */

// ===== HIGH-VALUE EVENTS THAT TRIGGER KLAVIYO TRACKING =====
const HIGH_VALUE_EVENTS = new Set([
  // Cart events (intent signals)
  'Add to Cart',
  'Product Added',
  'Cart Viewed',
  
  // Checkout events (high intent)
  'Begin Checkout',
  'Checkout Started',
  
  // Purchase events
  'Purchase',
  'Order Completed',
]);

// ===== BLOCKED EVENTS (noise) =====
const BLOCKED_EVENTS = new Set([
  // Page events (aggregated instead)
  'Page View',
  'Session Start',
  'Scroll Depth',
  'Time on Page',
  'Exit Intent',
  
  // Product views (aggregated into depth score)
  'Product Viewed',
  'View Item',
  'View Category',
  'Product Click',
  'Search',
  
  // Form events
  'Form Viewed',
  'Form Submitted',
]);

interface KlaviyoProfile {
  type: 'profile';
  attributes: {
    email?: string;
    phone_number?: string;
    external_id?: string;
    properties?: Record<string, unknown>;
  };
}

interface KlaviyoEvent {
  type: 'event';
  attributes: {
    metric: {
      data: {
        type: 'metric';
        attributes: { name: string };
      };
    };
    profile: {
      data: {
        type: 'profile';
        attributes: {
          email?: string;
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

/**
 * Check if an event should be sent to Klaviyo
 */
function shouldSendEvent(eventName: string): boolean {
  // Explicitly blocked events
  if (BLOCKED_EVENTS.has(eventName)) {
    return false;
  }
  // Only allow high-value events
  return HIGH_VALUE_EVENTS.has(eventName);
}

/**
 * Map event name to Klaviyo format with SF prefix
 */
function mapEventName(eventName: string): string {
  const map: Record<string, string> = {
    'Add to Cart': 'SF Added to Cart',
    'Product Added': 'SF Added to Cart',
    'Cart Viewed': 'SF Viewed Cart',
    'Begin Checkout': 'SF Started Checkout',
    'Checkout Started': 'SF Started Checkout',
    'Purchase': 'SF Placed Order',
    'Order Completed': 'SF Placed Order',
  };
  return map[eventName] || `SF ${eventName}`;
}

/**
 * Build behavioral profile properties from computed traits
 * These are the ONLY properties synced to Klaviyo
 */
function buildBehavioralProperties(user: {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  computed: Record<string, unknown>;
  customer_ids?: string[];
  anonymous_ids?: string[];
  traits?: Record<string, unknown>;
}): Record<string, unknown> {
  const computed = user.computed || {};
  
  return {
    // === IDENTIFICATION ===
    sf_unified_user_id: user.id,
    sf_first_seen_at: user.first_seen_at,
    sf_last_seen_at: user.last_seen_at,
    
    // === CORE BEHAVIORAL SCORES ===
    sf_intent_score: computed.intent_score ?? 0,
    sf_frequency_score: computed.frequency_score ?? 10,
    sf_depth_score: computed.depth_score ?? 0,
    sf_recency_days: computed.recency_days ?? 0,
    
    // === BEHAVIORAL SIGNALS ===
    sf_top_category: computed.top_category_30d ?? null,
    sf_drop_off_stage: computed.drop_off_stage ?? 'visitor',
    
    // === ENGAGEMENT COUNTS ===
    sf_viewed_products_7d: computed.unique_products_viewed ?? 0,
    sf_categories_viewed: computed.unique_categories_viewed ?? 0,
    sf_session_count_30d: computed.session_count_30d ?? 1,
    
    // === ABANDONMENT TIMESTAMPS (for flow triggers) ===
    sf_cart_abandoned_at: computed.cart_abandoned_at ?? null,
    sf_checkout_abandoned_at: computed.checkout_abandoned_at ?? null,
    
    // === REVENUE METRICS ===
    sf_lifetime_value: computed.lifetime_value ?? 0,
    sf_orders_count: computed.orders_count ?? 0,
    
    // === METADATA ===
    sf_computed_at: computed.last_computed_at ?? null,
    sf_customer_ids: user.customer_ids && user.customer_ids.length > 0 ? user.customer_ids.join(',') : null,
    sf_anonymous_ids_count: user.anonymous_ids?.length ?? 0,
  };
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
    let skippedCount = 0;
    let blockedCount = 0;

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
        
        // ⛔ SKIP: Non sincronizzare profili senza email (prevents ghost profiles)
        if (!user.primary_email) {
          await supabase
            .from('sync_jobs')
            .update({ 
              status: 'completed', 
              last_error: 'Skipped - no email (identity not resolved)',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
          skippedCount++;
          continue;
        }
        
        const profile: KlaviyoProfile = {
          type: 'profile',
          attributes: {
            email: user.primary_email,
            phone_number: user.phone || undefined,
            external_id: user.id,
            properties: buildBehavioralProperties(user),
          },
        };
        result = await upsertKlaviyoProfile(klaviyoApiKey, profile);
        
      } else if (job.job_type === 'event_track' && job.event) {
        const event = job.event;
        const user = job.unified_user;
        
        // ⛔ SKIP: Non tracciare eventi per utenti senza email
        if (!user?.primary_email) {
          await supabase
            .from('sync_jobs')
            .update({ 
              status: 'completed', 
              last_error: 'Skipped - no email',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
          skippedCount++;
          continue;
        }
        
        // ⛔ BLOCK: Non inviare eventi a basso valore (noise)
        const eventName = event.event_name || event.event_type;
        if (!shouldSendEvent(eventName)) {
          await supabase
            .from('sync_jobs')
            .update({ 
              status: 'completed', 
              last_error: `Blocked - low-value event: ${eventName}`,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
          blockedCount++;
          continue;
        }
        
        const klaviyoEventName = mapEventName(eventName);
        
        // Enrich event with behavioral context
        const enrichedProperties = {
          ...(event.properties as Record<string, unknown>),
          sf_event_id: event.id,
          sf_session_id: event.session_id,
          sf_intent_score: user.computed?.intent_score ?? 0,
          sf_drop_off_stage: user.computed?.drop_off_stage ?? 'visitor',
        };
        
        const klaviyoEvent: KlaviyoEvent = {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: { name: klaviyoEventName },
              },
            },
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: user.primary_email,
                  external_id: user.id,
                },
              },
            },
            properties: enrichedProperties,
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
          : new Date(Date.now() + Math.pow(2, job.attempts) * 60000).toISOString();
        
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
        message: 'Sync completed - Behavior Intelligence Mode',
        processed: jobs.length,
        success: successCount,
        failed: failCount,
        skipped: skippedCount,
        blocked: blockedCount,
        note: 'Low-value events (page views, product views) are blocked. Only high-intent actions synced.',
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
