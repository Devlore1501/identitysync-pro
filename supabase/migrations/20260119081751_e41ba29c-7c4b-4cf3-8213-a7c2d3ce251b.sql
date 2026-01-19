-- Tabella per tracciare eventi abandonment inviati a Klaviyo
-- Previene duplicati e spam nei flow di recupero
CREATE TABLE IF NOT EXISTS klaviyo_events_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_user_id UUID NOT NULL REFERENCES users_unified(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unique_id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indice unico per prevenire duplicati nello stesso giorno (invece di UNIQUE constraint su espressione)
CREATE UNIQUE INDEX idx_klaviyo_events_sent_unique_per_day 
ON klaviyo_events_sent(unified_user_id, destination_id, event_type, sent_date);

-- Indice per query veloci di lookup
CREATE INDEX idx_klaviyo_events_sent_lookup 
ON klaviyo_events_sent(unified_user_id, destination_id, event_type, sent_at DESC);

-- Indice per cleanup vecchi record
CREATE INDEX idx_klaviyo_events_sent_cleanup 
ON klaviyo_events_sent(sent_at);

-- RLS
ALTER TABLE klaviyo_events_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view klaviyo events for their workspaces"
ON klaviyo_events_sent FOR SELECT
USING (user_has_workspace_access(auth.uid(), workspace_id));

-- Funzione per verificare se possiamo inviare un evento abandonment
-- Ritorna TRUE se l'evento puo' essere inviato (non inviato nelle ultime X ore)
CREATE OR REPLACE FUNCTION can_send_abandonment_event(
  p_user_id UUID,
  p_destination_id UUID,
  p_event_type TEXT,
  p_cooldown_hours INT DEFAULT 24
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_sent TIMESTAMPTZ;
BEGIN
  SELECT sent_at INTO v_last_sent
  FROM klaviyo_events_sent
  WHERE unified_user_id = p_user_id
    AND destination_id = p_destination_id
    AND event_type = p_event_type
  ORDER BY sent_at DESC
  LIMIT 1;
  
  RETURN v_last_sent IS NULL OR v_last_sent < now() - (p_cooldown_hours || ' hours')::interval;
END;
$$;

-- Funzione per registrare un evento inviato (con dedupe automatica)
CREATE OR REPLACE FUNCTION record_abandonment_event_sent(
  p_user_id UUID,
  p_destination_id UUID,
  p_event_type TEXT,
  p_unique_id TEXT,
  p_workspace_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO klaviyo_events_sent (unified_user_id, destination_id, event_type, unique_id, workspace_id, sent_date)
  VALUES (p_user_id, p_destination_id, p_event_type, p_unique_id, p_workspace_id, CURRENT_DATE)
  ON CONFLICT (unified_user_id, destination_id, event_type, sent_date) DO NOTHING
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Cleanup immediato: marca job duplicati pending come completed
WITH ranked_jobs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY unified_user_id, destination_id, job_type, created_at::date
      ORDER BY created_at ASC
    ) as rn
  FROM sync_jobs
  WHERE status = 'pending'
    AND job_type = 'event_track'
    AND payload::text LIKE '%SF%Abandoned%'
)
UPDATE sync_jobs
SET status = 'completed', 
    last_error = 'Deduplicated - redundant job',
    completed_at = now()
WHERE id IN (SELECT id FROM ranked_jobs WHERE rn > 1);