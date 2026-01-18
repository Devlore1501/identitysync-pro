-- Add column for enabling abandonment events to Klaviyo
ALTER TABLE destinations 
ADD COLUMN IF NOT EXISTS send_abandonment_events BOOLEAN DEFAULT true;

COMMENT ON COLUMN destinations.send_abandonment_events IS 'When true, sends SF Checkout Abandoned and SF Cart Abandoned events to Klaviyo for metric-based flow triggers';