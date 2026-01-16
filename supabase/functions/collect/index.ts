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
  };
  timestamp?: string;
  consent?: {
    analytics?: boolean;
    marketing?: boolean;
  };
}

// Generate dedupe key from event properties
function generateDedupeKey(workspaceId: string, event: string, anonymousId: string | null, properties: Record<string, unknown>, timestamp: string): string {
  const productId = properties?.product_id ?? '';
  const parts = [
    workspaceId,
    event,
    anonymousId || '',
    String(productId),
    timestamp,
  ];
  return parts.join('::');
}

// Process a single raw event inline
// deno-lint-ignore no-explicit-any
async function processEventInline(
  supabase: any,
  workspaceId: string,
  payload: CollectPayload,
  source: string,
  ipAddress: string,
  userAgent: string
): Promise<{ eventId: string | null; syncJobsCreated: number }> {
  const context = payload.context || {};
  const anonymousId = context.anonymous_id || null;
  const sessionId = context.session_id || null;
  const timestamp = payload.timestamp || new Date().toISOString();

  // Find or resolve unified user
  let unifiedUserId: string | null = null;

  if (anonymousId) {
    // Try to find existing identity
    const { data: existingIdentity } = await supabase
      .from('identities')
      .select('unified_user_id')
      .eq('workspace_id', workspaceId)
      .eq('identity_type', 'anonymous_id')
      .eq('identity_value', anonymousId)
      .single();

    if (existingIdentity) {
      unifiedUserId = existingIdentity.unified_user_id;
      
      // Update last_seen_at
      await supabase
        .from('users_unified')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', unifiedUserId);
    } else {
      // Create new unified user
      const { data: newUser } = await supabase
        .from('users_unified')
        .insert({
          workspace_id: workspaceId,
          anonymous_ids: [anonymousId],
        })
        .select('id')
        .single();

      if (newUser) {
        unifiedUserId = newUser.id;
        
        // Create identity record
        await supabase
          .from('identities')
          .insert({
            workspace_id: workspaceId,
            unified_user_id: unifiedUserId,
            identity_type: 'anonymous_id',
            identity_value: anonymousId,
            source: source,
          });
      }
    }
  }

  // Map common event types
  const eventName = payload.event;
  const eventTypeMap: Record<string, string> = {
    'Page View': 'page_view',
    'page_view': 'page_view',
    'View Item': 'view_item',
    'view_item': 'view_item',
    'Add to Cart': 'add_to_cart',
    'add_to_cart': 'add_to_cart',
    'Begin Checkout': 'begin_checkout',
    'begin_checkout': 'begin_checkout',
    'Purchase': 'purchase',
    'purchase': 'purchase',
    'Started Checkout': 'begin_checkout',
    'Placed Order': 'purchase',
  };
  const eventType = eventTypeMap[eventName] || 'custom';

  // Generate dedupe key
  const dedupeKey = generateDedupeKey(workspaceId, eventName, anonymousId, payload.properties || {}, timestamp);

  // Check for duplicate
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('dedupe_key', dedupeKey)
    .single();

  if (existingEvent) {
    return { eventId: existingEvent.id, syncJobsCreated: 0 };
  }

  // Insert processed event directly
  const { data: insertedEvent, error: insertError } = await supabase
    .from('events')
    .insert({
      workspace_id: workspaceId,
      unified_user_id: unifiedUserId,
      event_type: eventType,
      event_name: eventName,
      properties: payload.properties || {},
      context: {
        ...context,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      anonymous_id: anonymousId,
      session_id: sessionId,
      source: source,
      status: 'processed',
      dedupe_key: dedupeKey,
      consent_state: payload.consent || null,
      event_time: timestamp,
      processed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !insertedEvent) {
    console.error('Error inserting event:', insertError);
    return { eventId: null, syncJobsCreated: 0 };
  }

  // Queue sync jobs for enabled destinations
  let syncJobsCreated = 0;
  const { data: destinations } = await supabase
    .from('destinations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('enabled', true);

  if (destinations && destinations.length > 0) {
    const syncJobs = destinations.map((dest: { id: string }) => ({
      workspace_id: workspaceId,
      destination_id: dest.id,
      unified_user_id: unifiedUserId,
      event_id: insertedEvent.id,
      job_type: 'event_track',
      payload: {},
    }));

    const { error: syncError } = await supabase.from('sync_jobs').insert(syncJobs);
    if (!syncError) {
      syncJobsCreated = syncJobs.length;
    }
  }

  // Update computed traits for the unified user
  if (unifiedUserId) {
    await updateComputedTraits(supabase, unifiedUserId, eventType, eventName, payload.properties || {});
  }

  // Track billing usage
  await incrementBillingUsage(supabase, workspaceId);

  return { eventId: insertedEvent.id, syncJobsCreated };
}

// Increment billing usage counter for the current period
// deno-lint-ignore no-explicit-any
async function incrementBillingUsage(supabase: any, workspaceId: string): Promise<void> {
  try {
    // Get workspace to find account_id
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('account_id')
      .eq('id', workspaceId)
      .single();

    if (!workspace) return;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Try to update existing record
    const { data: existing } = await supabase
      .from('billing_usage')
      .select('id, events_count')
      .eq('account_id', workspace.account_id)
      .eq('period_start', periodStart)
      .single();

    if (existing) {
      await supabase
        .from('billing_usage')
        .update({ 
          events_count: existing.events_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('billing_usage')
        .insert({
          account_id: workspace.account_id,
          workspace_id: workspaceId,
          period_start: periodStart,
          period_end: periodEnd,
          events_count: 1,
        });
    }
  } catch (error) {
    console.error('Error tracking billing usage:', error);
    // Don't fail the request if billing tracking fails
  }
}

// Calculate and update computed traits based on event
// deno-lint-ignore no-explicit-any
async function updateComputedTraits(
  supabase: any,
  unifiedUserId: string,
  eventType: string,
  eventName: string,
  properties: Record<string, unknown>
): Promise<void> {
  // Intent score weights
  const scoreMap: Record<string, number> = {
    'page_view': 1,
    'view_item': 3,
    'add_to_cart': 5,
    'begin_checkout': 8,
    'purchase': 10,
    'custom': 1,
  };

  const scoreIncrement = scoreMap[eventType] || 1;

  // Get current user data
  const { data: user } = await supabase
    .from('users_unified')
    .select('computed, first_seen_at')
    .eq('id', unifiedUserId)
    .single();

  const currentComputed = (user?.computed as Record<string, unknown>) || {};
  const currentScore = (currentComputed.intent_score as number) || 0;
  
  // Calculate new intent score with time decay
  const lastActivityTime = currentComputed.last_activity_at 
    ? new Date(currentComputed.last_activity_at as string).getTime() 
    : Date.now();
  const hoursSinceLastActivity = (Date.now() - lastActivityTime) / (1000 * 60 * 60);
  const decayFactor = Math.max(0.5, 1 - (hoursSinceLastActivity / 168)); // Decay over 1 week
  const decayedScore = currentScore * decayFactor;
  const newScore = Math.min(Math.round(decayedScore + scoreIncrement), 100);

  // Update category counts for top_category
  const categoryName = (properties?.category as string) || 
                       (properties?.product_category as string) || 
                       (properties?.item_category as string);
  const categoryCountsRaw = (currentComputed.category_counts as Record<string, number>) || {};
  const categoryCounts = { ...categoryCountsRaw };
  if (categoryName && (eventType === 'view_item' || eventType === 'add_to_cart' || eventType === 'purchase')) {
    categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
  }
  
  // Determine top category
  let topCategory = currentComputed.top_category as string | null;
  if (Object.keys(categoryCounts).length > 0) {
    topCategory = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  // Calculate frequency (events in last 7 days) - increment counter
  const eventsLast7d = ((currentComputed.events_last_7d as number) || 0) + 1;
  const eventsLast30d = ((currentComputed.events_last_30d as number) || 0) + 1;

  // Calculate recency score (0-100, 100 = just seen, 0 = not seen in 30 days)
  const recencyScore = 100; // Just saw them

  // Calculate lifetime value if purchase
  let lifetimeValue = (currentComputed.lifetime_value as number) || 0;
  let totalOrders = (currentComputed.total_orders as number) || 0;
  if (eventType === 'purchase') {
    const orderValue = (properties?.total_price as number) || 
                       (properties?.value as number) || 
                       (properties?.revenue as number) || 0;
    lifetimeValue += orderValue;
    totalOrders += 1;
  }

  // Calculate days since first seen
  const firstSeenAt = user?.first_seen_at ? new Date(user.first_seen_at) : new Date();
  const daysSinceFirstSeen = Math.floor((Date.now() - firstSeenAt.getTime()) / (1000 * 60 * 60 * 24));

  // Update computed traits
  await supabase
    .from('users_unified')
    .update({
      computed: {
        ...currentComputed,
        intent_score: newScore,
        recency_score: recencyScore,
        top_category: topCategory,
        category_counts: categoryCounts,
        events_last_7d: eventsLast7d,
        events_last_30d: eventsLast30d,
        lifetime_value: lifetimeValue,
        total_orders: totalOrders,
        days_since_first_seen: daysSinceFirstSeen,
        last_event_type: eventType,
        last_event_name: eventName,
        last_activity_at: new Date().toISOString(),
      },
    })
    .eq('id', unifiedUserId);
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

    // Process event inline (no more events_raw, direct processing)
    const result = await processEventInline(
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
        message: 'Event processed' 
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
