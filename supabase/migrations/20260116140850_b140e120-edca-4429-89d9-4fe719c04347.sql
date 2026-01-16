-- =====================================================
-- FASE 1 & 2: Fix Sync Deduplication
-- Standardize job type e aggiungi constraint unique
-- =====================================================

-- Aggiungere constraint unique su (event_id, destination_id)
-- Questo previene duplicati a livello database
-- Prima rimuovi eventuali duplicati esistenti
DELETE FROM sync_jobs a
USING sync_jobs b
WHERE a.event_id = b.event_id 
  AND a.event_id IS NOT NULL
  AND a.destination_id = b.destination_id
  AND a.created_at > b.created_at;

-- Ora aggiungi il constraint
ALTER TABLE sync_jobs 
ADD CONSTRAINT unique_event_destination 
UNIQUE (event_id, destination_id);

-- =====================================================
-- FASE 3: Aggiornare schedule_sync_jobs per usare event_track
-- e ON CONFLICT DO NOTHING
-- =====================================================

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
    -- Crea sync job per ogni destination usando event_track (non event_sync)
    -- ON CONFLICT previene duplicati se già esiste un job per questo evento/destinazione
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
      'event_track',  -- Standardized to event_track
      '{}'::jsonb,    -- No payload needed, event data is in events table
      'pending'
    )
    ON CONFLICT (event_id, destination_id) DO NOTHING;
    
    -- Check if row was actually inserted
    IF FOUND THEN
      v_jobs_created := v_jobs_created + 1;
    END IF;
  END LOOP;

  RETURN v_jobs_created;
END;
$$;