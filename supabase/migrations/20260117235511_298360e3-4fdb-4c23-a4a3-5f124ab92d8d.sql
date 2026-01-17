-- =============================================
-- FASE 1: DEDUPLICA & IDEMPOTENZA
-- Nuovo fingerprint con checkout_id/cart_token/order_id prioritari
-- Unique constraint su dedupe_key per workspace
-- dupe_count per tracking duplicati
-- =============================================

-- 1. Aggiungi colonna dupe_count se non esiste
ALTER TABLE events ADD COLUMN IF NOT EXISTS dupe_count INTEGER DEFAULT 0;

-- 2. Prima pulisci eventuali duplicati esistenti (mantieni solo il primo per dedupe_key)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY workspace_id, dedupe_key ORDER BY created_at) as rn
  FROM events
  WHERE dedupe_key IS NOT NULL
)
DELETE FROM events 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 3. Crea unique constraint su (workspace_id, dedupe_key)
DROP INDEX IF EXISTS idx_events_dedupe_unique;
CREATE UNIQUE INDEX idx_events_dedupe_unique 
ON events(workspace_id, dedupe_key) 
WHERE dedupe_key IS NOT NULL;

-- 4. Drop e ricrea la funzione process_event_fast con nuovo fingerprint
DROP FUNCTION IF EXISTS process_event_fast(uuid, text, text, jsonb, jsonb, text, text, text, text, text, text, jsonb, timestamptz);

CREATE OR REPLACE FUNCTION process_event_fast(
  p_workspace_id UUID,
  p_event_type TEXT,
  p_event_name TEXT,
  p_properties JSONB,
  p_context JSONB,
  p_anonymous_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_customer_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'js',
  p_session_id TEXT DEFAULT NULL,
  p_consent_state JSONB DEFAULT NULL,
  p_event_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(event_id UUID, unified_user_id UUID, is_duplicate BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unified_user_id UUID;
  v_event_id UUID;
  v_dedupe_key TEXT;
  v_existing_event_id UUID;
  v_primary_key TEXT;
  v_rounded_time TIMESTAMPTZ;
BEGIN
  -- 1. Risolvi identity
  v_unified_user_id := resolve_identity(
    p_workspace_id := p_workspace_id,
    p_anonymous_id := COALESCE(p_anonymous_id, 'anon_' || gen_random_uuid()::TEXT),
    p_email := p_email,
    p_phone := p_phone,
    p_customer_id := p_customer_id,
    p_source := p_source
  );

  -- 2. NUOVO FINGERPRINT MIGLIORATO
  -- Priorità: checkout_id > cart_token > order_id > token > product_id
  v_primary_key := COALESCE(
    p_properties->>'checkout_id',
    p_properties->>'checkout_token',
    p_properties->>'cart_token',
    p_properties->>'order_id',
    p_properties->>'order_number',
    p_properties->>'token',
    NULL
  );
  
  IF v_primary_key IS NOT NULL THEN
    -- Fingerprint basato su identificatore univoco transazione
    -- Stesso checkout/cart/order = stesso fingerprint (no duplicati)
    v_dedupe_key := md5(
      p_workspace_id::TEXT || '::' ||
      p_event_name || '::' ||
      v_primary_key
    );
  ELSE
    -- Fallback: anonymous_id + session_id + event_name + timestamp arrotondato a 5 minuti
    v_rounded_time := date_trunc('hour', p_event_time) + 
                      INTERVAL '5 min' * FLOOR(EXTRACT(MINUTE FROM p_event_time) / 5);
    
    v_dedupe_key := md5(
      p_workspace_id::TEXT || '::' ||
      p_event_name || '::' ||
      COALESCE(p_anonymous_id, '') || '::' ||
      COALESCE(p_session_id, '') || '::' ||
      to_char(v_rounded_time, 'YYYY-MM-DD-HH24-MI')
    );
  END IF;

  -- 3. Check se duplicato
  SELECT id INTO v_existing_event_id
  FROM events
  WHERE workspace_id = p_workspace_id
    AND dedupe_key = v_dedupe_key
  LIMIT 1;

  IF v_existing_event_id IS NOT NULL THEN
    -- È un duplicato - incrementa counter e aggiorna last_seen
    UPDATE events 
    SET dupe_count = COALESCE(dupe_count, 0) + 1
    WHERE id = v_existing_event_id;
    
    -- Aggiorna last_seen_at utente
    UPDATE users_unified 
    SET last_seen_at = NOW(), updated_at = NOW()
    WHERE id = v_unified_user_id;
    
    RETURN QUERY SELECT v_existing_event_id, v_unified_user_id, TRUE;
    RETURN;
  END IF;

  -- 4. Inserisci evento
  INSERT INTO events (
    workspace_id,
    unified_user_id,
    event_type,
    event_name,
    properties,
    context,
    anonymous_id,
    session_id,
    source,
    consent_state,
    dedupe_key,
    event_time,
    status,
    dupe_count
  ) VALUES (
    p_workspace_id,
    v_unified_user_id,
    p_event_type,
    p_event_name,
    p_properties,
    p_context,
    p_anonymous_id,
    p_session_id,
    p_source,
    p_consent_state,
    v_dedupe_key,
    p_event_time,
    'pending',
    0
  )
  RETURNING id INTO v_event_id;

  -- 5. Aggiorna last_seen_at utente
  UPDATE users_unified 
  SET last_seen_at = NOW(), updated_at = NOW()
  WHERE id = v_unified_user_id;

  RETURN QUERY SELECT v_event_id, v_unified_user_id, FALSE;
END;
$$;

-- 5. Aggiungi flag send_events_to_klaviyo per destinations
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS send_events_to_klaviyo BOOLEAN DEFAULT false;

-- 6. Aggiungi flag klaviyo_properties_bootstrapped per workspaces.settings
-- (questo viene gestito via JSONB, non serve ALTER)

-- 7. Aggiungi campi computed per state machine
-- Questi sono già in computed JSONB, ma assicuriamoci che update_computed_traits_fast li gestisca

-- 8. Ricrea update_computed_traits_fast con pesi corretti e state machine
DROP FUNCTION IF EXISTS update_computed_traits_fast(uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION update_computed_traits_fast(
  p_unified_user_id UUID,
  p_event_type TEXT,
  p_event_name TEXT,
  p_properties JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_computed JSONB;
  v_new_computed JSONB;
  v_intent_score INTEGER;
  v_weight INTEGER;
  v_drop_off_stage TEXT;
  v_new_stage TEXT;
  v_checkout_id TEXT;
  v_cart_token TEXT;
  v_order_id TEXT;
BEGIN
  -- Ottieni computed corrente
  SELECT computed INTO v_current_computed
  FROM users_unified
  WHERE id = p_unified_user_id;
  
  v_current_computed := COALESCE(v_current_computed, '{}'::JSONB);
  v_intent_score := COALESCE((v_current_computed->>'intent_score')::INTEGER, 0);
  v_drop_off_stage := COALESCE(v_current_computed->>'drop_off_stage', 'browsing');
  
  -- Estrai identificatori transazione
  v_checkout_id := p_properties->>'checkout_id';
  v_cart_token := p_properties->>'cart_token';
  v_order_id := COALESCE(p_properties->>'order_id', p_properties->>'order_number');
  
  -- PESI EVENTI (come da requisiti)
  v_weight := CASE 
    WHEN p_event_name ILIKE '%page%view%' THEN 1
    WHEN p_event_name ILIKE '%collection%view%' THEN 2
    WHEN p_event_name ILIKE '%product%viewed%' THEN 3
    WHEN p_event_name ILIKE '%view%item%' THEN 3
    WHEN p_event_name ILIKE '%search%' THEN 4
    WHEN p_event_name ILIKE '%shipping%' OR p_event_name ILIKE '%returns%' THEN 5
    WHEN p_event_name ILIKE '%add%to%cart%' OR p_event_name ILIKE '%product%added%' THEN 10
    WHEN p_event_name ILIKE '%remove%cart%' THEN -5
    WHEN p_event_name ILIKE '%checkout%' OR p_event_name ILIKE '%started%checkout%' THEN 20
    WHEN p_event_name ILIKE '%payment%' THEN 10
    WHEN p_event_name ILIKE '%order%' OR p_event_name ILIKE '%purchase%' OR p_event_name ILIKE '%placed%' THEN 0 -- reset separato
    ELSE 1
  END;
  
  -- Applica peso (cap a 100)
  v_intent_score := LEAST(v_intent_score + v_weight, 100);
  
  -- STATE MACHINE per drop_off_stage
  v_new_stage := v_drop_off_stage;
  
  IF p_event_type = 'order' OR p_event_name ILIKE '%order%completed%' OR p_event_name ILIKE '%placed%order%' THEN
    -- PURCHASE: reset completo
    v_new_stage := 'purchased';
    v_intent_score := 100; -- max score at purchase
    v_new_computed := v_current_computed || jsonb_build_object(
      'order_completed_at', NOW(),
      'order_id', v_order_id,
      'last_order_date', NOW(),
      'orders_count', COALESCE((v_current_computed->>'orders_count')::INTEGER, 0) + 1,
      'cart_abandoned_at', NULL,
      'checkout_abandoned_at', NULL
    );
  ELSIF p_event_type = 'checkout' OR p_event_name ILIKE '%checkout%' THEN
    -- CHECKOUT
    IF v_drop_off_stage NOT IN ('purchased') THEN
      v_new_stage := 'checkout';
    END IF;
    v_new_computed := v_current_computed || jsonb_build_object(
      'checkout_started_at', NOW(),
      'last_checkout_id', COALESCE(v_checkout_id, p_properties->>'checkout_token'),
      'cart_abandoned_at', NULL -- reset se torna in checkout
    );
  ELSIF p_event_type = 'cart' OR p_event_name ILIKE '%add%cart%' THEN
    -- ADD TO CART
    IF v_drop_off_stage NOT IN ('checkout', 'purchased') THEN
      v_new_stage := 'cart';
    END IF;
    v_new_computed := v_current_computed || jsonb_build_object(
      'last_cart_at', NOW(),
      'last_cart_token', v_cart_token,
      'atc_count_7d', COALESCE((v_current_computed->>'atc_count_7d')::INTEGER, 0) + 1
    );
  ELSIF p_event_type = 'product' OR p_event_name ILIKE '%product%' OR p_event_name ILIKE '%view%item%' THEN
    -- PRODUCT VIEW
    IF v_drop_off_stage = 'browsing' THEN
      v_new_stage := 'engaged';
    END IF;
    v_new_computed := v_current_computed || jsonb_build_object(
      'last_product_view_at', NOW(),
      'viewed_products_7d', COALESCE((v_current_computed->>'viewed_products_7d')::INTEGER, 0) + 1,
      'top_category', COALESCE(
        p_properties->>'category',
        p_properties->>'product_category',
        v_current_computed->>'top_category'
      )
    );
  ELSE
    v_new_computed := v_current_computed;
  END IF;
  
  -- Costruisci computed finale
  v_new_computed := v_new_computed || jsonb_build_object(
    'intent_score', v_intent_score,
    'drop_off_stage', v_new_stage,
    'last_action', p_event_name,
    'last_action_at', NOW(),
    'last_event_type', p_event_type,
    'session_count_30d', COALESCE((v_current_computed->>'session_count_30d')::INTEGER, 0) + 1,
    'computed_at', NOW()
  );
  
  -- Update utente
  UPDATE users_unified
  SET 
    computed = v_new_computed,
    updated_at = NOW()
  WHERE id = p_unified_user_id;
END;
$$;

-- 9. Crea funzione per rilevare abandonment (chiamata periodicamente)
CREATE OR REPLACE FUNCTION detect_abandonments(p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE(users_updated INTEGER, cart_abandoned INTEGER, checkout_abandoned INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_count INTEGER := 0;
  v_checkout_count INTEGER := 0;
BEGIN
  -- CART ABANDONED: last_cart_at > 60 min senza checkout
  WITH cart_abandoned_users AS (
    UPDATE users_unified
    SET computed = computed || jsonb_build_object(
      'cart_abandoned_at', NOW(),
      'drop_off_stage', 'cart_abandoned'
    ),
    updated_at = NOW()
    WHERE (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      AND computed->>'last_cart_at' IS NOT NULL
      AND (computed->>'cart_abandoned_at') IS NULL
      AND (computed->>'order_completed_at') IS NULL
      -- Non ha fatto checkout dopo cart
      AND (
        (computed->>'checkout_started_at') IS NULL 
        OR (computed->>'checkout_started_at')::TIMESTAMPTZ < (computed->>'last_cart_at')::TIMESTAMPTZ
      )
      -- Ultimo cart > 60 minuti fa
      AND (computed->>'last_cart_at')::TIMESTAMPTZ < NOW() - INTERVAL '60 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cart_count FROM cart_abandoned_users;
  
  -- CHECKOUT ABANDONED: checkout_started_at > 180 min senza order
  WITH checkout_abandoned_users AS (
    UPDATE users_unified
    SET computed = computed || jsonb_build_object(
      'checkout_abandoned_at', NOW(),
      'drop_off_stage', 'checkout_abandoned'
    ),
    updated_at = NOW()
    WHERE (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      AND computed->>'checkout_started_at' IS NOT NULL
      AND (computed->>'checkout_abandoned_at') IS NULL
      AND (computed->>'order_completed_at') IS NULL
      -- Ultimo checkout > 180 minuti fa
      AND (computed->>'checkout_started_at')::TIMESTAMPTZ < NOW() - INTERVAL '180 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_checkout_count FROM checkout_abandoned_users;
  
  RETURN QUERY SELECT 
    (v_cart_count + v_checkout_count)::INTEGER,
    v_cart_count,
    v_checkout_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_event_fast TO service_role;
GRANT EXECUTE ON FUNCTION update_computed_traits_fast TO service_role;
GRANT EXECUTE ON FUNCTION detect_abandonments TO service_role;