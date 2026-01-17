import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * IdentitySync - Klaviyo Sync Function
 * 
 * Behavior Intelligence Layer - Syncs behavioral signals to Klaviyo
 * 
 * STRATEGY:
 * 1. ALWAYS update profile properties (sf_*) for users WITH email
 * 2. FORCE profile upsert when checkout_abandoned detected
 * 3. Only track HIGH-VALUE events as Klaviyo events
 * 4. Block noise events from event tracking (but still update profiles!)
 * 5. Use decisional flags to avoid duplicate syncs
 */

// ===== HIGH-VALUE EVENTS THAT TRIGGER KLAVIYO EVENT TRACKING =====
const HIGH_VALUE_EVENTS = new Set([
  // Cart events (intent signals)
  'Add to Cart',
  'Product Added',
  'Cart Viewed',
  
  // Checkout events (high intent) - All variants
  'Begin Checkout',
  'Checkout Started',
  'Started Checkout',
  'checkout_started',
  'begin_checkout',
  
  // Purchase events
  'Purchase',
  'Order Completed',
  'Placed Order',
  
  // Abandonment signals (valuable for flows)
  'Checkout Abandoned',
  'Cart Abandoned',
]);

// ===== EVENTS THAT BLOCK EVENT TRACKING (but still update profile!) =====
const BLOCKED_FROM_EVENTS = new Set([
  // Page events (aggregated into profile properties instead)
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
  
  // Email events (come from Klaviyo, no need to send back)
  'Received Email',
  'Opened Email',
  'Clicked Email',
  'Subscribed to List',
  
  // System/identify events
  'Customer Updated',
  '_sf_verification_ping',
]);

interface KlaviyoProfile {
  type: 'profile';
  id?: string;
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

async function upsertKlaviyoProfile(apiKey: string, profile: KlaviyoProfile, forcedReason?: string): Promise<{ success: boolean; error?: string; profileId?: string }> {
  const logPrefix = forcedReason ? `[SYNC][FORCED:${forcedReason}]` : '[SYNC]';
  console.log(`${logPrefix} Klaviyo profile upsert`);
  console.log(`${logPrefix} email=${profile.attributes.email}`);
  console.log(`${logPrefix} properties=[${Object.keys(profile.attributes.properties || {}).filter(k => k.startsWith('sf_')).join(', ')}]`);
  
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
    // Profile exists, update it
    const existing = await response.json();
    const profileId = existing?.errors?.[0]?.meta?.duplicate_profile_id;
    
    if (profileId) {
      console.log(`${logPrefix} Profile exists (${profileId}), updating...`);
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
        console.error(`${logPrefix} Update failed: ${error}`);
        return { success: false, error };
      }
      console.log(`${logPrefix} Profile updated successfully`);
      return { success: true, profileId };
    }
    return { success: true };
  }

  if (!response.ok) {
    const error = await response.text();
    console.error(`${logPrefix} Create failed: ${error}`);
    return { success: false, error };
  }

  const result = await response.json();
  console.log(`${logPrefix} Profile created successfully`);
  return { success: true, profileId: result?.data?.id };
}

async function trackKlaviyoEvent(apiKey: string, event: KlaviyoEvent): Promise<{ success: boolean; error?: string }> {
  console.log(`[SYNC] Tracking event: ${event.attributes.metric.data.attributes.name} for ${event.attributes.profile.data.attributes.email}`);
  
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
    console.error(`[SYNC] Event tracking failed: ${error}`);
    return { success: false, error };
  }

  console.log(`[SYNC] Event tracked successfully`);
  return { success: true };
}

/**
 * Check if an event should be sent as a Klaviyo event
 */
function shouldTrackAsEvent(eventName: string): boolean {
  // Normalize event name for comparison
  const normalized = eventName.toLowerCase().replace(/[_\s]/g, ' ').trim();
  
  // Check explicit blocks
  if (BLOCKED_FROM_EVENTS.has(eventName)) {
    return false;
  }
  
  // Check if it's a high-value event
  for (const highValue of HIGH_VALUE_EVENTS) {
    if (highValue.toLowerCase() === normalized || eventName === highValue) {
      return true;
    }
  }
  
  return false;
}

/**
 * Map event name to Klaviyo format with SF prefix
 */
function mapEventName(eventName: string): string {
  const normalized = eventName.toLowerCase().replace(/[_\s]/g, ' ').trim();
  
  const map: Record<string, string> = {
    'add to cart': 'SF Added to Cart',
    'product added': 'SF Added to Cart',
    'cart viewed': 'SF Viewed Cart',
    'begin checkout': 'SF Started Checkout',
    'checkout started': 'SF Started Checkout',
    'started checkout': 'SF Started Checkout',
    'purchase': 'SF Placed Order',
    'order completed': 'SF Placed Order',
    'placed order': 'SF Placed Order',
    'checkout abandoned': 'SF Checkout Abandoned',
    'cart abandoned': 'SF Cart Abandoned',
  };
  
  return map[normalized] || `SF ${eventName}`;
}

/**
 * Determine drop-off stage from event history and computed traits
 * Returns a DECISIONAL drop_off_stage value
 */
function determineDropOffStage(computed: Record<string, unknown>, eventType?: string, eventName?: string): string {
  // If they completed a purchase, they're not in a drop-off stage
  if (computed.orders_count && Number(computed.orders_count) > 0) {
    return 'purchased';
  }
  
  // Check based on current event (highest priority)
  if (eventType === 'checkout' || eventName?.toLowerCase().includes('checkout')) {
    return 'checkout_abandoned';
  }
  
  if (eventType === 'cart' || eventName?.toLowerCase().includes('cart')) {
    return 'cart_abandoned';
  }
  
  // Check existing computed values
  if (computed.checkout_abandoned_at) {
    return 'checkout_abandoned';
  }
  
  if (computed.cart_abandoned_at) {
    return 'cart_abandoned';
  }
  
  // Check existing drop_off_stage
  if (computed.drop_off_stage) {
    return computed.drop_off_stage as string;
  }
  
  // Default based on engagement
  const intentScore = Number(computed.intent_score) || 0;
  if (intentScore >= 30) {
    return 'engaged';
  }
  
  return 'browsing';
}

/**
 * Check if this user needs a FORCED profile sync
 * Returns reason string if forced, null otherwise
 * 
 * EXTENDED FUNNEL SYNC:
 * - Product View: sync if intent_score >= 30 (browse abandonment)
 * - Add to Cart: sync if intent_score >= 50 (cart abandonment)
 * - Checkout Started: always sync (checkout abandonment)
 */
function shouldForceProfileSync(
  computed: Record<string, unknown>, 
  flags: Record<string, unknown>,
  eventType?: string,
  eventName?: string
): string | null {
  const intentScore = Number(computed.intent_score) || 0;
  const dropOffStage = computed.drop_off_stage || determineDropOffStage(computed, eventType, eventName);
  
  // FORCE SYNC: checkout_abandoned - ALWAYS (highest priority)
  if (dropOffStage === 'checkout_abandoned' && !flags.checkout_abandoned_synced) {
    return 'checkout_abandoned';
  }
  
  // FORCE SYNC: cart event with intent >= 50
  const isCartEvent = eventType === 'cart' || 
    eventName?.toLowerCase().includes('cart') ||
    eventName?.toLowerCase().includes('add to cart') ||
    eventName === 'Product Added';
    
  if (isCartEvent && intentScore >= 50 && !flags.cart_synced) {
    return 'cart_high_intent';
  }
  
  // FORCE SYNC: cart_abandoned but never synced
  if (dropOffStage === 'cart_abandoned' && !flags.cart_abandoned_synced) {
    return 'cart_abandoned';
  }
  
  // FORCE SYNC: product view with intent >= 30
  const isProductEvent = eventType === 'product' || 
    eventName?.toLowerCase().includes('product') ||
    eventName === 'Product Viewed' ||
    eventName === 'View Item';
    
  if (isProductEvent && intentScore >= 30 && !flags.product_view_synced) {
    return 'product_high_intent';
  }
  
  // FORCE SYNC: first time seeing this user
  if (!flags.first_sync_completed) {
    return 'first_sync';
  }
  
  return null;
}

/**
 * Build behavioral profile properties from computed traits
 * These are synced to Klaviyo on EVERY event (not just high-value ones)
 * 
 * CRITICAL: These properties MUST always be sent to create them in Klaviyo
 * 
 * EXTENDED FUNNEL PROPERTIES:
 * - sf_last_product_viewed_at: for browse abandonment flows
 * - sf_last_cart_at: for cart abandonment flows
 * - sf_checkout_abandoned_at: for checkout abandonment flows
 */
function buildBehavioralProperties(user: {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  computed: Record<string, unknown>;
  customer_ids?: string[];
  anonymous_ids?: string[];
  traits?: Record<string, unknown>;
}, eventType?: string, eventName?: string, predictiveSignals?: Array<{
  signal_type: string;
  signal_name: string;
  confidence: number;
  flow_name: string | null;
}>): Record<string, unknown> {
  const computed = user.computed || {};
  const now = new Date().toISOString();
  
  // Determine drop-off stage (DECISIONAL)
  const dropOffStage = determineDropOffStage(computed, eventType, eventName);
  
  // Set abandonment timestamps based on stage
  let checkoutAbandonedAt = computed.checkout_abandoned_at ?? null;
  let cartAbandonedAt = computed.cart_abandoned_at ?? null;
  let lastProductViewedAt = computed.last_product_viewed_at ?? null;
  let lastCartAt = computed.last_cart_at ?? null;
  
  // CRITICAL: Set timestamp when stage is detected
  if (dropOffStage === 'checkout_abandoned' && !checkoutAbandonedAt) {
    checkoutAbandonedAt = now;
  }
  if (dropOffStage === 'cart_abandoned' && !cartAbandonedAt) {
    cartAbandonedAt = now;
  }
  
  // Track product view timestamp for browse abandonment
  const isProductEvent = eventType === 'product' || 
    eventName?.toLowerCase().includes('product') ||
    eventName === 'Product Viewed';
  if (isProductEvent) {
    lastProductViewedAt = now;
  }
  
  // Track cart timestamp for cart abandonment
  const isCartEvent = eventType === 'cart' || 
    eventName?.toLowerCase().includes('cart') ||
    eventName === 'Product Added';
  if (isCartEvent) {
    lastCartAt = now;
  }

  // Build predictive signal properties
  let predictiveProps: Record<string, unknown> = {};
  if (predictiveSignals && predictiveSignals.length > 0) {
    // Get the highest confidence signal
    const topSignal = predictiveSignals.reduce((a, b) => 
      a.confidence > b.confidence ? a : b
    );
    
    predictiveProps = {
      // Primary predictive signal
      sf_predicted_action: topSignal.signal_type,
      sf_predicted_confidence: topSignal.confidence,
      sf_predicted_flow: topSignal.flow_name,
      
      // All active signals as array
      sf_active_signals: predictiveSignals.map(s => s.signal_type).join(','),
      sf_signals_count: predictiveSignals.length,
      
      // Specific signal flags for Klaviyo flow triggers
      sf_is_high_intent_cart: predictiveSignals.some(s => s.signal_type === 'high_intent_cart'),
      sf_is_checkout_urgent: predictiveSignals.some(s => s.signal_type === 'checkout_urgency'),
      sf_is_browse_warming: predictiveSignals.some(s => s.signal_type === 'browse_warming'),
      sf_is_churn_risk: predictiveSignals.some(s => s.signal_type === 'churn_risk'),
      sf_is_about_to_purchase: predictiveSignals.some(s => s.signal_type === 'about_to_purchase'),
      
      // Timestamp for flow timing
      sf_predicted_at: now,
    };
  }
  
  return {
    // === IDENTIFICATION ===
    sf_unified_user_id: user.id,
    sf_first_seen_at: user.first_seen_at,
    sf_last_seen_at: now, // Always update to current time
    
    // === CORE BEHAVIORAL SCORES ===
    sf_intent_score: computed.intent_score ?? 0,
    sf_frequency_score: computed.frequency_score ?? 10,
    sf_depth_score: computed.depth_score ?? 0,
    sf_recency_days: computed.recency_days ?? 0,
    
    // === BEHAVIORAL SIGNALS (KEY FOR FLOWS!) ===
    sf_top_category: computed.top_category_30d ?? computed.top_category ?? null,
    sf_dropoff_stage: dropOffStage, // CRITICAL: This triggers flows!
    
    // === ENGAGEMENT COUNTS ===
    sf_viewed_products_7d: computed.unique_products_viewed ?? computed.product_views_7d ?? 0,
    sf_categories_viewed: computed.unique_categories_viewed ?? 0,
    sf_session_count_30d: computed.session_count_30d ?? 1,
    
    // === FUNNEL TIMESTAMPS (EXTENDED - FOR ALL FLOW TRIGGERS!) ===
    sf_last_product_viewed_at: lastProductViewedAt,  // NEW: Browse abandonment trigger
    sf_last_cart_at: lastCartAt,                      // NEW: Cart abandonment trigger  
    sf_cart_abandoned_at: cartAbandonedAt,
    sf_checkout_abandoned_at: checkoutAbandonedAt,
    
    // === REVENUE METRICS ===
    sf_lifetime_value: computed.lifetime_value ?? 0,
    sf_orders_count: computed.orders_count ?? 0,
    
    // === EMAIL ENGAGEMENT (from Klaviyo webhooks) ===
    sf_email_opens_30d: computed.email_opens_30d ?? 0,
    sf_email_clicks_30d: computed.email_clicks_30d ?? 0,
    sf_email_engagement_score: computed.email_engagement_score ?? 0,
    sf_is_subscribed: computed.is_subscribed ?? null,
    sf_last_klaviyo_event: computed.last_klaviyo_event ?? null,
    
    // === PREDICTIVE SIGNALS (NEW!) ===
    ...predictiveProps,
    
    // === METADATA ===
    sf_last_event_type: eventType ?? computed.last_event_type ?? null,
    sf_last_event_name: eventName ?? computed.last_event_name ?? null,
    sf_computed_at: now,
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

    console.log('[sync-klaviyo] Starting sync run...');

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
      console.error('[sync-klaviyo] Error fetching sync jobs:', jobsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sync jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log('[sync-klaviyo] No pending jobs');
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-klaviyo] Processing ${jobs.length} jobs...`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    let profileUpdates = 0;
    let profileUpdatesForced = 0;
    let eventsSent = 0;
    let eventsBlocked = 0;
    let flagsUpdated = 0;

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

      const user = job.unified_user;
      const event = job.event;

      // ⛔ SKIP: Users without email (prevents ghost profiles)
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

      let profileResult: { success: boolean; error?: string } = { success: true };
      let eventResult: { success: boolean; error?: string } | null = null;
      let eventBlocked = false;

      // Get event details for context
      const eventName = event?.event_name || event?.event_type || '';
      const eventType = event?.event_type || '';
      
      // Get user flags for decisional logic
      const computed = (user.computed || {}) as Record<string, unknown>;
      const flags = (computed.flags || {}) as Record<string, unknown>;
      
      // Check if forced sync is needed (now with event context for intent filtering)
      const forceReason = shouldForceProfileSync(computed, flags, eventType, eventName);

      // ===== STEP 1: FETCH PREDICTIVE SIGNALS FOR THIS USER =====
      const { data: predictiveSignals } = await supabase
        .from('predictive_signals')
        .select('signal_type, signal_name, confidence, flow_name, should_trigger_flow, id')
        .eq('unified_user_id', user.id)
        .is('flow_triggered_at', null); // Only pending signals

      // ===== STEP 2: ALWAYS UPDATE PROFILE WITH PREDICTIVE SIGNALS =====
      // This ensures sf_* properties are ALWAYS synced to Klaviyo
      const behavioralProps = buildBehavioralProperties(user, eventType, eventName, predictiveSignals || []);
      
      const profile: KlaviyoProfile = {
        type: 'profile',
        attributes: {
          email: user.primary_email,
          phone_number: user.phone || undefined,
          external_id: user.id,
          properties: behavioralProps,
        },
      };
      
      profileResult = await upsertKlaviyoProfile(klaviyoApiKey, profile, forceReason || undefined);
      
      if (profileResult.success) {
        profileUpdates++;
        if (forceReason) {
          profileUpdatesForced++;
          console.log(`[DECISION] Forced profile sync: ${forceReason} for ${user.primary_email}`);
        }
        
        // Update flags to mark sync completed
        const updatedFlags: Record<string, unknown> = { ...flags, first_sync_completed: true };
        const dropOffStage = behavioralProps.sf_dropoff_stage;
        
        // Mark checkout abandoned synced
        if (dropOffStage === 'checkout_abandoned') {
          updatedFlags.checkout_abandoned_synced = true;
          updatedFlags.checkout_abandoned_synced_at = new Date().toISOString();
        }
        
        // Mark cart abandoned synced
        if (dropOffStage === 'cart_abandoned') {
          updatedFlags.cart_abandoned_synced = true;
          updatedFlags.cart_abandoned_synced_at = new Date().toISOString();
        }
        
        // Mark cart synced (high intent cart event)
        if (forceReason === 'cart_high_intent') {
          updatedFlags.cart_synced = true;
          updatedFlags.cart_synced_at = new Date().toISOString();
        }
        
        // Mark product view synced (high intent product event)
        if (forceReason === 'product_high_intent') {
          updatedFlags.product_view_synced = true;
          updatedFlags.product_view_synced_at = new Date().toISOString();
        }
        
        // Persist flags and computed updates
        const updatedComputed = {
          ...computed,
          flags: updatedFlags,
          drop_off_stage: dropOffStage,
          checkout_abandoned_at: behavioralProps.sf_checkout_abandoned_at,
          cart_abandoned_at: behavioralProps.sf_cart_abandoned_at,
          last_product_viewed_at: behavioralProps.sf_last_product_viewed_at,
          last_cart_at: behavioralProps.sf_last_cart_at,
          last_synced_at: new Date().toISOString(),
        };
        
        await supabase
          .from('users_unified')
          .update({ computed: updatedComputed })
          .eq('id', user.id);
        
        flagsUpdated++;
        
        // ===== STEP 3: TRIGGER PREDICTIVE FLOW EVENTS =====
        if (predictiveSignals && predictiveSignals.length > 0) {
          for (const signal of predictiveSignals) {
            if (signal.should_trigger_flow && signal.flow_name) {
              // Send a Klaviyo event to trigger the flow
              const flowEvent: KlaviyoEvent = {
                type: 'event',
                attributes: {
                  metric: {
                    data: {
                      type: 'metric',
                      attributes: { name: signal.flow_name },
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
                  properties: {
                    signal_type: signal.signal_type,
                    signal_name: signal.signal_name,
                    confidence: signal.confidence,
                    sf_intent_score: computed.intent_score ?? 0,
                    sf_dropoff_stage: behavioralProps.sf_dropoff_stage,
                    triggered_at: new Date().toISOString(),
                  },
                  time: new Date().toISOString(),
                  unique_id: `predictive_${signal.id}_${Date.now()}`,
                },
              };
              
              const flowResult = await trackKlaviyoEvent(klaviyoApiKey, flowEvent);
              
              if (flowResult.success) {
                console.log(`[PREDICTIVE] Flow triggered: ${signal.flow_name} for ${user.primary_email}`);
                
                // Mark signal as triggered
                await supabase
                  .from('predictive_signals')
                  .update({ 
                    flow_triggered_at: new Date().toISOString(),
                    should_trigger_flow: false,
                    synced_to: { klaviyo: new Date().toISOString() },
                    last_synced_at: new Date().toISOString()
                  })
                  .eq('id', signal.id);
              } else {
                console.error(`[PREDICTIVE] Flow trigger failed: ${signal.flow_name}`, flowResult.error);
              }
            }
          }
        }
      }

      // ===== STEP 2: CONDITIONALLY TRACK EVENT =====
      if (job.job_type === 'event_track' && event) {
        if (shouldTrackAsEvent(eventName)) {
          // This is a high-value event, track it!
          const klaviyoEventName = mapEventName(eventName);
          
          const enrichedProperties = {
            ...(event.properties as Record<string, unknown>),
            sf_event_id: event.id,
            sf_session_id: event.session_id,
            sf_intent_score: computed.intent_score ?? 0,
            sf_dropoff_stage: behavioralProps.sf_dropoff_stage,
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
          
          eventResult = await trackKlaviyoEvent(klaviyoApiKey, klaviyoEvent);
          if (eventResult.success) {
            eventsSent++;
          }
        } else {
          // Event blocked from tracking (but profile was still updated!)
          eventBlocked = true;
          eventsBlocked++;
          console.log(`[SYNC] Event blocked from tracking: ${eventName} (profile still updated)`);
        }
      }

      // Determine overall success
      const overallSuccess = profileResult.success && (!eventResult || eventResult.success);

      if (overallSuccess) {
        const note = eventBlocked 
          ? `Profile updated, event blocked: ${eventName}` 
          : eventResult 
            ? 'Profile + Event synced' 
            : 'Profile synced';
            
        await supabase
          .from('sync_jobs')
          .update({ 
            status: 'completed', 
            last_error: eventBlocked ? `Blocked event: ${eventName}` : null,
            completed_at: new Date().toISOString() 
          })
          .eq('id', job.id);
        successCount++;
        
        // Update destination last_sync_at
        await supabase
          .from('destinations')
          .update({ last_sync_at: new Date().toISOString(), last_error: null })
          .eq('id', destination.id);
          
        // Mark event as synced
        if (event && !eventBlocked) {
          await supabase
            .from('events')
            .update({ synced_at: new Date().toISOString(), status: 'synced' })
            .eq('id', event.id);
        }
      } else {
        const error = profileResult.error || eventResult?.error || 'Unknown error';
        const newStatus = job.attempts >= 2 ? 'failed' : 'pending';
        const scheduledAt = job.attempts >= 2 
          ? null 
          : new Date(Date.now() + Math.pow(2, job.attempts) * 60000).toISOString();
        
        await supabase
          .from('sync_jobs')
          .update({ 
            status: newStatus,
            last_error: error,
            scheduled_at: scheduledAt,
            completed_at: newStatus === 'failed' ? new Date().toISOString() : null
          })
          .eq('id', job.id);
        
        if (newStatus === 'failed') {
          failCount++;
          await supabase
            .from('destinations')
            .update({ last_error: error })
            .eq('id', destination.id);
        }
      }
    }

    const summary = {
      message: 'Sync completed - Behavior Intelligence Mode',
      processed: jobs.length,
      success: successCount,
      failed: failCount,
      skipped: skippedCount,
      profileUpdates,
      profileUpdatesForced,
      eventsSent,
      eventsBlocked,
      flagsUpdated,
      note: 'Profile properties (sf_*) are ALWAYS updated. Forced syncs ensure abandonment properties exist.',
    };
    
    console.log('[sync-klaviyo] Summary:', JSON.stringify(summary));

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-klaviyo] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
