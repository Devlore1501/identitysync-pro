-- Create utm_campaigns table for tracking UTM links and their performance
CREATE TABLE public.utm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  utm_term TEXT,
  full_url TEXT NOT NULL,
  short_code TEXT,
  clicks_count INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  revenue_attributed DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX idx_utm_campaigns_workspace ON public.utm_campaigns(workspace_id);
CREATE INDEX idx_utm_campaigns_source ON public.utm_campaigns(utm_source);
CREATE INDEX idx_utm_campaigns_created ON public.utm_campaigns(created_at DESC);
CREATE UNIQUE INDEX idx_utm_campaigns_short_code ON public.utm_campaigns(short_code) WHERE short_code IS NOT NULL;

-- Enable RLS
ALTER TABLE public.utm_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view UTM campaigns for their workspaces"
  ON public.utm_campaigns FOR SELECT
  USING (user_has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can insert UTM campaigns for their workspaces"
  ON public.utm_campaigns FOR INSERT
  WITH CHECK (user_has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can update UTM campaigns for their workspaces"
  ON public.utm_campaigns FOR UPDATE
  USING (user_has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can delete UTM campaigns for their workspaces"
  ON public.utm_campaigns FOR DELETE
  USING (user_has_workspace_access(auth.uid(), workspace_id));

-- Function to update utm_campaign stats when events arrive
CREATE OR REPLACE FUNCTION public.update_utm_campaign_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_utm_source TEXT;
  v_utm_medium TEXT;
  v_utm_campaign TEXT;
  v_revenue DECIMAL(12,2);
BEGIN
  -- Extract UTM params from event context or properties
  v_utm_source := COALESCE(
    NEW.context->>'utm_source',
    NEW.properties->>'utm_source'
  );
  v_utm_medium := COALESCE(
    NEW.context->>'utm_medium', 
    NEW.properties->>'utm_medium'
  );
  v_utm_campaign := COALESCE(
    NEW.context->>'utm_campaign',
    NEW.properties->>'utm_campaign'
  );
  
  -- Only proceed if we have UTM params
  IF v_utm_source IS NOT NULL AND v_utm_medium IS NOT NULL AND v_utm_campaign IS NOT NULL THEN
    -- Calculate revenue if order event
    v_revenue := 0;
    IF NEW.event_type = 'order' THEN
      v_revenue := COALESCE((NEW.properties->>'value')::DECIMAL(12,2), 0);
    END IF;
    
    -- Update matching campaign stats
    UPDATE public.utm_campaigns SET
      events_count = events_count + 1,
      conversions_count = CASE 
        WHEN NEW.event_type IN ('order', 'checkout_completed') 
        THEN conversions_count + 1 
        ELSE conversions_count 
      END,
      revenue_attributed = revenue_attributed + v_revenue,
      updated_at = now()
    WHERE workspace_id = NEW.workspace_id
      AND utm_source = v_utm_source
      AND utm_medium = v_utm_medium
      AND utm_campaign = v_utm_campaign;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on events table
CREATE TRIGGER trigger_update_utm_stats
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_utm_campaign_stats();

-- Function to generate short codes
CREATE OR REPLACE FUNCTION public.generate_utm_short_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;