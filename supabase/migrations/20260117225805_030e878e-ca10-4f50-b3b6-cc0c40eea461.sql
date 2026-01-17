-- Update resolve_identity to accept and save ad_ids
CREATE OR REPLACE FUNCTION public.resolve_identity(
  p_workspace_id uuid, 
  p_anonymous_id text, 
  p_email text DEFAULT NULL::text, 
  p_phone text DEFAULT NULL::text, 
  p_customer_id text DEFAULT NULL::text, 
  p_source text DEFAULT 'pixel'::text,
  p_ad_ids jsonb DEFAULT '{}'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unified_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_merged_ad_ids JSONB;
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
      ad_ids,
      first_seen_at,
      last_seen_at
    ) VALUES (
      p_workspace_id,
      CASE WHEN p_anonymous_id IS NOT NULL THEN ARRAY[p_anonymous_id] ELSE '{}'::TEXT[] END,
      CASE WHEN p_email IS NOT NULL THEN ARRAY[p_email] ELSE '{}'::TEXT[] END,
      p_email,
      p_phone,
      CASE WHEN p_customer_id IS NOT NULL THEN ARRAY[p_customer_id] ELSE '{}'::TEXT[] END,
      COALESCE(p_ad_ids, '{}'::jsonb),
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
    -- Merge ad_ids: keep existing values, add new ones (new values take precedence for same keys)
    SELECT COALESCE(ad_ids, '{}'::jsonb) INTO v_merged_ad_ids
    FROM users_unified
    WHERE id = v_unified_user_id;
    
    -- Merge: existing || new (new overwrites existing keys)
    v_merged_ad_ids := v_merged_ad_ids || COALESCE(p_ad_ids, '{}'::jsonb);
    
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
      ad_ids = v_merged_ad_ids,
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
$function$;

-- Update process_event_fast to extract ad_ids from context and pass to resolve_identity
CREATE OR REPLACE FUNCTION public.process_event_fast(
  p_workspace_id uuid, 
  p_event_type text, 
  p_event_name text, 
  p_properties jsonb, 
  p_context jsonb, 
  p_anonymous_id text, 
  p_email text DEFAULT NULL::text, 
  p_phone text DEFAULT NULL::text, 
  p_customer_id text DEFAULT NULL::text, 
  p_source text DEFAULT 'pixel'::text, 
  p_session_id text DEFAULT NULL::text, 
  p_consent_state jsonb DEFAULT NULL::jsonb, 
  p_event_time timestamp with time zone DEFAULT now()
)
 RETURNS TABLE(event_id uuid, unified_user_id uuid, is_duplicate boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unified_user_id UUID;
  v_event_id UUID;
  v_dedupe_key TEXT;
  v_existing_event_id UUID;
  v_product_id TEXT;
  v_ad_ids JSONB;
BEGIN
  -- Extract ad_ids from context
  v_ad_ids := COALESCE(p_context->'ad_ids', '{}'::jsonb);
  
  -- Also extract individual ad params if present at top level of context
  IF p_context->>'fbclid' IS NOT NULL AND NOT (v_ad_ids ? 'fbclid') THEN
    v_ad_ids := v_ad_ids || jsonb_build_object('fbclid', p_context->>'fbclid');
  END IF;
  IF p_context->>'gclid' IS NOT NULL AND NOT (v_ad_ids ? 'gclid') THEN
    v_ad_ids := v_ad_ids || jsonb_build_object('gclid', p_context->>'gclid');
  END IF;
  IF p_context->>'fbp' IS NOT NULL AND NOT (v_ad_ids ? 'fbp') THEN
    v_ad_ids := v_ad_ids || jsonb_build_object('fbp', p_context->>'fbp');
  END IF;
  IF p_context->>'fbc' IS NOT NULL AND NOT (v_ad_ids ? 'fbc') THEN
    v_ad_ids := v_ad_ids || jsonb_build_object('fbc', p_context->>'fbc');
  END IF;

  -- 1. Risolvi identity (passa ad_ids)
  v_unified_user_id := resolve_identity(
    p_workspace_id,
    p_anonymous_id,
    p_email,
    p_phone,
    p_customer_id,
    p_source,
    v_ad_ids
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
$function$;