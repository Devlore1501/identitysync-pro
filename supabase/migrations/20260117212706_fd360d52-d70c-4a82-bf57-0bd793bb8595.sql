-- ==============================================
-- PREDICTIVE SIGNALS TABLE
-- ==============================================

CREATE TABLE public.predictive_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  unified_user_id UUID NOT NULL REFERENCES public.users_unified(id) ON DELETE CASCADE,
  
  -- Signal identification
  signal_type TEXT NOT NULL, -- 'high_intent_cart', 'checkout_urgency', 'browse_warming', 'churn_risk', 'category_interest'
  signal_name TEXT NOT NULL,
  
  -- Signal data
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  payload JSONB NOT NULL DEFAULT '{}',
  
  -- Sync status tracking
  synced_to JSONB NOT NULL DEFAULT '{}', -- {"klaviyo": "2024-01-01T00:00:00Z", "meta": null}
  last_synced_at TIMESTAMPTZ,
  
  -- Flow trigger tracking
  should_trigger_flow BOOLEAN NOT NULL DEFAULT false,
  flow_triggered_at TIMESTAMPTZ,
  flow_name TEXT,
  
  -- Timestamps and expiry
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- TTL for temporary signals
  
  -- Prevent duplicates
  CONSTRAINT unique_active_signal UNIQUE (workspace_id, unified_user_id, signal_type)
);

-- Indexes for fast queries
CREATE INDEX idx_predictive_signals_workspace ON public.predictive_signals(workspace_id);
CREATE INDEX idx_predictive_signals_user ON public.predictive_signals(unified_user_id);
CREATE INDEX idx_predictive_signals_type ON public.predictive_signals(signal_type);
CREATE INDEX idx_predictive_signals_pending_sync ON public.predictive_signals(workspace_id, should_trigger_flow) WHERE should_trigger_flow = true AND flow_triggered_at IS NULL;
CREATE INDEX idx_predictive_signals_expires ON public.predictive_signals(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.predictive_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view predictive signals for their workspaces"
  ON public.predictive_signals
  FOR SELECT
  USING (user_has_workspace_access(auth.uid(), workspace_id));

-- Auto-update updated_at
CREATE TRIGGER update_predictive_signals_updated_at
  BEFORE UPDATE ON public.predictive_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================
-- IMPROVE update_computed_traits_fast FUNCTION
-- ==============================================

CREATE OR REPLACE FUNCTION public.update_computed_traits_fast(
  p_unified_user_id UUID,
  p_event_type TEXT,
  p_event_name TEXT,
  p_properties JSONB
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_computed JSONB;
  v_intent_score INTEGER;
  v_frequency_score INTEGER;
  v_depth_score INTEGER;
  v_product_views INTEGER;
  v_atc_count INTEGER;
  v_ltv NUMERIC;
  v_orders_count INTEGER;
  v_category TEXT;
  v_session_count INTEGER;
  v_drop_off_stage TEXT;
  v_last_product_viewed_at TIMESTAMPTZ;
  v_last_cart_at TIMESTAMPTZ;
  v_checkout_abandoned_at TIMESTAMPTZ;
  v_cart_abandoned_at TIMESTAMPTZ;
  v_unique_products INTEGER;
  v_unique_categories INTEGER;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Get current computed values
  SELECT computed INTO v_computed
  FROM users_unified
  WHERE id = p_unified_user_id;

  -- Extract existing values with defaults
  v_intent_score := COALESCE((v_computed->>'intent_score')::INTEGER, 0);
  v_frequency_score := COALESCE((v_computed->>'frequency_score')::INTEGER, 10);
  v_depth_score := COALESCE((v_computed->>'depth_score')::INTEGER, 0);
  v_product_views := COALESCE((v_computed->>'product_views_7d')::INTEGER, 0);
  v_atc_count := COALESCE((v_computed->>'atc_7d')::INTEGER, 0);
  v_ltv := COALESCE((v_computed->>'lifetime_value')::NUMERIC, 0);
  v_orders_count := COALESCE((v_computed->>'orders_count')::INTEGER, 0);
  v_session_count := COALESCE((v_computed->>'session_count_30d')::INTEGER, 1);
  v_drop_off_stage := COALESCE(v_computed->>'drop_off_stage', 'browsing');
  v_last_product_viewed_at := (v_computed->>'last_product_viewed_at')::TIMESTAMPTZ;
  v_last_cart_at := (v_computed->>'last_cart_at')::TIMESTAMPTZ;
  v_checkout_abandoned_at := (v_computed->>'checkout_abandoned_at')::TIMESTAMPTZ;
  v_cart_abandoned_at := (v_computed->>'cart_abandoned_at')::TIMESTAMPTZ;
  v_unique_products := COALESCE((v_computed->>'unique_products_viewed')::INTEGER, 0);
  v_unique_categories := COALESCE((v_computed->>'unique_categories_viewed')::INTEGER, 0);

  -- Update scores based on event type
  CASE p_event_type
    WHEN 'page' THEN
      v_intent_score := LEAST(v_intent_score + 1, 100);
      v_frequency_score := LEAST(v_frequency_score + 2, 100);
      
    WHEN 'product' THEN
      IF p_event_name IN ('Product Viewed', 'View Item') THEN
        v_intent_score := LEAST(v_intent_score + 5, 100);
        v_depth_score := LEAST(v_depth_score + 3, 100);
        v_product_views := v_product_views + 1;
        v_unique_products := v_unique_products + 1;
        v_last_product_viewed_at := v_now;
        v_drop_off_stage := 'engaged';
        v_category := p_properties->>'category';
        IF v_category IS NOT NULL THEN
          v_unique_categories := v_unique_categories + 1;
        END IF;
      END IF;
      
    WHEN 'cart' THEN
      IF p_event_name IN ('Product Added', 'Add to Cart') THEN
        v_intent_score := LEAST(v_intent_score + 15, 100);
        v_depth_score := LEAST(v_depth_score + 10, 100);
        v_atc_count := v_atc_count + 1;
        v_last_cart_at := v_now;
        v_drop_off_stage := 'cart';
        v_cart_abandoned_at := v_now; -- Will be cleared if checkout starts
      ELSIF p_event_name = 'Cart Viewed' THEN
        v_intent_score := LEAST(v_intent_score + 10, 100);
        v_last_cart_at := v_now;
        v_drop_off_stage := 'cart';
      END IF;
      
    WHEN 'checkout' THEN
      v_intent_score := LEAST(v_intent_score + 25, 100);
      v_depth_score := LEAST(v_depth_score + 20, 100);
      v_drop_off_stage := 'checkout';
      v_checkout_abandoned_at := v_now;
      v_cart_abandoned_at := NULL; -- Clear cart abandoned since they moved to checkout
      
    WHEN 'order' THEN
      v_intent_score := 100;
      v_ltv := v_ltv + COALESCE((p_properties->>'total')::NUMERIC, (p_properties->>'value')::NUMERIC, 0);
      v_orders_count := v_orders_count + 1;
      v_drop_off_stage := 'purchased';
      v_checkout_abandoned_at := NULL; -- Clear abandonment
      v_cart_abandoned_at := NULL;
      
    WHEN 'session' THEN
      v_session_count := v_session_count + 1;
      v_frequency_score := LEAST(v_frequency_score + 5, 100);
      
    ELSE
      -- For 'system', 'identify', or other types, don't modify intent score
      NULL;
  END CASE;

  -- Build updated computed object
  v_computed := jsonb_build_object(
    'intent_score', v_intent_score,
    'frequency_score', v_frequency_score,
    'depth_score', v_depth_score,
    'product_views_7d', v_product_views,
    'atc_7d', v_atc_count,
    'lifetime_value', v_ltv,
    'orders_count', v_orders_count,
    'top_category', COALESCE(v_category, v_computed->>'top_category'),
    'session_count_30d', v_session_count,
    'unique_products_viewed', v_unique_products,
    'unique_categories_viewed', v_unique_categories,
    'drop_off_stage', v_drop_off_stage,
    'last_product_viewed_at', v_last_product_viewed_at,
    'last_cart_at', v_last_cart_at,
    'cart_abandoned_at', v_cart_abandoned_at,
    'checkout_abandoned_at', v_checkout_abandoned_at,
    'last_event_type', p_event_type,
    'last_event_name', p_event_name,
    'computed_at', v_now,
    'recency_days', 0
  );

  -- Update user
  UPDATE users_unified
  SET 
    computed = v_computed,
    last_seen_at = v_now,
    updated_at = v_now
  WHERE id = p_unified_user_id;
END;
$$;

-- ==============================================
-- FUNCTION TO RECOMPUTE ALL SIGNALS FROM EVENTS
-- ==============================================

CREATE OR REPLACE FUNCTION public.recompute_user_signals_from_events(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event RECORD;
  v_computed JSONB := '{}'::JSONB;
  v_intent_score INTEGER := 0;
  v_frequency_score INTEGER := 10;
  v_depth_score INTEGER := 0;
  v_product_views INTEGER := 0;
  v_atc_count INTEGER := 0;
  v_ltv NUMERIC := 0;
  v_orders_count INTEGER := 0;
  v_session_count INTEGER := 0;
  v_unique_products INTEGER := 0;
  v_unique_categories INTEGER := 0;
  v_drop_off_stage TEXT := 'browsing';
  v_last_product_viewed_at TIMESTAMPTZ;
  v_last_cart_at TIMESTAMPTZ;
  v_checkout_abandoned_at TIMESTAMPTZ;
  v_cart_abandoned_at TIMESTAMPTZ;
  v_top_category TEXT;
  v_category_counts JSONB := '{}'::JSONB;
  v_products_seen TEXT[] := ARRAY[]::TEXT[];
  v_categories_seen TEXT[] := ARRAY[]::TEXT[];
  v_now TIMESTAMPTZ := now();
  v_seven_days_ago TIMESTAMPTZ := now() - INTERVAL '7 days';
  v_thirty_days_ago TIMESTAMPTZ := now() - INTERVAL '30 days';
BEGIN
  -- Process all events for this user chronologically
  FOR v_event IN
    SELECT event_type, event_name, properties, event_time
    FROM events
    WHERE unified_user_id = p_user_id
    ORDER BY event_time ASC
  LOOP
    -- Count sessions in last 30 days
    IF v_event.event_type = 'session' AND v_event.event_time >= v_thirty_days_ago THEN
      v_session_count := v_session_count + 1;
    END IF;
    
    -- Process by event type (only for events in relevant time windows)
    CASE v_event.event_type
      WHEN 'page' THEN
        IF v_event.event_time >= v_thirty_days_ago THEN
          v_intent_score := LEAST(v_intent_score + 1, 100);
          v_frequency_score := LEAST(v_frequency_score + 1, 100);
        END IF;
        
      WHEN 'product' THEN
        IF v_event.event_name IN ('Product Viewed', 'View Item') THEN
          IF v_event.event_time >= v_seven_days_ago THEN
            v_product_views := v_product_views + 1;
          END IF;
          IF v_event.event_time >= v_thirty_days_ago THEN
            v_intent_score := LEAST(v_intent_score + 5, 100);
            v_depth_score := LEAST(v_depth_score + 3, 100);
          END IF;
          v_last_product_viewed_at := v_event.event_time;
          v_drop_off_stage := 'engaged';
          
          -- Track unique products
          IF v_event.properties->>'product_id' IS NOT NULL AND 
             NOT (v_event.properties->>'product_id' = ANY(v_products_seen)) THEN
            v_products_seen := array_append(v_products_seen, v_event.properties->>'product_id');
          END IF;
          
          -- Track categories
          IF v_event.properties->>'category' IS NOT NULL THEN
            IF NOT (v_event.properties->>'category' = ANY(v_categories_seen)) THEN
              v_categories_seen := array_append(v_categories_seen, v_event.properties->>'category');
            END IF;
            -- Count category occurrences
            v_category_counts := v_category_counts || jsonb_build_object(
              v_event.properties->>'category',
              COALESCE((v_category_counts->>v_event.properties->>'category')::INTEGER, 0) + 1
            );
          END IF;
        END IF;
        
      WHEN 'cart' THEN
        IF v_event.event_name IN ('Product Added', 'Add to Cart') THEN
          IF v_event.event_time >= v_seven_days_ago THEN
            v_atc_count := v_atc_count + 1;
          END IF;
          IF v_event.event_time >= v_thirty_days_ago THEN
            v_intent_score := LEAST(v_intent_score + 15, 100);
            v_depth_score := LEAST(v_depth_score + 10, 100);
          END IF;
          v_last_cart_at := v_event.event_time;
          v_cart_abandoned_at := v_event.event_time;
          v_drop_off_stage := 'cart';
        END IF;
        
      WHEN 'checkout' THEN
        IF v_event.event_time >= v_thirty_days_ago THEN
          v_intent_score := LEAST(v_intent_score + 25, 100);
          v_depth_score := LEAST(v_depth_score + 20, 100);
        END IF;
        v_checkout_abandoned_at := v_event.event_time;
        v_cart_abandoned_at := NULL;
        v_drop_off_stage := 'checkout';
        
      WHEN 'order' THEN
        v_ltv := v_ltv + COALESCE((v_event.properties->>'total')::NUMERIC, (v_event.properties->>'value')::NUMERIC, 0);
        v_orders_count := v_orders_count + 1;
        v_checkout_abandoned_at := NULL;
        v_cart_abandoned_at := NULL;
        IF v_event.event_time >= v_thirty_days_ago THEN
          v_intent_score := 100;
        END IF;
        v_drop_off_stage := 'purchased';
        
      ELSE
        NULL;
    END CASE;
  END LOOP;
  
  -- Find top category
  SELECT key INTO v_top_category
  FROM jsonb_each_text(v_category_counts)
  ORDER BY value::INTEGER DESC
  LIMIT 1;
  
  v_unique_products := array_length(v_products_seen, 1);
  v_unique_categories := array_length(v_categories_seen, 1);

  -- Build computed traits
  v_computed := jsonb_build_object(
    'intent_score', v_intent_score,
    'frequency_score', v_frequency_score,
    'depth_score', v_depth_score,
    'product_views_7d', v_product_views,
    'atc_7d', v_atc_count,
    'lifetime_value', v_ltv,
    'orders_count', v_orders_count,
    'top_category', v_top_category,
    'session_count_30d', GREATEST(v_session_count, 1),
    'unique_products_viewed', COALESCE(v_unique_products, 0),
    'unique_categories_viewed', COALESCE(v_unique_categories, 0),
    'drop_off_stage', v_drop_off_stage,
    'last_product_viewed_at', v_last_product_viewed_at,
    'last_cart_at', v_last_cart_at,
    'cart_abandoned_at', v_cart_abandoned_at,
    'checkout_abandoned_at', v_checkout_abandoned_at,
    'computed_at', v_now,
    'recency_days', 0,
    'recomputed_from_events', true
  );

  -- Update the user
  UPDATE users_unified
  SET 
    computed = v_computed,
    updated_at = v_now
  WHERE id = p_user_id;

  RETURN v_computed;
END;
$$;

-- ==============================================
-- FUNCTION TO MERGE ANONYMOUS USER INTO IDENTIFIED
-- ==============================================

CREATE OR REPLACE FUNCTION public.merge_anonymous_to_identified(
  p_workspace_id UUID,
  p_anonymous_id TEXT,
  p_identified_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_anonymous_user_id UUID;
  v_anonymous_computed JSONB;
  v_identified_computed JSONB;
  v_merged_computed JSONB;
  v_events_updated INTEGER := 0;
  v_identities_merged INTEGER := 0;
BEGIN
  -- Find the anonymous user by anonymous_id
  SELECT id, computed INTO v_anonymous_user_id, v_anonymous_computed
  FROM users_unified
  WHERE workspace_id = p_workspace_id
    AND p_anonymous_id = ANY(anonymous_ids)
    AND id != p_identified_user_id
  LIMIT 1;
  
  IF v_anonymous_user_id IS NULL THEN
    -- No anonymous user to merge
    RETURN jsonb_build_object('merged', false, 'reason', 'no_anonymous_user_found');
  END IF;
  
  -- Get identified user's computed traits
  SELECT computed INTO v_identified_computed
  FROM users_unified
  WHERE id = p_identified_user_id;
  
  -- Merge computed traits (take max values)
  v_merged_computed := jsonb_build_object(
    'intent_score', GREATEST(
      COALESCE((v_anonymous_computed->>'intent_score')::INTEGER, 0),
      COALESCE((v_identified_computed->>'intent_score')::INTEGER, 0)
    ),
    'frequency_score', GREATEST(
      COALESCE((v_anonymous_computed->>'frequency_score')::INTEGER, 0),
      COALESCE((v_identified_computed->>'frequency_score')::INTEGER, 0)
    ),
    'depth_score', GREATEST(
      COALESCE((v_anonymous_computed->>'depth_score')::INTEGER, 0),
      COALESCE((v_identified_computed->>'depth_score')::INTEGER, 0)
    ),
    'product_views_7d', 
      COALESCE((v_anonymous_computed->>'product_views_7d')::INTEGER, 0) +
      COALESCE((v_identified_computed->>'product_views_7d')::INTEGER, 0),
    'atc_7d',
      COALESCE((v_anonymous_computed->>'atc_7d')::INTEGER, 0) +
      COALESCE((v_identified_computed->>'atc_7d')::INTEGER, 0),
    'session_count_30d',
      COALESCE((v_anonymous_computed->>'session_count_30d')::INTEGER, 0) +
      COALESCE((v_identified_computed->>'session_count_30d')::INTEGER, 0),
    'lifetime_value', COALESCE((v_identified_computed->>'lifetime_value')::NUMERIC, 0),
    'orders_count', COALESCE((v_identified_computed->>'orders_count')::INTEGER, 0),
    'unique_products_viewed',
      COALESCE((v_anonymous_computed->>'unique_products_viewed')::INTEGER, 0) +
      COALESCE((v_identified_computed->>'unique_products_viewed')::INTEGER, 0),
    'unique_categories_viewed',
      COALESCE((v_anonymous_computed->>'unique_categories_viewed')::INTEGER, 0) +
      COALESCE((v_identified_computed->>'unique_categories_viewed')::INTEGER, 0),
    'drop_off_stage', COALESCE(
      v_identified_computed->>'drop_off_stage',
      v_anonymous_computed->>'drop_off_stage',
      'browsing'
    ),
    'last_product_viewed_at', COALESCE(
      v_identified_computed->>'last_product_viewed_at',
      v_anonymous_computed->>'last_product_viewed_at'
    ),
    'last_cart_at', COALESCE(
      v_identified_computed->>'last_cart_at',
      v_anonymous_computed->>'last_cart_at'
    ),
    'cart_abandoned_at', COALESCE(
      v_identified_computed->>'cart_abandoned_at',
      v_anonymous_computed->>'cart_abandoned_at'
    ),
    'checkout_abandoned_at', COALESCE(
      v_identified_computed->>'checkout_abandoned_at',
      v_anonymous_computed->>'checkout_abandoned_at'
    ),
    'top_category', COALESCE(
      v_identified_computed->>'top_category',
      v_anonymous_computed->>'top_category'
    ),
    'merged_from', v_anonymous_user_id,
    'merged_at', now(),
    'computed_at', now()
  );
  
  -- Update all events from anonymous user to identified user
  UPDATE events
  SET unified_user_id = p_identified_user_id
  WHERE unified_user_id = v_anonymous_user_id;
  GET DIAGNOSTICS v_events_updated = ROW_COUNT;
  
  -- Update all identities from anonymous user to identified user
  UPDATE identities
  SET unified_user_id = p_identified_user_id
  WHERE unified_user_id = v_anonymous_user_id;
  GET DIAGNOSTICS v_identities_merged = ROW_COUNT;
  
  -- Add anonymous_id to identified user's anonymous_ids array
  UPDATE users_unified
  SET 
    anonymous_ids = array_cat(anonymous_ids, (SELECT anonymous_ids FROM users_unified WHERE id = v_anonymous_user_id)),
    computed = v_merged_computed,
    first_seen_at = LEAST(
      first_seen_at,
      (SELECT first_seen_at FROM users_unified WHERE id = v_anonymous_user_id)
    ),
    updated_at = now()
  WHERE id = p_identified_user_id;
  
  -- Delete the anonymous user (events and identities already moved)
  DELETE FROM users_unified WHERE id = v_anonymous_user_id;
  
  RETURN jsonb_build_object(
    'merged', true,
    'anonymous_user_id', v_anonymous_user_id,
    'identified_user_id', p_identified_user_id,
    'events_transferred', v_events_updated,
    'identities_merged', v_identities_merged,
    'computed_traits', v_merged_computed
  );
END;
$$;