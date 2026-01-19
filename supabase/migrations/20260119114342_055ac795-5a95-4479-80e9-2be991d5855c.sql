-- First, create a function to merge duplicate users (handling predictive_signals conflicts)
CREATE OR REPLACE FUNCTION public.merge_duplicate_users(p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE(merged_count INTEGER, kept_user_id UUID, removed_ids UUID[]) AS $$
DECLARE
  v_email TEXT;
  v_keep_id UUID;
  v_remove_ids UUID[];
  v_merged INTEGER := 0;
  v_row RECORD;
BEGIN
  -- Find all emails with duplicates
  FOR v_row IN 
    SELECT primary_email, array_agg(id ORDER BY created_at) as user_ids
    FROM users_unified
    WHERE primary_email IS NOT NULL
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
    GROUP BY workspace_id, primary_email
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first (oldest) user
    v_keep_id := v_row.user_ids[1];
    v_remove_ids := v_row.user_ids[2:];
    
    -- Merge anonymous_ids, emails, customer_ids from duplicates into kept user
    UPDATE users_unified u SET
      anonymous_ids = (
        SELECT array_agg(DISTINCT elem) 
        FROM (
          SELECT unnest(anonymous_ids) as elem 
          FROM users_unified 
          WHERE id = ANY(v_row.user_ids)
        ) sub
      ),
      emails = (
        SELECT array_agg(DISTINCT elem) 
        FROM (
          SELECT unnest(emails) as elem 
          FROM users_unified 
          WHERE id = ANY(v_row.user_ids)
        ) sub
      ),
      customer_ids = (
        SELECT array_agg(DISTINCT elem) 
        FROM (
          SELECT unnest(customer_ids) as elem 
          FROM users_unified 
          WHERE id = ANY(v_row.user_ids)
        ) sub
      ),
      updated_at = now()
    WHERE u.id = v_keep_id;
    
    -- Update events to point to kept user
    UPDATE events SET unified_user_id = v_keep_id
    WHERE unified_user_id = ANY(v_remove_ids);
    
    -- Update identities to point to kept user (delete duplicates first)
    DELETE FROM identities 
    WHERE unified_user_id = ANY(v_remove_ids)
      AND (workspace_id, identity_type, identity_value) IN (
        SELECT workspace_id, identity_type, identity_value 
        FROM identities 
        WHERE unified_user_id = v_keep_id
      );
    UPDATE identities SET unified_user_id = v_keep_id
    WHERE unified_user_id = ANY(v_remove_ids);
    
    -- Update sync_jobs to point to kept user
    UPDATE sync_jobs SET unified_user_id = v_keep_id
    WHERE unified_user_id = ANY(v_remove_ids);
    
    -- Delete predictive_signals for duplicates that would conflict, then update the rest
    DELETE FROM predictive_signals 
    WHERE unified_user_id = ANY(v_remove_ids)
      AND (workspace_id, signal_type) IN (
        SELECT workspace_id, signal_type 
        FROM predictive_signals 
        WHERE unified_user_id = v_keep_id
      );
    UPDATE predictive_signals SET unified_user_id = v_keep_id
    WHERE unified_user_id = ANY(v_remove_ids);
    
    -- Delete klaviyo_events_sent for duplicates
    DELETE FROM klaviyo_events_sent WHERE unified_user_id = ANY(v_remove_ids);
    
    -- Delete duplicate users
    DELETE FROM users_unified WHERE id = ANY(v_remove_ids);
    
    v_merged := v_merged + array_length(v_remove_ids, 1);
    
    merged_count := array_length(v_remove_ids, 1);
    kept_user_id := v_keep_id;
    removed_ids := v_remove_ids;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Run the merge for existing duplicates
SELECT * FROM merge_duplicate_users();

-- Now add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unified_unique_email 
ON users_unified(workspace_id, primary_email) 
WHERE primary_email IS NOT NULL;

-- Update resolve_identity with advisory lock to prevent race conditions
CREATE OR REPLACE FUNCTION public.resolve_identity(
  p_workspace_id UUID,
  p_anonymous_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_customer_id TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'web',
  p_ad_ids JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  v_unified_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_existing_by_anon UUID;
  v_existing_by_email UUID;
  v_existing_by_customer UUID;
BEGIN
  -- Lock to prevent race conditions on same email
  IF p_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_workspace_id::text || p_email));
  END IF;

  -- Find existing user by anonymous_id
  SELECT id INTO v_existing_by_anon
  FROM users_unified
  WHERE workspace_id = p_workspace_id
    AND p_anonymous_id = ANY(anonymous_ids)
  LIMIT 1;

  -- Find existing user by email
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_existing_by_email
    FROM users_unified
    WHERE workspace_id = p_workspace_id
      AND (primary_email = p_email OR p_email = ANY(emails))
    LIMIT 1;
  END IF;

  -- Find existing user by customer_id
  IF p_customer_id IS NOT NULL THEN
    SELECT id INTO v_existing_by_customer
    FROM users_unified
    WHERE workspace_id = p_workspace_id
      AND p_customer_id = ANY(customer_ids)
    LIMIT 1;
  END IF;

  -- Determine which user to use (priority: email > customer > anon)
  v_unified_user_id := COALESCE(v_existing_by_email, v_existing_by_customer, v_existing_by_anon);

  -- If we found by anon but also have email match, merge them
  IF v_existing_by_anon IS NOT NULL AND v_existing_by_email IS NOT NULL 
     AND v_existing_by_anon != v_existing_by_email THEN
    -- Merge anon user into email user
    UPDATE users_unified SET
      anonymous_ids = (
        SELECT array_agg(DISTINCT elem) FROM (
          SELECT unnest(u1.anonymous_ids) as elem FROM users_unified u1 WHERE u1.id = v_existing_by_anon
          UNION
          SELECT unnest(u2.anonymous_ids) as elem FROM users_unified u2 WHERE u2.id = v_existing_by_email
        ) sub
      ),
      customer_ids = (
        SELECT array_agg(DISTINCT elem) FROM (
          SELECT unnest(u1.customer_ids) as elem FROM users_unified u1 WHERE u1.id = v_existing_by_anon
          UNION
          SELECT unnest(u2.customer_ids) as elem FROM users_unified u2 WHERE u2.id = v_existing_by_email
        ) sub
      ),
      updated_at = v_now
    WHERE id = v_existing_by_email;
    
    -- Reassign events and delete anon user
    UPDATE events SET unified_user_id = v_existing_by_email WHERE unified_user_id = v_existing_by_anon;
    UPDATE identities SET unified_user_id = v_existing_by_email WHERE unified_user_id = v_existing_by_anon;
    UPDATE sync_jobs SET unified_user_id = v_existing_by_email WHERE unified_user_id = v_existing_by_anon;
    DELETE FROM predictive_signals WHERE unified_user_id = v_existing_by_anon;
    DELETE FROM users_unified WHERE id = v_existing_by_anon;
    
    v_unified_user_id := v_existing_by_email;
  END IF;

  -- If no existing user, create new one
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
      p_ad_ids,
      v_now,
      v_now
    )
    RETURNING id INTO v_unified_user_id;

    -- Create identity records
    IF p_anonymous_id IS NOT NULL THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'anonymous_id', p_anonymous_id, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- Update existing user with new data
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
      ad_ids = CASE
        WHEN p_ad_ids != '{}'::jsonb THEN ad_ids || p_ad_ids
        ELSE ad_ids
      END,
      last_seen_at = v_now,
      updated_at = v_now
    WHERE id = v_unified_user_id;

    -- Add identity for anonymous_id if new
    IF p_anonymous_id IS NOT NULL THEN
      INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
      VALUES (p_workspace_id, v_unified_user_id, 'anonymous_id', p_anonymous_id, p_source, 1.0)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Add identity for email if present
  IF p_email IS NOT NULL THEN
    INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
    VALUES (p_workspace_id, v_unified_user_id, 'email', p_email, p_source, 1.0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Add identity for customer_id if present
  IF p_customer_id IS NOT NULL THEN
    INSERT INTO identities (workspace_id, unified_user_id, identity_type, identity_value, source, confidence)
    VALUES (p_workspace_id, v_unified_user_id, 'customer_id', p_customer_id, p_source, 1.0)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_unified_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;