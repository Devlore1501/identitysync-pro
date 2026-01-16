-- Fase 1: Database Functions per Performance

-- 1.1 Funzione per risolvere/creare identity in una singola chiamata
CREATE OR REPLACE FUNCTION public.resolve_identity(
  p_workspace_id UUID,
  p_anonymous_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_customer_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'pixel'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unified_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Prima cerca per anonymous_id
  SELECT id INTO v_unified_user_id
  FROM users_unified
  WHERE workspace_id = p_workspace_id
    AND p_anonymous_id = ANY(anonymous_ids)
  LIMIT 1;

  -- Se non trovato, cerca per email
  IF v_unified_user_id IS NULL AND p_email IS NOT NULL THEN
    SELECT id INTO v_unified_user_id
    FROM users_unified
    WHERE workspace_id = p_workspace_id
      AND (primary_email = p_email OR p_email = ANY(emails))
    LIMIT 1;
  END IF;

  -- Se non trovato, cerca per customer_id
  IF v_unified_user_id IS NULL AND p_customer_id IS NOT NULL THEN
    SELECT id INTO v_unified_user_id
    FROM users_unified
    WHERE workspace_id = p_workspace_id
      AND p_customer_id = ANY(customer_ids)
    LIMIT 1;
  END IF;

  -- Se ancora non trovato, crea nuovo unified user
  IF v_unified_user_id IS NULL THEN
    INSERT INTO users_unified (
      workspace_id,
      anonymous_ids,
      emails,
      primary_email,
      phone,
      customer_ids,
      first_seen_at,
      last_seen_at
    ) VALUES (
      p_workspace_id,
      CASE WHEN p_anonymous_id IS NOT NULL THEN ARRAY[p_anonymous_id] ELSE '{}'::TEXT[] END,
      CASE WHEN p_email IS NOT NULL THEN ARRAY[p_email] ELSE '{}'::TEXT[] END,
      p_email,
      p_phone,
      CASE WHEN p_customer_id IS NOT NULL THEN ARRAY[p_customer_id] ELSE '{}'::TEXT[] END,
      v_now,
      v_now
    )
    RETURNING id INTO v_unified_user_id;

    -- Crea identity per anonymous_id
    IF p_anonymous_id IS NOT NULL THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'anonymous_id', p_anonymous_id, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- Aggiorna unified user esistente con nuovi dati
    UPDATE users_unified SET
      anonymous_ids = CASE 
        WHEN p_anonymous_id IS NOT NULL AND NOT (p_anonymous_id = ANY(anonymous_ids)) 
        THEN array_append(anonymous_ids, p_anonymous_id) 
        ELSE anonymous_ids 
      END,
      emails = CASE 
        WHEN p_email IS NOT NULL AND NOT (p_email = ANY(emails)) 
        THEN array_append(emails, p_email) 
        ELSE emails 
      END,
      primary_email = COALESCE(primary_email, p_email),
      phone = COALESCE(phone, p_phone),
      customer_ids = CASE 
        WHEN p_customer_id IS NOT NULL AND NOT (p_customer_id = ANY(customer_ids)) 
        THEN array_append(customer_ids, p_customer_id) 
        ELSE customer_ids 
      END,
      last_seen_at = v_now,
      updated_at = v_now
    WHERE id = v_unified_user_id;

    -- Aggiungi nuove identities se necessario
    IF p_anonymous_id IS NOT NULL THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'anonymous_id', p_anonymous_id, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Aggiungi identity per email se presente
  IF p_email IS NOT NULL THEN
    INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
    VALUES (p_workspace_id, v_unified_user_id, 'email', p_email, p_source, 1.0)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_unified_user_id;
END;
$$;

-- 1.2 Funzione per processare evento in una singola chiamata
CREATE OR REPLACE FUNCTION public.process_event_fast(
  p_workspace_id UUID,
  p_event_type TEXT,
  p_event_name TEXT,
  p_properties JSONB,
  p_context JSONB,
  p_anonymous_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_customer_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'pixel',
  p_session_id TEXT DEFAULT NULL,
  p_consent_state JSONB DEFAULT NULL,
  p_event_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(event_id UUID, unified_user_id UUID, is_duplicate BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unified_user_id UUID;
  v_event_id UUID;
  v_dedupe_key TEXT;
  v_existing_event_id UUID;
  v_product_id TEXT;
BEGIN
  -- 1. Risolvi identity (usa la funzione creata sopra)
  v_unified_user_id := resolve_identity(
    p_workspace_id,
    p_anonymous_id,
    p_email,
    p_phone,
    p_customer_id,
    p_source
  );

  -- 2. Genera dedupe key
  v_product_id := p_properties->>'product_id';
  v_dedupe_key := md5(
    p_workspace_id::TEXT || 
    COALESCE(p_event_name, '') || 
    COALESCE(p_anonymous_id, '') || 
    COALESCE(v_product_id, '') ||
    to_char(p_event_time, 'YYYY-MM-DD-HH24-MI')
  );

  -- 3. Check se duplicato
  SELECT id INTO v_existing_event_id
  FROM events
  WHERE workspace_id = p_workspace_id
    AND dedupe_key = v_dedupe_key
  LIMIT 1;

  IF v_existing_event_id IS NOT NULL THEN
    -- È un duplicato
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
    event_time,
    dedupe_key,
    status
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
    p_event_time,
    v_dedupe_key,
    'pending'
  )
  RETURNING id INTO v_event_id;

  RETURN QUERY SELECT v_event_id, v_unified_user_id, FALSE;
END;
$$;

-- 1.3 Funzione per schedulare sync jobs in batch
CREATE OR REPLACE FUNCTION public.schedule_sync_jobs(
  p_workspace_id UUID,
  p_event_id UUID,
  p_unified_user_id UUID,
  p_event_type TEXT,
  p_event_name TEXT,
  p_properties JSONB,
  p_context JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destination RECORD;
  v_jobs_created INTEGER := 0;
BEGIN
  -- Trova tutte le destinations abilitate per questo workspace
  FOR v_destination IN
    SELECT id, type, config
    FROM destinations
    WHERE workspace_id = p_workspace_id
      AND enabled = true
  LOOP
    -- Crea sync job per ogni destination
    INSERT INTO sync_jobs (
      workspace_id,
      destination_id,
      event_id,
      unified_user_id,
      job_type,
      payload,
      status
    ) VALUES (
      p_workspace_id,
      v_destination.id,
      p_event_id,
      p_unified_user_id,
      'event_sync',
      jsonb_build_object(
        'event_type', p_event_type,
        'event_name', p_event_name,
        'properties', p_properties,
        'context', p_context
      ),
      'pending'
    );
    
    v_jobs_created := v_jobs_created + 1;
  END LOOP;

  RETURN v_jobs_created;
END;
$$;

-- 1.4 Funzione per aggiornare computed traits in background
CREATE OR REPLACE FUNCTION public.update_computed_traits_fast(
  p_unified_user_id UUID,
  p_event_type TEXT,
  p_event_name TEXT,
  p_properties JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computed JSONB;
  v_intent_score NUMERIC;
  v_order_value NUMERIC;
BEGIN
  -- Ottieni computed corrente
  SELECT computed INTO v_computed
  FROM users_unified
  WHERE id = p_unified_user_id;

  v_computed := COALESCE(v_computed, '{}'::JSONB);

  -- Calcola intent score basato su evento
  v_intent_score := COALESCE((v_computed->>'intent_score')::NUMERIC, 0);
  
  CASE p_event_type
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
      -- Aggiorna LTV
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

  -- Aggiorna computed traits
  UPDATE users_unified SET
    computed = jsonb_set(
      jsonb_set(
        jsonb_set(v_computed, '{intent_score}', to_jsonb(v_intent_score)),
        '{last_event_at}',
        to_jsonb(NOW())
      ),
      '{recency_days}',
      to_jsonb(0)
    ),
    updated_at = NOW()
  WHERE id = p_unified_user_id;
END;
$$;

-- 1.5 Funzione per incrementare billing usage
CREATE OR REPLACE FUNCTION public.increment_billing_usage(
  p_workspace_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Trova account_id
  SELECT account_id INTO v_account_id
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_account_id IS NULL THEN
    RETURN;
  END IF;

  -- Calcola periodo corrente (mese)
  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Upsert billing usage
  INSERT INTO billing_usage (
    account_id,
    workspace_id,
    period_start,
    period_end,
    events_count
  ) VALUES (
    v_account_id,
    p_workspace_id,
    v_period_start,
    v_period_end,
    1
  )
  ON CONFLICT (account_id, workspace_id, period_start) 
  DO UPDATE SET
    events_count = billing_usage.events_count + 1,
    updated_at = NOW();
END;
$$;

-- Aggiungi indice unico per billing_usage per supportare ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS billing_usage_unique_period 
ON billing_usage (account_id, workspace_id, period_start);

-- Indici per ottimizzare le query delle funzioni
CREATE INDEX IF NOT EXISTS idx_users_unified_anonymous_ids ON users_unified USING GIN (anonymous_ids);
CREATE INDEX IF NOT EXISTS idx_users_unified_emails ON users_unified USING GIN (emails);
CREATE INDEX IF NOT EXISTS idx_users_unified_customer_ids ON users_unified USING GIN (customer_ids);
CREATE INDEX IF NOT EXISTS idx_events_dedupe_key ON events (workspace_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_destinations_workspace_enabled ON destinations (workspace_id, enabled) WHERE enabled = true;