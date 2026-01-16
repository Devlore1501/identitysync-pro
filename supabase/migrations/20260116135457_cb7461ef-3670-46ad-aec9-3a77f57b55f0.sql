-- =====================================================
-- BEHAVIORAL SIGNALS: Advanced Computed Traits
-- =====================================================
-- This migration adds functions to calculate behavioral signals
-- that make Klaviyo segments and flows more intelligent

-- Drop existing function to recreate with full behavioral signals
DROP FUNCTION IF EXISTS public.update_computed_traits_fast(uuid, text, text, jsonb);

-- Create the enhanced computed traits function
CREATE OR REPLACE FUNCTION public.update_computed_traits_fast(
  p_unified_user_id UUID,
  p_event_type TEXT,
  p_event_name TEXT,
  p_properties JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_computed JSONB;
  v_intent_score NUMERIC;
  v_order_value NUMERIC;
  v_session_count INTEGER;
  v_products_viewed INTEGER;
  v_categories_viewed INTEGER;
  v_frequency_score INTEGER;
  v_depth_score INTEGER;
  v_top_category TEXT;
  v_drop_off_stage TEXT;
  v_has_order BOOLEAN;
  v_has_checkout BOOLEAN;
  v_has_cart BOOLEAN;
  v_has_product_view BOOLEAN;
  v_last_cart_at TIMESTAMPTZ;
  v_last_checkout_at TIMESTAMPTZ;
  v_last_order_at TIMESTAMPTZ;
  v_recency_days INTEGER;
  v_last_seen TIMESTAMPTZ;
BEGIN
  -- Get current computed and last_seen
  SELECT computed, last_seen_at INTO v_computed, v_last_seen
  FROM users_unified
  WHERE id = p_unified_user_id;

  v_computed := COALESCE(v_computed, '{}'::JSONB);

  -- =====================================================
  -- 1. INTENT SCORE (existing logic enhanced)
  -- =====================================================
  v_intent_score := COALESCE((v_computed->>'intent_score')::NUMERIC, 0);
  
  CASE p_event_type
    WHEN 'page' THEN
      v_intent_score := LEAST(v_intent_score + 1, 100);
    WHEN 'product' THEN
      IF p_event_name = 'Product Viewed' THEN
        v_intent_score := LEAST(v_intent_score + 5, 100);
      END IF;
    WHEN 'cart' THEN
      IF p_event_name = 'Product Added' THEN
        v_intent_score := LEAST(v_intent_score + 15, 100);
      ELSIF p_event_name = 'Cart Viewed' THEN
        v_intent_score := LEAST(v_intent_score + 10, 100);
      END IF;
    WHEN 'checkout' THEN
      v_intent_score := LEAST(v_intent_score + 25, 100);
    WHEN 'order' THEN
      v_intent_score := 100;
      -- Update LTV
      v_order_value := COALESCE((p_properties->>'total')::NUMERIC, (p_properties->>'value')::NUMERIC, 0);
      v_computed := jsonb_set(
        v_computed,
        '{lifetime_value}',
        to_jsonb(COALESCE((v_computed->>'lifetime_value')::NUMERIC, 0) + v_order_value)
      );
      v_computed := jsonb_set(
        v_computed,
        '{orders_count}',
        to_jsonb(COALESCE((v_computed->>'orders_count')::INTEGER, 0) + 1)
      );
  END CASE;

  -- =====================================================
  -- 2. SESSION COUNT & FREQUENCY SCORE (last 30 days)
  -- =====================================================
  SELECT COUNT(DISTINCT session_id)
  INTO v_session_count
  FROM events
  WHERE unified_user_id = p_unified_user_id
    AND session_id IS NOT NULL
    AND event_time > NOW() - INTERVAL '30 days';

  v_session_count := COALESCE(v_session_count, 1);
  
  -- Frequency score: 1 session = 10, 2 = 25, 3 = 40, 5+ = 70, 10+ = 100
  v_frequency_score := CASE 
    WHEN v_session_count >= 10 THEN 100
    WHEN v_session_count >= 5 THEN 70
    WHEN v_session_count >= 3 THEN 40
    WHEN v_session_count >= 2 THEN 25
    ELSE 10
  END;

  -- =====================================================
  -- 3. DEPTH SCORE (products and categories viewed)
  -- =====================================================
  SELECT COUNT(DISTINCT properties->>'product_id')
  INTO v_products_viewed
  FROM events
  WHERE unified_user_id = p_unified_user_id
    AND event_type = 'product'
    AND properties->>'product_id' IS NOT NULL;

  SELECT COUNT(DISTINCT COALESCE(
    properties->>'collection_handle',
    properties->>'category',
    properties->>'product_type'
  ))
  INTO v_categories_viewed
  FROM events
  WHERE unified_user_id = p_unified_user_id
    AND COALESCE(
      properties->>'collection_handle',
      properties->>'category',
      properties->>'product_type'
    ) IS NOT NULL;

  v_products_viewed := COALESCE(v_products_viewed, 0);
  v_categories_viewed := COALESCE(v_categories_viewed, 0);
  
  -- Depth score: products * 5 + categories * 10, max 100
  v_depth_score := LEAST(
    (v_products_viewed * 5) + (v_categories_viewed * 10),
    100
  );

  -- =====================================================
  -- 4. TOP CATEGORY (last 30 days)
  -- =====================================================
  SELECT COALESCE(
    properties->>'collection_handle',
    properties->>'category',
    properties->>'product_type'
  )
  INTO v_top_category
  FROM events
  WHERE unified_user_id = p_unified_user_id
    AND event_time > NOW() - INTERVAL '30 days'
    AND COALESCE(
      properties->>'collection_handle',
      properties->>'category',
      properties->>'product_type'
    ) IS NOT NULL
  GROUP BY COALESCE(
    properties->>'collection_handle',
    properties->>'category',
    properties->>'product_type'
  )
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- =====================================================
  -- 5. DROP-OFF STAGE (funnel analysis)
  -- =====================================================
  SELECT 
    EXISTS(SELECT 1 FROM events WHERE unified_user_id = p_unified_user_id AND event_type = 'order'),
    EXISTS(SELECT 1 FROM events WHERE unified_user_id = p_unified_user_id AND event_type = 'checkout'),
    EXISTS(SELECT 1 FROM events WHERE unified_user_id = p_unified_user_id AND event_type = 'cart'),
    EXISTS(SELECT 1 FROM events WHERE unified_user_id = p_unified_user_id AND event_type = 'product')
  INTO v_has_order, v_has_checkout, v_has_cart, v_has_product_view;

  v_drop_off_stage := CASE
    WHEN v_has_order THEN 'completed'
    WHEN v_has_checkout THEN 'checkout_abandoned'
    WHEN v_has_cart THEN 'cart_abandoned'
    WHEN v_has_product_view THEN 'browse_abandoned'
    ELSE 'visitor'
  END;

  -- =====================================================
  -- 6. ABANDONMENT TIMESTAMPS
  -- =====================================================
  -- Last cart without subsequent checkout
  IF v_has_cart AND NOT v_has_order THEN
    SELECT MAX(event_time)
    INTO v_last_cart_at
    FROM events
    WHERE unified_user_id = p_unified_user_id
      AND event_type = 'cart';
    
    -- Check if there's a checkout after the cart
    SELECT MAX(event_time)
    INTO v_last_checkout_at
    FROM events
    WHERE unified_user_id = p_unified_user_id
      AND event_type = 'checkout'
      AND event_time > COALESCE(v_last_cart_at, '1970-01-01'::TIMESTAMPTZ);
    
    -- If no checkout after cart, and cart is older than 30 min, it's abandoned
    IF v_last_checkout_at IS NULL AND v_last_cart_at < NOW() - INTERVAL '30 minutes' THEN
      v_computed := jsonb_set(v_computed, '{cart_abandoned_at}', to_jsonb(v_last_cart_at));
    END IF;
  END IF;

  -- Last checkout without subsequent order
  IF v_has_checkout AND NOT v_has_order THEN
    SELECT MAX(event_time)
    INTO v_last_checkout_at
    FROM events
    WHERE unified_user_id = p_unified_user_id
      AND event_type = 'checkout';
    
    SELECT MAX(event_time)
    INTO v_last_order_at
    FROM events
    WHERE unified_user_id = p_unified_user_id
      AND event_type = 'order'
      AND event_time > COALESCE(v_last_checkout_at, '1970-01-01'::TIMESTAMPTZ);
    
    IF v_last_order_at IS NULL AND v_last_checkout_at < NOW() - INTERVAL '30 minutes' THEN
      v_computed := jsonb_set(v_computed, '{checkout_abandoned_at}', to_jsonb(v_last_checkout_at));
    END IF;
  END IF;

  -- =====================================================
  -- 7. RECENCY SCORE
  -- =====================================================
  v_recency_days := EXTRACT(DAY FROM (NOW() - COALESCE(v_last_seen, NOW())));

  -- =====================================================
  -- 8. UPDATE ALL COMPUTED TRAITS
  -- =====================================================
  UPDATE users_unified SET
    computed = jsonb_build_object(
      -- Core scores
      'intent_score', v_intent_score,
      'frequency_score', v_frequency_score,
      'depth_score', v_depth_score,
      'recency_days', v_recency_days,
      
      -- Behavioral signals
      'top_category_30d', v_top_category,
      'drop_off_stage', v_drop_off_stage,
      
      -- Counts
      'unique_products_viewed', v_products_viewed,
      'unique_categories_viewed', v_categories_viewed,
      'session_count_30d', v_session_count,
      
      -- Revenue
      'lifetime_value', COALESCE((v_computed->>'lifetime_value')::NUMERIC, 0),
      'orders_count', COALESCE((v_computed->>'orders_count')::INTEGER, 0),
      
      -- Abandonment timestamps (preserve if set)
      'cart_abandoned_at', v_computed->>'cart_abandoned_at',
      'checkout_abandoned_at', v_computed->>'checkout_abandoned_at',
      
      -- Metadata
      'last_computed_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = p_unified_user_id;
END;
$$;

-- =====================================================
-- BATCH RECOMPUTE FUNCTION (for background processing)
-- =====================================================
CREATE OR REPLACE FUNCTION public.recompute_behavioral_signals_batch(
  p_limit INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Recompute for users who have recent activity but stale computed traits
  FOR v_user IN
    SELECT u.id
    FROM users_unified u
    WHERE u.last_seen_at > NOW() - INTERVAL '7 days'
      AND (
        u.computed->>'last_computed_at' IS NULL
        OR (u.computed->>'last_computed_at')::TIMESTAMPTZ < NOW() - INTERVAL '1 hour'
      )
    ORDER BY u.last_seen_at DESC
    LIMIT p_limit
  LOOP
    -- Call update with dummy event to trigger recomputation
    PERFORM update_computed_traits_fast(v_user.id, 'system', 'recompute', '{}'::JSONB);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- =====================================================
-- RECENCY DECAY FUNCTION (call daily via cron)
-- =====================================================
CREATE OR REPLACE FUNCTION public.decay_recency_scores()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Update recency_days for all users based on last_seen_at
  UPDATE users_unified
  SET computed = jsonb_set(
    computed,
    '{recency_days}',
    to_jsonb(EXTRACT(DAY FROM (NOW() - last_seen_at))::INTEGER)
  )
  WHERE last_seen_at < NOW() - INTERVAL '1 day';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_computed_traits_fast(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_behavioral_signals_batch(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.decay_recency_scores() TO service_role;