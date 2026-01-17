import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const BATCH_SIZE = 100;

interface ComputedTraits {
  intent_score: number;
  page_views: number;
  product_views: number;
  cart_adds: number;
  checkout_starts: number;
  orders_count: number;
  total_revenue: number;
  session_count: number;
  browse_depth: number;
  recency_score: number;
  last_computed_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('[backfill-computed] Starting backfill job...');

    // Find users that need backfill:
    // - computed is empty or null
    // - intent_score is 0 or missing
    // - has events but empty computed
    const { data: usersToBackfill, error: fetchError } = await supabase
      .from('users_unified')
      .select('id, workspace_id, computed')
      .or('computed.is.null,computed.eq.{}')
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[backfill-computed] Error fetching users:', fetchError);
      throw fetchError;
    }

    // Also find users with 0 intent score but have events
    const { data: zeroIntentUsers, error: zeroIntentError } = await supabase
      .from('users_unified')
      .select('id, workspace_id, computed')
      .filter('computed->intent_score', 'eq', '0')
      .limit(BATCH_SIZE);

    if (zeroIntentError) {
      console.error('[backfill-computed] Error fetching zero intent users:', zeroIntentError);
    }

    const allUsers = [...(usersToBackfill || []), ...(zeroIntentUsers || [])];
    const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());

    console.log(`[backfill-computed] Found ${uniqueUsers.length} users to backfill`);

    let processed = 0;
    let errors = 0;

    for (const user of uniqueUsers) {
      try {
        // Fetch all events for this user
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('event_name, event_type, properties, event_time')
          .eq('unified_user_id', user.id)
          .order('event_time', { ascending: true });

        if (eventsError) {
          console.error(`[backfill-computed] Error fetching events for user ${user.id}:`, eventsError);
          errors++;
          continue;
        }

        if (!events || events.length === 0) {
          // No events, skip
          continue;
        }

        // Calculate computed traits from events
        const computed = calculateComputedTraits(events);

        // Update user
        const { error: updateError } = await supabase
          .from('users_unified')
          .update({ 
            computed,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`[backfill-computed] Error updating user ${user.id}:`, updateError);
          errors++;
          continue;
        }

        processed++;
        console.log(`[backfill-computed] Updated user ${user.id} with intent_score: ${computed.intent_score}`);

      } catch (err) {
        console.error(`[backfill-computed] Error processing user ${user.id}:`, err);
        errors++;
      }
    }

    // Also update workspace_health with e-commerce status
    await updateWorkspaceHealth(supabase);

    console.log(`[backfill-computed] Completed. Processed: ${processed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        errors,
        total: uniqueUsers.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[backfill-computed] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function calculateComputedTraits(events: any[]): ComputedTraits {
  let pageViews = 0;
  let productViews = 0;
  let cartAdds = 0;
  let checkoutStarts = 0;
  let ordersCount = 0;
  let totalRevenue = 0;
  const sessions = new Set<string>();
  let browseDepth = 0;

  for (const event of events) {
    const eventName = event.event_name?.toLowerCase() || '';
    const eventType = event.event_type?.toLowerCase() || '';
    const props = event.properties || {};

    // Track sessions
    if (props.session_id) {
      sessions.add(props.session_id);
    }

    // Page views
    if (eventType === 'page' || eventName.includes('page')) {
      pageViews++;
      browseDepth++;
    }

    // Product views
    if (eventName.includes('product') && (eventName.includes('view') || eventName.includes('viewed'))) {
      productViews++;
      browseDepth += 2;
    }

    // Add to cart
    if (eventName.includes('cart') || eventName.includes('add_to_cart') || eventName.includes('added to cart')) {
      cartAdds++;
    }

    // Checkout
    if (eventName.includes('checkout') || eventName.includes('begin_checkout')) {
      checkoutStarts++;
    }

    // Orders/Purchase
    if (eventName.includes('order') || eventName.includes('purchase') || eventType === 'order') {
      ordersCount++;
      const orderValue = parseFloat(props.value) || parseFloat(props.total) || parseFloat(props.revenue) || 0;
      totalRevenue += orderValue;
    }
  }

  // Calculate intent score (0-100)
  let intentScore = 0;
  
  // Page engagement (max 15 points)
  intentScore += Math.min(pageViews * 2, 15);
  
  // Product interest (max 25 points)
  intentScore += Math.min(productViews * 5, 25);
  
  // Cart behavior (max 25 points)
  intentScore += Math.min(cartAdds * 10, 25);
  
  // Checkout intent (max 20 points)
  intentScore += Math.min(checkoutStarts * 15, 20);
  
  // Session depth (max 10 points)
  intentScore += Math.min(sessions.size * 3, 10);
  
  // Browse depth bonus (max 5 points)
  intentScore += Math.min(browseDepth / 10, 5);

  // Cap at 100
  intentScore = Math.min(Math.round(intentScore), 100);

  // Calculate recency score based on last event
  const lastEventTime = events[events.length - 1]?.event_time;
  let recencyScore = 0;
  if (lastEventTime) {
    const daysSinceLastEvent = (Date.now() - new Date(lastEventTime).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastEvent < 1) recencyScore = 100;
    else if (daysSinceLastEvent < 3) recencyScore = 80;
    else if (daysSinceLastEvent < 7) recencyScore = 60;
    else if (daysSinceLastEvent < 14) recencyScore = 40;
    else if (daysSinceLastEvent < 30) recencyScore = 20;
    else recencyScore = 10;
  }

  return {
    intent_score: intentScore,
    page_views: pageViews,
    product_views: productViews,
    cart_adds: cartAdds,
    checkout_starts: checkoutStarts,
    orders_count: ordersCount,
    total_revenue: totalRevenue,
    session_count: sessions.size,
    browse_depth: browseDepth,
    recency_score: recencyScore,
    last_computed_at: new Date().toISOString()
  };
}

async function updateWorkspaceHealth(supabase: any) {
  try {
    // Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id');

    if (!workspaces) return;

    for (const workspace of workspaces) {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get event counts
      const { count: eventsToday } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .gte('event_time', oneDayAgo);

      const { count: eventsWeek } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .gte('event_time', oneWeekAgo);

      // Get last event
      const { data: lastEvent } = await supabase
        .from('events')
        .select('event_time')
        .eq('workspace_id', workspace.id)
        .order('event_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check for e-commerce events
      const ecomEvents = ['Product Viewed', 'Add to Cart', 'Begin Checkout', 'Order'];
      const hasProduct = await hasEventType(supabase, workspace.id, ['Product Viewed', 'product_viewed', 'view_item'], oneWeekAgo);
      const hasCart = await hasEventType(supabase, workspace.id, ['Add to Cart', 'add_to_cart'], oneWeekAgo);
      const hasCheckout = await hasEventType(supabase, workspace.id, ['Begin Checkout', 'begin_checkout', 'checkout'], oneWeekAgo);
      const hasOrder = await hasEventType(supabase, workspace.id, ['Order', 'order', 'purchase'], oneWeekAgo);

      // Upsert workspace health
      const healthData = {
        workspace_id: workspace.id,
        last_event_at: lastEvent?.event_time || null,
        events_today: eventsToday || 0,
        events_week: eventsWeek || 0,
        has_product_events: hasProduct,
        has_cart_events: hasCart,
        has_checkout_events: hasCheckout,
        has_order_events: hasOrder,
        alert_no_events_24h: (eventsToday || 0) === 0,
        alert_no_ecommerce: !hasProduct && !hasCart && !hasCheckout,
        checked_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      await supabase
        .from('workspace_health')
        .upsert(healthData, { onConflict: 'workspace_id' });
    }

    console.log('[backfill-computed] Updated workspace health for all workspaces');
  } catch (err) {
    console.error('[backfill-computed] Error updating workspace health:', err);
  }
}

async function hasEventType(supabase: any, workspaceId: string, eventNames: string[], since: string): Promise<boolean> {
  const orFilter = eventNames.map(name => `event_name.ilike.%${name}%`).join(',');
  
  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .or(orFilter)
    .gte('event_time', since);

  return (count || 0) > 0;
}
