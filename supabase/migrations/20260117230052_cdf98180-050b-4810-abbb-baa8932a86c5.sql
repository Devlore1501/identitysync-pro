-- Fix resolve_identity to properly save ad_ids from events
-- This recreates the function with the p_ad_ids parameter

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
  v_existing_by_anon UUID;
  v_existing_by_email UUID;
  v_existing_by_customer UUID;
  v_now TIMESTAMPTZ := NOW();
  v_merged_ad_ids JSONB;
  v_current_ad_ids JSONB;
BEGIN
  -- Look up existing users by different identifiers
  SELECT id INTO v_existing_by_anon
  FROM users_unified
  WHERE workspace_id = p_workspace_id
    AND p_anonymous_id = ANY(anonymous_ids)
  LIMIT 1;

  IF p_email IS NOT NULL AND p_email != '' THEN
    SELECT id INTO v_existing_by_email
    FROM users_unified
    WHERE workspace_id = p_workspace_id
      AND (p_email = ANY(emails) OR p_email = primary_email)
    LIMIT 1;
  END IF;

  IF p_customer_id IS NOT NULL AND p_customer_id != '' THEN
    SELECT id INTO v_existing_by_customer
    FROM users_unified
    WHERE workspace_id = p_workspace_id
      AND p_customer_id = ANY(customer_ids)
    LIMIT 1;
  END IF;

  -- Determine which user to use or create
  v_unified_user_id := COALESCE(v_existing_by_email, v_existing_by_customer, v_existing_by_anon);

  IF v_unified_user_id IS NULL THEN
    -- Create new user with ad_ids
    INSERT INTO users_unified (
      workspace_id,
      anonymous_ids,
      emails,
      primary_email,
      customer_ids,
      phone,
      first_seen_at,
      last_seen_at,
      ad_ids
    ) VALUES (
      p_workspace_id,
      ARRAY[p_anonymous_id],
      CASE WHEN p_email IS NOT NULL AND p_email != '' THEN ARRAY[p_email] ELSE '{}'::text[] END,
      CASE WHEN p_email IS NOT NULL AND p_email != '' THEN p_email ELSE NULL END,
      CASE WHEN p_customer_id IS NOT NULL AND p_customer_id != '' THEN ARRAY[p_customer_id] ELSE '{}'::text[] END,
      NULLIF(p_phone, ''),
      v_now,
      v_now,
      COALESCE(p_ad_ids, '{}'::jsonb)
    )
    RETURNING id INTO v_unified_user_id;

    -- Create identity records
    INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
    VALUES (p_workspace_id, v_unified_user_id, 'anonymous_id', p_anonymous_id, p_source, 1.0)
    ON CONFLICT DO NOTHING;

    IF p_email IS NOT NULL AND p_email != '' THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'email', p_email, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;

    IF p_customer_id IS NOT NULL AND p_customer_id != '' THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'customer_id', p_customer_id, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;

  ELSE
    -- Get current ad_ids and merge with new ones
    SELECT COALESCE(ad_ids, '{}'::jsonb) INTO v_current_ad_ids
    FROM users_unified
    WHERE id = v_unified_user_id;

    -- Merge ad_ids (new values override old ones for same keys)
    v_merged_ad_ids := v_current_ad_ids || COALESCE(p_ad_ids, '{}'::jsonb);

    -- Update existing user
    UPDATE users_unified
    SET
      anonymous_ids = CASE 
        WHEN NOT (p_anonymous_id = ANY(anonymous_ids)) 
        THEN array_append(anonymous_ids, p_anonymous_id) 
        ELSE anonymous_ids 
      END,
      emails = CASE 
        WHEN p_email IS NOT NULL AND p_email != '' AND NOT (p_email = ANY(emails)) 
        THEN array_append(emails, p_email) 
        ELSE emails 
      END,
      primary_email = COALESCE(primary_email, NULLIF(p_email, '')),
      customer_ids = CASE 
        WHEN p_customer_id IS NOT NULL AND p_customer_id != '' AND NOT (p_customer_id = ANY(customer_ids)) 
        THEN array_append(customer_ids, p_customer_id) 
        ELSE customer_ids 
      END,
      phone = COALESCE(phone, NULLIF(p_phone, '')),
      last_seen_at = v_now,
      updated_at = v_now,
      ad_ids = v_merged_ad_ids
    WHERE id = v_unified_user_id;

    -- Add identity records if new
    INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
    VALUES (p_workspace_id, v_unified_user_id, 'anonymous_id', p_anonymous_id, p_source, 1.0)
    ON CONFLICT DO NOTHING;

    IF p_email IS NOT NULL AND p_email != '' THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'email', p_email, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;

    IF p_customer_id IS NOT NULL AND p_customer_id != '' THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'customer_id', p_customer_id, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN v_unified_user_id;
END;
$function$;