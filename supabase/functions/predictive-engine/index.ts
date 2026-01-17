import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Predictive Engine
 * 
 * Analyzes user behavioral patterns and generates predictive signals
 * that can trigger automated flows in Klaviyo/Meta BEFORE the behavior occurs.
 * 
 * Signals generated:
 * - high_intent_cart: User likely to purchase soon (cart + high intent)
 * - checkout_urgency: User abandoned checkout recently
 * - browse_warming: User showing increased engagement
 * - churn_risk: Previous customer not returning
 * - category_interest: Strong affinity to specific category
 */

interface PredictiveRule {
  id: string;
  name: string;
  description: string;
  condition: (user: UserData) => boolean;
  confidence: number;
  shouldTriggerFlow: boolean;
  flowName?: string;
  expiresInHours?: number;
  payload?: (user: UserData) => Record<string, unknown>;
}

interface UserData {
  id: string;
  primary_email: string | null;
  computed: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
}

// === PREDICTIVE RULES ===
const PREDICTIVE_RULES: PredictiveRule[] = [
  {
    id: 'high_intent_cart',
    name: 'High Intent - Cart Abandonment',
    description: 'User has items in cart and high purchase intent',
    condition: (user) => {
      const intent = Number(user.computed.intent_score) || 0;
      const dropOff = user.computed.drop_off_stage;
      const atc = Number(user.computed.atc_7d) || 0;
      const recency = Number(user.computed.recency_days) || 0;
      
      // Relaxed: intent >= 40 OR has cart activity
      return (intent >= 40 || atc >= 1) && 
             (dropOff === 'cart' || dropOff === 'cart_abandoned' || atc >= 1) && 
             recency <= 7;
    },
    confidence: 75,
    shouldTriggerFlow: true,
    flowName: 'SF High Intent Cart Recovery',
    expiresInHours: 72,
    payload: (user) => ({
      intent_score: user.computed.intent_score,
      atc_count: user.computed.atc_7d,
      top_category: user.computed.top_category
    })
  },
  {
    id: 'checkout_urgency',
    name: 'Checkout Abandonment - Urgent',
    description: 'User abandoned checkout within last 48 hours',
    condition: (user) => {
      const dropOff = user.computed.drop_off_stage;
      const checkoutAt = user.computed.checkout_abandoned_at;
      const orders = Number(user.computed.orders_count) || 0;
      const intent = Number(user.computed.intent_score) || 0;
      
      // Also trigger for high intent users even without explicit checkout
      if (orders > 0) return false; // Already purchased
      
      if (dropOff === 'checkout' || dropOff === 'checkout_abandoned') {
        if (!checkoutAt) return true; // Has checkout stage but no timestamp
        const hoursSinceCheckout = (Date.now() - new Date(checkoutAt as string).getTime()) / (1000 * 60 * 60);
        return hoursSinceCheckout <= 48;
      }
      
      // High intent fallback
      return intent >= 70;
    },
    confidence: 85,
    shouldTriggerFlow: true,
    flowName: 'SF Checkout Abandonment Urgent',
    expiresInHours: 48,
    payload: (user) => ({
      checkout_abandoned_at: user.computed.checkout_abandoned_at,
      intent_score: user.computed.intent_score
    })
  },
  {
    id: 'browse_warming',
    name: 'Browse Abandoner - Warming Up',
    description: 'User showing increased engagement across sessions',
    condition: (user) => {
      const sessions = Number(user.computed.session_count_30d) || 1;
      const products = Number(user.computed.unique_products_viewed) || Number(user.computed.product_views_7d) || 0;
      const intent = Number(user.computed.intent_score) || 0;
      const recency = Number(user.computed.recency_days) || 0;
      const orders = Number(user.computed.orders_count) || 0;
      
      // Relaxed: any engagement signals
      return (products >= 2 || intent >= 20) &&
             recency <= 14 &&
             orders === 0;
    },
    confidence: 60,
    shouldTriggerFlow: true,
    flowName: 'SF Browse Warming Nurture',
    expiresInHours: 168, // 7 days
    payload: (user) => ({
      session_count: user.computed.session_count_30d,
      products_viewed: user.computed.unique_products_viewed || user.computed.product_views_7d,
      top_category: user.computed.top_category
    })
  },
  {
    id: 'churn_risk',
    name: 'Customer Churn Risk',
    description: 'Previous customer not returning for extended period',
    condition: (user) => {
      const orders = Number(user.computed.orders_count) || 0;
      const recency = Number(user.computed.recency_days) || 0;
      const intent = Number(user.computed.intent_score) || 0;
      
      return orders >= 1 &&
             recency >= 30 &&
             intent <= 30;
    },
    confidence: 75,
    shouldTriggerFlow: true,
    flowName: 'SF Win-Back Campaign',
    expiresInHours: 336, // 14 days
    payload: (user) => ({
      orders_count: user.computed.orders_count,
      lifetime_value: user.computed.lifetime_value,
      days_since_last_visit: user.computed.recency_days
    })
  },
  {
    id: 'category_interest',
    name: 'Strong Category Interest',
    description: 'User shows strong affinity to specific product category',
    condition: (user) => {
      const category = user.computed.top_category;
      const products = Number(user.computed.unique_products_viewed) || 0;
      const categories = Number(user.computed.unique_categories_viewed) || 0;
      
      return !!category &&
             products >= 3 &&
             categories <= 3; // Focused interest
    },
    confidence: 70,
    shouldTriggerFlow: false, // Just update profile
    expiresInHours: 168,
    payload: (user) => ({
      top_category: user.computed.top_category,
      products_in_category: user.computed.unique_products_viewed
    })
  },
  {
    id: 'about_to_purchase',
    name: 'About to Purchase',
    description: 'User exhibits all signals of imminent purchase',
    condition: (user) => {
      const intent = Number(user.computed.intent_score) || 0;
      const depth = Number(user.computed.depth_score) || 0;
      const atc = Number(user.computed.atc_7d) || 0;
      const recency = Number(user.computed.recency_days) || 0;
      const orders = Number(user.computed.orders_count) || 0;
      
      return intent >= 80 &&
             depth >= 50 &&
             atc >= 1 &&
             recency <= 2 &&
             orders === 0; // First purchase about to happen
    },
    confidence: 88,
    shouldTriggerFlow: true,
    flowName: 'SF About to Purchase',
    expiresInHours: 48,
    payload: (user) => ({
      intent_score: user.computed.intent_score,
      depth_score: user.computed.depth_score,
      top_category: user.computed.top_category
    })
  }
];

Deno.serve(async (req) => {
  console.log('=== PREDICTIVE ENGINE CALLED ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let workspaceId: string | null = null;
    let userId: string | null = null;
    let limit = 100;

    // Check if request has body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        workspaceId = body.workspace_id;
        userId = body.user_id;
        limit = body.limit || 100;
      } catch {
        // No body, process all workspaces
      }
    }

    console.log('Processing workspace:', workspaceId || 'ALL');
    console.log('Processing user:', userId || 'ALL (limit ' + limit + ')');

    // Build query for users to analyze
    let query = supabase
      .from('users_unified')
      .select('id, workspace_id, primary_email, computed, first_seen_at, last_seen_at')
      .not('primary_email', 'is', null) // Only identified users
      .gte('last_seen_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Active in last 30 days

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    if (userId) {
      query = query.eq('id', userId);
    }

    const { data: users, error: usersError } = await query.limit(limit);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!users || users.length === 0) {
      console.log('No users to process');
      return new Response(
        JSON.stringify({ message: 'No users to process', signals_created: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${users.length} users...`);

    let signalsCreated = 0;
    let signalsUpdated = 0;
    let flowsToTrigger = 0;
    const signalsByType: Record<string, number> = {};

    for (const user of users) {
      // Calculate recency_days for each user
      const lastSeen = new Date(user.last_seen_at);
      const recencyDays = Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));
      user.computed = { ...user.computed, recency_days: recencyDays };

      // Evaluate all rules
      for (const rule of PREDICTIVE_RULES) {
        try {
          if (rule.condition(user)) {
            const now = new Date();
            const expiresAt = rule.expiresInHours 
              ? new Date(now.getTime() + rule.expiresInHours * 60 * 60 * 1000)
              : null;

            // Upsert signal
            const { data: existingSignal } = await supabase
              .from('predictive_signals')
              .select('id, flow_triggered_at')
              .eq('workspace_id', user.workspace_id)
              .eq('unified_user_id', user.id)
              .eq('signal_type', rule.id)
              .single();

            const signalData = {
              workspace_id: user.workspace_id,
              unified_user_id: user.id,
              signal_type: rule.id,
              signal_name: rule.name,
              confidence: rule.confidence,
              payload: rule.payload ? rule.payload(user) : {},
              should_trigger_flow: rule.shouldTriggerFlow && !existingSignal?.flow_triggered_at,
              flow_name: rule.flowName || null,
              expires_at: expiresAt?.toISOString() || null,
              updated_at: now.toISOString()
            };

            if (existingSignal) {
              // Update existing signal
              await supabase
                .from('predictive_signals')
                .update(signalData)
                .eq('id', existingSignal.id);
              signalsUpdated++;
            } else {
              // Create new signal
              await supabase
                .from('predictive_signals')
                .insert({
                  ...signalData,
                  created_at: now.toISOString()
                });
              signalsCreated++;
            }

            // Track by type
            signalsByType[rule.id] = (signalsByType[rule.id] || 0) + 1;
            
            if (signalData.should_trigger_flow) {
              flowsToTrigger++;
            }
          }
        } catch (ruleError) {
          console.error(`Error evaluating rule ${rule.id} for user ${user.id}:`, ruleError);
        }
      }
    }

    // Clean up expired signals
    const { data: expiredDeleted } = await supabase
      .from('predictive_signals')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    const expiredCount = expiredDeleted?.length || 0;
    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired signals`);
    }

    console.log('=== PREDICTIVE ENGINE COMPLETE ===');
    console.log('Signals created:', signalsCreated);
    console.log('Signals updated:', signalsUpdated);
    console.log('Flows to trigger:', flowsToTrigger);
    console.log('By type:', signalsByType);

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: users.length,
        signals_created: signalsCreated,
        signals_updated: signalsUpdated,
        flows_to_trigger: flowsToTrigger,
        signals_by_type: signalsByType,
        expired_cleaned: expiredCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Predictive engine error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
