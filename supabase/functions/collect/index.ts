import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { validateApiKey } from '../_shared/auth.ts';

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

// Map common event names to standardized event types
function mapEventType(eventName: string): string {
  const eventTypeMap: Record<string, string> = {
    'Page View': 'page',
    'page_view': 'page',
    'View Item': 'product',
    'view_item': 'product',
    'Product Viewed': 'product',
    'Add to Cart': 'cart',
    'add_to_cart': 'cart',
    'Product Added': 'cart',
    'Cart Viewed': 'cart',
    'Begin Checkout': 'checkout',
    'begin_checkout': 'checkout',
    'Started Checkout': 'checkout',
    'Checkout Started': 'checkout',
    'Purchase': 'order',
    'purchase': 'order',
    'Placed Order': 'order',
    'Order Completed': 'order',
  };
  return eventTypeMap[eventName] || 'custom';
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
): Promise<{ eventId: string | null; unifiedUserId: string | null; isDuplicate: boolean; syncJobsCreated: number }> {
  const context = payload.context || {};
  const anonymousId = context.anonymous_id || null;
  const sessionId = context.session_id || null;
  const timestamp = payload.timestamp || new Date().toISOString();
  
  // Extract identity info from context.traits if available
  const email = context.traits?.email || null;
  const phone = context.traits?.phone || null;
  const customerId = context.traits?.customer_id || null;
  
  // Map event type
  const eventName = payload.event;
  const eventType = mapEventType(eventName);
  
  // Build context with IP and user agent
  const enrichedContext = {
    ...context,
    ip_address: ipAddress,
    user_agent: userAgent,
  };

  // SINGLE QUERY: Process event using optimized database function
  // This replaces 8+ separate queries with 1 RPC call
  const { data: result, error: processError } = await supabase.rpc('process_event_fast', {
    p_workspace_id: workspaceId,
    p_event_type: eventType,
    p_event_name: eventName,
    p_properties: payload.properties || {},
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
    console.error('Error processing event:', processError);
    return { eventId: null, unifiedUserId: null, isDuplicate: false, syncJobsCreated: 0 };
  }

  const eventResult = result?.[0];
  if (!eventResult) {
    console.error('No result from process_event_fast');
    return { eventId: null, unifiedUserId: null, isDuplicate: false, syncJobsCreated: 0 };
  }

  const { event_id: eventId, unified_user_id: unifiedUserId, is_duplicate: isDuplicate } = eventResult;

  // If duplicate, return early - no need for further processing
  if (isDuplicate) {
    return { eventId, unifiedUserId, isDuplicate: true, syncJobsCreated: 0 };
  }

  // SECOND QUERY: Schedule sync jobs using database function
  const { data: jobsCreated, error: syncError } = await supabase.rpc('schedule_sync_jobs', {
    p_workspace_id: workspaceId,
    p_event_id: eventId,
    p_unified_user_id: unifiedUserId,
    p_event_type: eventType,
    p_event_name: eventName,
    p_properties: payload.properties || {},
    p_context: enrichedContext,
  });

  if (syncError) {
    console.error('Error scheduling sync jobs:', syncError);
  }

  // THIRD QUERY (background, non-blocking): Update computed traits
  // Using EdgeRuntime.waitUntil would be ideal, but we'll fire-and-forget for now
  supabase.rpc('update_computed_traits_fast', {
    p_unified_user_id: unifiedUserId,
    p_event_type: eventType,
    p_event_name: eventName,
    p_properties: payload.properties || {},
  }).then(() => {
    // Traits updated
  }).catch((err: Error) => {
    console.error('Error updating computed traits:', err);
  });

  // FOURTH QUERY (background, non-blocking): Increment billing
  supabase.rpc('increment_billing_usage', {
    p_workspace_id: workspaceId,
  }).then(() => {
    // Billing updated
  }).catch((err: Error) => {
    console.error('Error incrementing billing:', err);
  });

  return { 
    eventId, 
    unifiedUserId, 
    isDuplicate: false, 
    syncJobsCreated: jobsCreated || 0 
  };
}

Deno.serve(async (req) => {
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

    // Validate required fields
    if (!payload.event) {
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
