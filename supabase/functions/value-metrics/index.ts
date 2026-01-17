import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * VALUE METRICS ENDPOINT
 * 
 * Espone metriche per dimostrare il valore di IdentitySync:
 * - Numero profili con sf_checkout_abandoned_at settata
 * - Checkout iniziati vs profili recuperabili
 * - Utenti recuperati (con email che possono entrare nei flow)
 * 
 * Risponde alla domanda:
 * "Quanti utenti in più entrano nel flow grazie a IdentitySync?"
 */

interface ValueMetrics {
  period: {
    start: string;
    end: string;
    days: number;
  };
  
  // Core value metrics
  checkout_started_total: number;
  checkout_abandoned_profiles: number;
  profiles_with_sf_checkout_abandoned_at: number;
  
  // Recovery metrics
  recovered_users: number;
  recovery_rate_percent: number;
  
  // Breakdown
  anonymous_checkouts: number;
  identified_checkouts: number;
  
  // Flow readiness
  profiles_ready_for_flow: number;
  profiles_missing_email: number;
  
  // Sync status
  profiles_synced_to_klaviyo: number;
  profiles_pending_sync: number;
  
  // Intent distribution
  intent_score_distribution: {
    high: number;    // 70-100
    medium: number;  // 30-69
    low: number;     // 0-29
  };
  
  // EXTENDED FUNNEL METRICS (NEW)
  extended_funnel: {
    // Product view abandonment (intent >= 30)
    product_views_total: number;
    product_view_high_intent: number;  // intent >= 30
    product_view_synced: number;
    
    // Cart abandonment (intent >= 50)
    cart_events_total: number;
    cart_high_intent: number;  // intent >= 50
    cart_synced: number;
    
    // Potential additional reach
    browse_abandonment_potential: number;
    cart_abandonment_potential: number;
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

    // Parse query params first
    const url = new URL(req.url);
    let days = parseInt(url.searchParams.get('days') || '7');
    let workspaceId: string | null = url.searchParams.get('workspace_id');

    // Also try reading from body (for POST requests from frontend)
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.workspace_id) {
          workspaceId = body.workspace_id;
        }
        if (body.days) {
          days = parseInt(body.days);
        }
      } catch {
        // Body parsing failed, continue with query params
      }
    }

    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    console.log(`[VALUE-METRICS] Calculating metrics for workspace ${workspaceId || 'ALL'}, last ${days} days`);

    // Checkout event types to match (Shopify sends begin_checkout)
    const checkoutEventTypes = ['checkout', 'begin_checkout', 'Checkout Started'];

    // 1. Count checkout_started events
    let checkoutQuery = supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .in('event_type', checkoutEventTypes)
      .gte('event_time', periodStart.toISOString())
      .lte('event_time', periodEnd.toISOString());
    
    if (workspaceId) {
      checkoutQuery = checkoutQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: checkoutStartedTotal } = await checkoutQuery;

    // 2. Count anonymous checkouts (no unified_user_id with email)
    let anonCheckoutQuery = supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .in('event_type', checkoutEventTypes)
      .is('unified_user_id', null)
      .gte('event_time', periodStart.toISOString())
      .lte('event_time', periodEnd.toISOString());
    
    if (workspaceId) {
      anonCheckoutQuery = anonCheckoutQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: anonymousCheckouts } = await anonCheckoutQuery;

    // 3. Count profiles with checkout_abandoned stage
    let abandonedQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .eq('computed->>drop_off_stage', 'checkout_abandoned');
    
    if (workspaceId) {
      abandonedQuery = abandonedQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: checkoutAbandonedProfiles } = await abandonedQuery;

    // 4. Count profiles with sf_checkout_abandoned_at set (synced to Klaviyo)
    let sfAbandonedQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .not('computed->>checkout_abandoned_at', 'is', null);
    
    if (workspaceId) {
      sfAbandonedQuery = sfAbandonedQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: profilesWithSfCheckoutAbandonedAt } = await sfAbandonedQuery;

    // 5. Count profiles ready for flow (has email + checkout_abandoned)
    let readyForFlowQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .not('primary_email', 'is', null)
      .eq('computed->>drop_off_stage', 'checkout_abandoned');
    
    if (workspaceId) {
      readyForFlowQuery = readyForFlowQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: profilesReadyForFlow } = await readyForFlowQuery;

    // 6. Count profiles missing email but with checkout activity
    let missingEmailQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .is('primary_email', null)
      .eq('computed->>drop_off_stage', 'checkout_abandoned');
    
    if (workspaceId) {
      missingEmailQuery = missingEmailQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: profilesMissingEmail } = await missingEmailQuery;

    // 7. Count profiles synced (have checkout_abandoned_synced flag)
    let syncedQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .eq('computed->flags->>checkout_abandoned_synced', 'true');
    
    if (workspaceId) {
      syncedQuery = syncedQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: profilesSyncedToKlaviyo } = await syncedQuery;

    // 8. Intent score distribution
    let highIntentQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .gte('computed->>intent_score', '70');
    
    if (workspaceId) {
      highIntentQuery = highIntentQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: highIntentCount } = await highIntentQuery;

    let mediumIntentQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .gte('computed->>intent_score', '30')
      .lt('computed->>intent_score', '70');
    
    if (workspaceId) {
      mediumIntentQuery = mediumIntentQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: mediumIntentCount } = await mediumIntentQuery;

    let lowIntentQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .lt('computed->>intent_score', '30');
    
    if (workspaceId) {
      lowIntentQuery = lowIntentQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: lowIntentCount } = await lowIntentQuery;

    // Calculate derived metrics
    const identifiedCheckouts = (checkoutStartedTotal || 0) - (anonymousCheckouts || 0);
    const recoveredUsers = profilesReadyForFlow || 0;
    
    // Recovery rate: profili con email / profili totali con checkout activity
    // Cap a 100% per evitare valori impossibili
    const totalCheckoutProfiles = (checkoutAbandonedProfiles || 0) + (profilesReadyForFlow || 0);
    const recoveryRatePercent = totalCheckoutProfiles > 0
      ? Math.min(100, Math.round((recoveredUsers / totalCheckoutProfiles) * 100))
      : 0;

    // ===== EXTENDED FUNNEL QUERIES =====
    // NOTE: Since computed fields (last_product_viewed_at, last_cart_at) are not populated,
    // we count users who have these events directly by joining events with users_unified
    
    // Product view events total
    let productViewQuery = supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .in('event_type', ['product', 'product_view', 'Product Viewed'])
      .gte('event_time', periodStart.toISOString())
      .lte('event_time', periodEnd.toISOString());
    
    if (workspaceId) {
      productViewQuery = productViewQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: productViewsTotal } = await productViewQuery;

    // Product view high intent - count unique users with product events who have email + intent >= 30
    // We get users who have had product view events
    let productUsersQuery = supabase
      .from('events')
      .select('unified_user_id')
      .in('event_type', ['product', 'product_view', 'Product Viewed'])
      .not('unified_user_id', 'is', null)
      .gte('event_time', periodStart.toISOString())
      .lte('event_time', periodEnd.toISOString());
    
    if (workspaceId) {
      productUsersQuery = productUsersQuery.eq('workspace_id', workspaceId);
    }
    
    const { data: productUserIds } = await productUsersQuery;
    const uniqueProductUserIds = [...new Set((productUserIds || []).map(e => e.unified_user_id))];
    
    // Now count how many of these have email + intent >= 30
    let productHighIntentCount = 0;
    if (uniqueProductUserIds.length > 0) {
      const { count } = await supabase
        .from('users_unified')
        .select('id', { count: 'exact', head: true })
        .in('id', uniqueProductUserIds)
        .not('primary_email', 'is', null)
        .gte('computed->>intent_score', '30');
      productHighIntentCount = count || 0;
    }

    // Product view synced
    let productSyncedQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .eq('computed->flags->>product_view_synced', 'true');
    
    if (workspaceId) {
      productSyncedQuery = productSyncedQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: productViewSynced } = await productSyncedQuery;

    // Cart events total
    let cartEventsQuery = supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .in('event_type', ['cart', 'add_to_cart', 'Product Added'])
      .gte('event_time', periodStart.toISOString())
      .lte('event_time', periodEnd.toISOString());
    
    if (workspaceId) {
      cartEventsQuery = cartEventsQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: cartEventsTotal } = await cartEventsQuery;

    // Cart high intent - count unique users with cart events who have email + intent >= 50
    let cartUsersQuery = supabase
      .from('events')
      .select('unified_user_id')
      .in('event_type', ['cart', 'add_to_cart', 'Product Added'])
      .not('unified_user_id', 'is', null)
      .gte('event_time', periodStart.toISOString())
      .lte('event_time', periodEnd.toISOString());
    
    if (workspaceId) {
      cartUsersQuery = cartUsersQuery.eq('workspace_id', workspaceId);
    }
    
    const { data: cartUserIds } = await cartUsersQuery;
    const uniqueCartUserIds = [...new Set((cartUserIds || []).map(e => e.unified_user_id))];
    
    // Now count how many of these have email + intent >= 50
    let cartHighIntentCount = 0;
    if (uniqueCartUserIds.length > 0) {
      const { count } = await supabase
        .from('users_unified')
        .select('id', { count: 'exact', head: true })
        .in('id', uniqueCartUserIds)
        .not('primary_email', 'is', null)
        .gte('computed->>intent_score', '50');
      cartHighIntentCount = count || 0;
    }

    // Cart synced
    let cartSyncedQuery = supabase
      .from('users_unified')
      .select('id', { count: 'exact', head: true })
      .eq('computed->flags->>cart_synced', 'true');
    
    if (workspaceId) {
      cartSyncedQuery = cartSyncedQuery.eq('workspace_id', workspaceId);
    }
    
    const { count: cartSynced } = await cartSyncedQuery;

    const metrics: ValueMetrics = {
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        days,
      },
      
      checkout_started_total: checkoutStartedTotal || 0,
      checkout_abandoned_profiles: checkoutAbandonedProfiles || 0,
      profiles_with_sf_checkout_abandoned_at: profilesWithSfCheckoutAbandonedAt || 0,
      
      recovered_users: recoveredUsers,
      recovery_rate_percent: recoveryRatePercent,
      
      anonymous_checkouts: anonymousCheckouts || 0,
      identified_checkouts: identifiedCheckouts,
      
      profiles_ready_for_flow: profilesReadyForFlow || 0,
      profiles_missing_email: profilesMissingEmail || 0,
      
      profiles_synced_to_klaviyo: profilesSyncedToKlaviyo || 0,
      profiles_pending_sync: (profilesReadyForFlow || 0) - (profilesSyncedToKlaviyo || 0),
      
      intent_score_distribution: {
        high: highIntentCount || 0,
        medium: mediumIntentCount || 0,
        low: lowIntentCount || 0,
      },
      
      extended_funnel: {
        product_views_total: productViewsTotal || 0,
        product_view_high_intent: productHighIntentCount,
        product_view_synced: productViewSynced || 0,
        
        cart_events_total: cartEventsTotal || 0,
        cart_high_intent: cartHighIntentCount,
        cart_synced: cartSynced || 0,
        
        browse_abandonment_potential: productHighIntentCount - (productViewSynced || 0),
        cart_abandonment_potential: cartHighIntentCount - (cartSynced || 0),
      },
    };

    console.log('[VALUE-METRICS] Metrics calculated:');
    console.log(`  checkout_started: ${metrics.checkout_started_total}`);
    console.log(`  identitysync_checkout_abandoned_profiles: ${metrics.profiles_with_sf_checkout_abandoned_at}`);
    console.log(`  recovered_users: ${metrics.recovered_users}`);
    console.log(`  recovery_rate: ${metrics.recovery_rate_percent}%`);
    console.log(`  browse_abandonment_potential: ${metrics.extended_funnel.browse_abandonment_potential}`);
    console.log(`  cart_abandonment_potential: ${metrics.extended_funnel.cart_abandonment_potential}`);

    return new Response(
      JSON.stringify(metrics),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[VALUE-METRICS] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
