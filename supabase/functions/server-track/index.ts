import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

/**
 * Server-Side Tracking Endpoint - IDEMPOTENT
 * 
 * Receives events directly from server (Shopify ScriptTag, webhooks, etc.)
 * Bypasses browser completely - immune to AdBlock and cookie blockers
 * 
 * Features:
 * - Server-side fingerprinting (IP + UA hash)
 * - Identity stitching when email provided
 * - Retroactive event attribution
 * - IDEMPOTENT: Uses checkout_id/cart_token/order_id for dedupe
 */

interface ServerTrackPayload {
  // Event data
  event_type: string;
  event_name: string;
  properties?: Record<string, unknown>;
  
  // Identity data
  anonymous_id?: string;
  email?: string;
  customer_id?: string;
  phone?: string;
  
  // Transaction identifiers (at least one required for checkout/cart/order events)
  checkout_id?: string;
  cart_token?: string;
  order_id?: string;
  
  // Server fingerprint
  client_ip?: string;
  user_agent?: string;
  
  // Metadata
  source?: string;
  timestamp?: string;
}

function generateFingerprint(ip: string, userAgent: string): string {
  const data = `${ip}|${userAgent}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Generate idempotent dedupe key
 * Priority: checkout_id > cart_token > order_id > anonymous_id+session+time
 */
function generateDedupeKey(
  workspaceId: string,
  eventName: string,
  properties: Record<string, unknown>,
  anonymousId: string | null,
  eventTime: string
): string {
  const primaryKey = 
    properties.checkout_id ||
    properties.checkout_token ||
    properties.cart_token ||
    properties.order_id ||
    properties.order_number ||
    properties.token;
  
  if (primaryKey) {
    // Transaction-based fingerprint - truly idempotent
    const key = `${workspaceId}::${eventName}::${primaryKey}`;
    return btoa(key).slice(0, 64);
  }
  
  // Fallback: round timestamp to 5 minutes
  const time = new Date(eventTime);
  const roundedMinutes = Math.floor(time.getMinutes() / 5) * 5;
  time.setMinutes(roundedMinutes, 0, 0);
  
  const key = `${workspaceId}::${eventName}::${anonymousId || ''}::${time.toISOString().slice(0, 16)}`;
  return btoa(key).slice(0, 64);
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authResult = await validateApiKey(apiKey);
    
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check scope for server_track
    if (!authResult.scopes?.includes('server_track') && !authResult.scopes?.includes('collect')) {
      return new Response(
        JSON.stringify({ error: 'API key does not have server_track scope' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: ServerTrackPayload = await req.json();
    const workspaceId = authResult.workspaceId!;

    // VALIDATION: For checkout/cart/order events, require at least one identifier
    const eventType = payload.event_type?.toLowerCase() || '';
    const eventName = payload.event_name?.toLowerCase() || '';
    
    const isTransactionEvent = 
      eventType === 'checkout' || 
      eventType === 'cart' || 
      eventType === 'order' ||
      eventName.includes('checkout') ||
      eventName.includes('cart') ||
      eventName.includes('order');
    
    const hasTransactionId = 
      payload.checkout_id || 
      payload.cart_token || 
      payload.order_id ||
      payload.properties?.checkout_id ||
      payload.properties?.cart_token ||
      payload.properties?.order_id;
    
    if (isTransactionEvent && !hasTransactionId && !payload.anonymous_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Transaction events require at least one identifier: checkout_id, cart_token, order_id, or anonymous_id',
          event_type: payload.event_type,
          event_name: payload.event_name
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get server-side fingerprint data
    const clientIp = payload.client_ip || 
                     req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';
    const userAgent = payload.user_agent || 
                      req.headers.get('user-agent') || 
                      'unknown';

    // Merge transaction IDs into properties
    const properties: Record<string, unknown> = {
      ...payload.properties,
      ...(payload.checkout_id && { checkout_id: payload.checkout_id }),
      ...(payload.cart_token && { cart_token: payload.cart_token }),
      ...(payload.order_id && { order_id: payload.order_id }),
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate server-side fingerprint if no anonymous_id provided
    let effectiveAnonymousId = payload.anonymous_id;
    if (!effectiveAnonymousId && clientIp !== 'unknown') {
      effectiveAnonymousId = generateFingerprint(clientIp, userAgent);
    }

    const eventTime = payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString();

    // Generate idempotent dedupe key
    const dedupeKey = generateDedupeKey(
      workspaceId,
      payload.event_name,
      properties,
      effectiveAnonymousId || null,
      eventTime
    );

    // STRUCTURED LOGGING
    console.log(JSON.stringify({
      fn: 'server-track',
      workspace_id: workspaceId,
      event_name: payload.event_name,
      event_type: payload.event_type,
      anonymous_id: effectiveAnonymousId,
      email: payload.email ? '***' : null,
      customer_id: payload.customer_id,
      checkout_id: payload.checkout_id || properties.checkout_id,
      cart_token: payload.cart_token || properties.cart_token,
      order_id: payload.order_id || properties.order_id,
      fingerprint: dedupeKey.slice(0, 16) + '...',
      client_ip: clientIp.slice(0, 10) + '...',
      ts: new Date().toISOString()
    }));

    // Use process_event_fast for consistent processing
    const { data: result, error: processError } = await supabase.rpc('process_event_fast', {
      p_workspace_id: workspaceId,
      p_event_type: payload.event_type,
      p_event_name: payload.event_name,
      p_properties: properties,
      p_context: {
        ip: clientIp,
        user_agent: userAgent,
        server_side: true,
        source: payload.source || 'server-track'
      },
      p_anonymous_id: effectiveAnonymousId,
      p_email: payload.email,
      p_phone: payload.phone,
      p_customer_id: payload.customer_id,
      p_source: payload.source || 'server-track',
      p_session_id: null,
      p_consent_state: null,
      p_event_time: eventTime
    });

    if (processError) {
      console.error(JSON.stringify({
        fn: 'server-track',
        error: 'process_event_fast failed',
        message: processError.message,
        code: processError.code,
        ts: new Date().toISOString()
      }));
      
      return new Response(
        JSON.stringify({ error: 'Failed to process event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventResult = result?.[0];
    if (!eventResult) {
      return new Response(
        JSON.stringify({ error: 'No result from event processing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { event_id: eventId, unified_user_id: unifiedUserId, is_duplicate: isDuplicate } = eventResult;

    // If duplicate, return early
    if (isDuplicate) {
      console.log(JSON.stringify({
        fn: 'server-track',
        action: 'duplicate_detected',
        event_id: eventId,
        unified_user_id: unifiedUserId,
        fingerprint: dedupeKey.slice(0, 16) + '...',
        duration_ms: Date.now() - startTime,
        ts: new Date().toISOString()
      }));
      
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          event_id: eventId,
          unified_user_id: unifiedUserId,
          message: 'Duplicate event - state updated, no new record created'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update computed traits (background, non-blocking)
    try {
      await supabase.rpc('update_computed_traits_fast', {
        p_unified_user_id: unifiedUserId,
        p_event_type: payload.event_type,
        p_event_name: payload.event_name,
        p_properties: properties
      });
    } catch (err) {
      console.error(JSON.stringify({
        fn: 'server-track',
        error: 'update_computed_traits_fast failed',
        message: err instanceof Error ? err.message : 'Unknown error',
        ts: new Date().toISOString()
      }));
    }

    // Schedule sync jobs if user has email
    let syncJobsCreated = 0;
    
    if (payload.email) {
      const { data: destinations } = await supabase
        .from('destinations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('enabled', true);

      if (destinations && destinations.length > 0) {
        const now = new Date().toISOString();
        
        for (const dest of destinations) {
          await supabase
            .from('sync_jobs')
            .insert({
              workspace_id: workspaceId,
              destination_id: dest.id,
              unified_user_id: unifiedUserId,
              event_id: eventId,
              job_type: 'profile_upsert',
              status: 'pending',
              scheduled_at: now,
              payload: { trigger: 'server-track', server_side: true }
            });
          syncJobsCreated++;
        }
      }
    }

    console.log(JSON.stringify({
      fn: 'server-track',
      action: 'event_processed',
      event_id: eventId,
      unified_user_id: unifiedUserId,
      sync_jobs_created: syncJobsCreated,
      fingerprint: dedupeKey.slice(0, 16) + '...',
      duration_ms: Date.now() - startTime,
      ts: new Date().toISOString()
    }));

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventId,
        unified_user_id: unifiedUserId,
        duplicate: false,
        fingerprint_used: !payload.anonymous_id && effectiveAnonymousId?.startsWith('fp_'),
        sync_jobs_created: syncJobsCreated
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(JSON.stringify({
      fn: 'server-track',
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
