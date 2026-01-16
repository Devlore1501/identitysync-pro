-- Fix update_computed_traits_fast: add ELSE clause to handle unknown event types like 'system'
CREATE OR REPLACE FUNCTION public.update_computed_traits_fast(
  p_unified_user_id uuid,
  p_event_type text,
  p_event_name text,
  p_properties jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_computed jsonb;
  v_intent_score integer;
  v_product_views integer;
  v_atc_count integer;
  v_ltv numeric;
  v_orders_count integer;
  v_category text;
BEGIN
  -- Get current computed values
  SELECT computed INTO v_computed
  FROM users_unified
  WHERE id = p_unified_user_id;

  v_intent_score := COALESCE((v_computed->>'intent_score')::integer, 0);
  v_product_views := COALESCE((v_computed->>'product_views_7d')::integer, 0);
  v_atc_count := COALESCE((v_computed->>'atc_7d')::integer, 0);
  v_ltv := COALESCE((v_computed->>'lifetime_value')::numeric, 0);
  v_orders_count := COALESCE((v_computed->>'orders_count')::integer, 0);

  -- Update scores based on event type
  CASE p_event_type
    WHEN 'page' THEN
      v_intent_score := LEAST(v_intent_score + 1, 100);
    WHEN 'product' THEN
      IF p_event_name = 'Product Viewed' THEN
        v_intent_score := LEAST(v_intent_score + 5, 100);
        v_product_views := v_product_views + 1;
        v_category := p_properties->>'category';
      END IF;
    WHEN 'cart' THEN
      IF p_event_name = 'Product Added' THEN
        v_intent_score := LEAST(v_intent_score + 15, 100);
        v_atc_count := v_atc_count + 1;
      ELSIF p_event_name = 'Cart Viewed' THEN
        v_intent_score := LEAST(v_intent_score + 10, 100);
      END IF;
    WHEN 'checkout' THEN
      v_intent_score := LEAST(v_intent_score + 25, 100);
    WHEN 'order' THEN
      v_intent_score := 100;
      v_ltv := v_ltv + COALESCE((p_properties->>'total')::numeric, 0);
      v_orders_count := v_orders_count + 1;
    ELSE
      -- For 'system', 'identify', or other types, don't modify intent score
      NULL;
  END CASE;

  -- Build updated computed object
  v_computed := jsonb_build_object(
    'intent_score', v_intent_score,
    'product_views_7d', v_product_views,
    'atc_7d', v_atc_count,
    'lifetime_value', v_ltv,
    'orders_count', v_orders_count,
    'top_category', COALESCE(v_category, v_computed->>'top_category'),
    'last_event_type', p_event_type,
    'last_event_name', p_event_name,
    'computed_at', now()
  );

  -- Determine drop_off_stage based on last event
  IF p_event_type = 'checkout' AND p_event_name != 'Order Completed' THEN
    v_computed := v_computed || '{"drop_off_stage": "checkout"}'::jsonb;
  ELSIF p_event_type = 'cart' THEN
    v_computed := v_computed || '{"drop_off_stage": "cart"}'::jsonb;
  ELSIF p_event_type = 'product' THEN
    v_computed := v_computed || '{"drop_off_stage": "engaged"}'::jsonb;
  ELSIF p_event_type = 'order' THEN
    v_computed := v_computed || '{"drop_off_stage": "purchased"}'::jsonb;
  END IF;

  -- Update user
  UPDATE users_unified
  SET 
    computed = v_computed,
    updated_at = now()
  WHERE id = p_unified_user_id;
END;
$$;