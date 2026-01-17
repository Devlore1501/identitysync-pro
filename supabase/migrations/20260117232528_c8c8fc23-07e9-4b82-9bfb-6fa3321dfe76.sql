-- Workspace health monitoring table
CREATE TABLE public.workspace_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Event health
  last_event_at TIMESTAMPTZ,
  events_today INTEGER DEFAULT 0,
  events_week INTEGER DEFAULT 0,
  
  -- E-commerce health  
  has_product_events BOOLEAN DEFAULT FALSE,
  has_cart_events BOOLEAN DEFAULT FALSE,
  has_checkout_events BOOLEAN DEFAULT FALSE,
  has_order_events BOOLEAN DEFAULT FALSE,
  
  -- Counts
  product_events_count INTEGER DEFAULT 0,
  cart_events_count INTEGER DEFAULT 0,
  checkout_events_count INTEGER DEFAULT 0,
  order_events_count INTEGER DEFAULT 0,
  
  -- Alerts
  alert_no_events_24h BOOLEAN DEFAULT FALSE,
  alert_no_ecommerce BOOLEAN DEFAULT FALSE,
  alert_tracking_broken BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.workspace_health ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can view health for their workspaces
CREATE POLICY "Users can view workspace health"
ON public.workspace_health
FOR SELECT
USING (user_has_workspace_access(auth.uid(), workspace_id));

-- Index for fast lookups
CREATE INDEX idx_workspace_health_workspace ON public.workspace_health(workspace_id);
CREATE INDEX idx_workspace_health_alerts ON public.workspace_health(alert_no_events_24h, alert_no_ecommerce) WHERE alert_no_events_24h = TRUE OR alert_no_ecommerce = TRUE;