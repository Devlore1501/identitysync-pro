import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

/**
 * COLLECT ENDPOINT - Event Ingestion with Normalization
 * 
 * NORMALIZZAZIONE OBBLIGATORIA:
 * 1. event_name standardizzato
 * 2. event_type coerente (product, cart, checkout, order)
 * 3. properties minime obbligatorie validate
 */

interface CollectPayload {
  event: string;
  properties?: Record<string, unknown>;
  context?: {
    anonymous_id?: string;
    session_id?: string;
    user_agent?: string;
    locale?: string;
    page?: {
      url?: string;
      title?: string;
      referrer?: string;
      path?: string;
    };
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
    traits?: {
      email?: string;
      phone?: string;
      customer_id?: string;
    };
  };
  timestamp?: string;
  consent?: {
    analytics?: boolean;
    marketing?: boolean;
  };
}

// ===== EVENT NORMALIZATION RULES =====

// Map raw event names to standardized names
const EVENT_NAME_NORMALIZATION: Record<string, string> = {
  // Page events
  'page_view': 'Page View',
  'pageview': 'Page View',
  'page': 'Page View',
  
  // Product events
  'view_item': 'Product Viewed',
  'product_viewed': 'Product Viewed',
  'product_view': 'Product Viewed',
  'view_product': 'Product Viewed',
  
  // Cart events
  'add_to_cart': 'Product Added',
  'product_added': 'Product Added',
  'added_to_cart': 'Product Added',
  'cart_viewed': 'Cart Viewed',
  'view_cart': 'Cart Viewed',
  
  // Checkout events
  'begin_checkout': 'Started Checkout',
  'checkout_started': 'Started Checkout',
  'started_checkout': 'Started Checkout',
  'initiate_checkout': 'Started Checkout',
  
  // Purchase events
  'purchase': 'Order Completed',
  'order_completed': 'Order Completed',
  'placed_order': 'Order Completed',
  'complete_purchase': 'Order Completed',
};

// Map event names to types
const EVENT_TYPE_MAP: Record<string, string> = {
  // Page events
  'Page View': 'page',
  'Session Start': 'page',
  
  // Product events
  'Product Viewed': 'product',
  'View Item': 'product',
  'Product Click': 'product',
  'Search': 'product',
  
  // Cart events
  'Product Added': 'cart',
  'Add to Cart': 'cart',
  'Cart Viewed': 'cart',
  'Product Removed': 'cart',
  
  // Checkout events
  'Started Checkout': 'checkout',
  'Begin Checkout': 'checkout',
  'Checkout Started': 'checkout',
  'Checkout Step Completed': 'checkout',
  'Payment Info Entered': 'checkout',
  
  // Order events
  'Order Completed': 'order',
  'Purchase': 'order',
  'Placed Order': 'order',
};

// Required properties per event type
const REQUIRED_PROPERTIES: Record<string, string[]> = {
  'product': ['product_id'],
  'cart': [],
  'checkout': [],
  'order': [],
};

/**
 * Normalize event name to standard format
 */
function normalizeEventName(rawName: string, context?: CollectPayload['context']): string {
  const lowerName = rawName.toLowerCase().replace(/[\s_-]+/g, '_').trim();
  
  // Check explicit mapping
  if (EVENT_NAME_NORMALIZATION[lowerName]) {
    return EVENT_NAME_NORMALIZATION[lowerName];
  }
  
  // Special case: Page View on product path -> Product Viewed
  if (rawName === 'Page View' || lowerName === 'page_view') {
    const path = context?.page?.path || context?.page?.url || '';
    if (path.includes('/product') || path.includes('/products/')) {
      console.log('[NORMALIZE] Page View on product path -> Product Viewed');
      return 'Product Viewed';
    }
  }
  
  // Return original if no normalization needed (already standard format)
  return rawName;
}

/**
 * Determine event type from normalized event name
 */
function mapEventType(eventName: string): string {
  // Direct match
  if (EVENT_TYPE_MAP[eventName]) {
    return EVENT_TYPE_MAP[eventName];
  }
  
  // Fuzzy match by name content
  const lower = eventName.toLowerCase();
  
  if (lower.includes('checkout')) return 'checkout';
  if (lower.includes('cart')) return 'cart';
  if (lower.includes('product') || lower.includes('item')) return 'product';
  if (lower.includes('order') || lower.includes('purchase')) return 'order';
  if (lower.includes('page') || lower.includes('view')) return 'page';
  
  return 'custom';
}

/**
 * Validate and enrich properties based on event type
 */
function validateAndEnrichProperties(
  eventName: string,
  eventType: string,
  properties: Record<string, unknown>,
  context?: CollectPayload['context']
): { valid: boolean; warnings: string[]; enrichedProperties: Record<string, unknown> } {
  const warnings: string[] = [];
  const enrichedProperties = { ...properties };
  
  // Check required properties
  const required = REQUIRED_PROPERTIES[eventType] || [];
  for (const prop of required) {
    if (!enrichedProperties[prop]) {
      warnings.push(`Missing recommended property: ${prop} for ${eventType} event`);
    }
  }
  
  // Enrich with page context if available
  if (context?.page) {
    if (!enrichedProperties.url && context.page.url) {
      enrichedProperties.url = context.page.url;
    }
    if (!enrichedProperties.page_path && context.page.path) {
      enrichedProperties.page_path = context.page.path;
    }
    if (!enrichedProperties.referrer && context.page.referrer) {
      enrichedProperties.referrer = context.page.referrer;
    }
  }
  
  // Enrich with UTM if available
  if (context?.utm) {
    enrichedProperties.utm_source = context.utm.source;
    enrichedProperties.utm_medium = context.utm.medium;
    enrichedProperties.utm_campaign = context.utm.campaign;
  }
  
  // Extract product_id from various possible fields
  if (eventType === 'product' && !enrichedProperties.product_id) {
    enrichedProperties.product_id = 
      enrichedProperties.id || 
      enrichedProperties.sku || 
      enrichedProperties.variant_id ||
      enrichedProperties.item_id;
  }
  
  // Extract checkout_id for checkout events
  if (eventType === 'checkout' && !enrichedProperties.checkout_id) {
    enrichedProperties.checkout_id = 
      enrichedProperties.id || 
      enrichedProperties.cart_id ||
      enrichedProperties.token;
  }
  
  return { valid: true, warnings, enrichedProperties };
}

// OPTIMIZED: Process event using database functions (1-2 queries instead of 8+)
// deno-lint-ignore no-explicit-any
async function processEventOptimized(
  supabase: any,
  workspaceId: string,
  payload: CollectPayload,
  source: string,
  ipAddress: string,
  userAgent: string
): Promise<{ eventId: string | null; unifiedUserId: string | null; isDuplicate: boolean; syncJobsCreated: number; warnings: string[] }> {
  const context = payload.context || {};
  const anonymousId = context.anonymous_id || null;
  const sessionId = context.session_id || null;
  const timestamp = payload.timestamp || new Date().toISOString();
  
  // Extract identity info from context.traits if available
  const email = context.traits?.email || null;
  const phone = context.traits?.phone || null;
  const customerId = context.traits?.customer_id || null;
  
  // ===== NORMALIZE EVENT =====
  const normalizedEventName = normalizeEventName(payload.event, context);
  const eventType = mapEventType(normalizedEventName);
  
  console.log(`[NORMALIZE] Raw: "${payload.event}" -> Normalized: "${normalizedEventName}" (type: ${eventType})`);
  
  // ===== VALIDATE & ENRICH PROPERTIES =====
  const { warnings, enrichedProperties } = validateAndEnrichProperties(
    normalizedEventName,
    eventType,
    payload.properties || {},
    context
  );
  
  if (warnings.length > 0) {
    console.log(`[NORMALIZE] Warnings: ${warnings.join(', ')}`);
  }
  
  // Build context with IP and user agent
  const enrichedContext = {
    ...context,
    ip_address: ipAddress,
    user_agent: userAgent,
    normalization: {
      original_event_name: payload.event,
      normalized_event_name: normalizedEventName,
      warnings,
    },
  };

  // SINGLE QUERY: Process event using optimized database function
  const { data: result, error: processError } = await supabase.rpc('process_event_fast', {
    p_workspace_id: workspaceId,
    p_event_type: eventType,
    p_event_name: normalizedEventName,
    p_properties: enrichedProperties,
    p_context: enrichedContext,
    p_anonymous_id: anonymousId,
    p_email: email,
    p_phone: phone,
    p_customer_id: customerId,
    p_source: source,
    p_session_id: sessionId,
    p_consent_state: payload.consent || null,
    p_event_time: timestamp,
  });

  if (processError) {
    console.error('[COLLECT] Error processing event:', processError);
    return { eventId: null, unifiedUserId: null, isDuplicate: false, syncJobsCreated: 0, warnings };
  }

  const eventResult = result?.[0];
  if (!eventResult) {
    console.error('[COLLECT] No result from process_event_fast');
    return { eventId: null, unifiedUserId: null, isDuplicate: false, syncJobsCreated: 0, warnings };
  }

  const { event_id: eventId, unified_user_id: unifiedUserId, is_duplicate: isDuplicate } = eventResult;

  // If duplicate, return early - no need for further processing
  if (isDuplicate) {
    return { eventId, unifiedUserId, isDuplicate: true, syncJobsCreated: 0, warnings };
  }

  // SECOND QUERY: Schedule sync jobs using database function
  const { data: jobsCreated, error: syncError } = await supabase.rpc('schedule_sync_jobs', {
    p_workspace_id: workspaceId,
    p_event_id: eventId,
    p_unified_user_id: unifiedUserId,
    p_event_type: eventType,
    p_event_name: normalizedEventName,
    p_properties: enrichedProperties,
    p_context: enrichedContext,
  });

  if (syncError) {
    console.error('[COLLECT] Error scheduling sync jobs:', syncError);
  }

  // THIRD QUERY (background, non-blocking): Update computed traits
  supabase.rpc('update_computed_traits_fast', {
    p_unified_user_id: unifiedUserId,
    p_event_type: eventType,
    p_event_name: normalizedEventName,
    p_properties: enrichedProperties,
  }).then(() => {
    // Traits updated
  }).catch((err: Error) => {
    console.error('[COLLECT] Error updating computed traits:', err);
  });

  // FOURTH QUERY (background, non-blocking): Increment billing
  supabase.rpc('increment_billing_usage', {
    p_workspace_id: workspaceId,
  }).then(() => {
    // Billing updated
  }).catch((err: Error) => {
    console.error('[COLLECT] Error incrementing billing:', err);
  });

  return { 
    eventId, 
    unifiedUserId, 
    isDuplicate: false, 
    syncJobsCreated: jobsCreated || 0,
    warnings,
  };
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight
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
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const authResult = await validateApiKey(apiKey);
    
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check scope
    if (!authResult.scopes?.includes('collect')) {
      return new Response(
        JSON.stringify({ error: 'API key does not have collect scope' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: CollectPayload = await req.json();
    
    // STRUCTURED LOGGING
    console.log(JSON.stringify({
      fn: 'collect',
      workspace_id: authResult.workspaceId,
      event_name: payload.event,
      anonymous_id: payload.context?.anonymous_id,
      session_id: payload.context?.session_id,
      has_email: !!payload.context?.traits?.email,
      checkout_id: (payload.properties as Record<string, unknown>)?.checkout_id,
      cart_token: (payload.properties as Record<string, unknown>)?.cart_token,
      order_id: (payload.properties as Record<string, unknown>)?.order_id,
      ts: new Date().toISOString()
    }));

    // SECURITY: Validate payload size limits to prevent DoS attacks
    const propertiesSize = JSON.stringify(payload.properties || {}).length;
    const contextSize = JSON.stringify(payload.context || {}).length;
    
    if (propertiesSize > 50000) {
      return new Response(
        JSON.stringify({ error: 'Properties payload too large (max 50KB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (contextSize > 20000) { // 20KB limit for context
      console.log('ERROR: Context payload too large:', contextSize);
      return new Response(
        JSON.stringify({ error: 'Context payload too large (max 20KB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate nesting depth to prevent stack overflow
    function getJsonDepth(obj: unknown, depth = 0): number {
      if (depth > 10) return depth;
      if (typeof obj !== 'object' || obj === null) return depth;
      let maxChildDepth = depth;
      for (const value of Object.values(obj)) {
        maxChildDepth = Math.max(maxChildDepth, getJsonDepth(value, depth + 1));
      }
      return maxChildDepth;
    }
    
    if (getJsonDepth(payload.properties) > 10) {
      console.log('ERROR: Properties nesting too deep');
      return new Response(
        JSON.stringify({ error: 'Properties nesting too deep (max 10 levels)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Properties size:', propertiesSize, 'Context size:', contextSize);

    // Validate required fields
    if (!payload.event) {
      console.log('ERROR: Missing event field');
      return new Response(
        JSON.stringify({ error: 'Missing required field: event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client info
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // OPTIMIZED: Process event using database functions
    const result = await processEventOptimized(
      supabase,
      authResult.workspaceId!,
      payload,
      'js',
      clientIp,
      userAgent
    );

    if (!result.eventId) {
      return new Response(
        JSON.stringify({ error: 'Failed to process event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: result.eventId,
        sync_jobs_queued: result.syncJobsCreated,
        duplicate: result.isDuplicate,
        warnings: result.warnings,
        message: result.isDuplicate ? 'Duplicate event detected' : 'Event processed'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Collect error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
