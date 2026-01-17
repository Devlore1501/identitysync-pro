-- Add ad_ids field to users_unified for advertising platform tracking
ALTER TABLE public.users_unified 
ADD COLUMN IF NOT EXISTS ad_ids jsonb DEFAULT '{}';

-- Add capture_source tracking to identities table
ALTER TABLE public.identities
ADD COLUMN IF NOT EXISTS capture_source text DEFAULT 'unknown';

-- Create index for ad_ids queries
CREATE INDEX IF NOT EXISTS idx_users_unified_ad_ids ON public.users_unified USING gin(ad_ids);

-- Add comment for documentation
COMMENT ON COLUMN public.users_unified.ad_ids IS 'Advertising platform IDs: gclid, gbraid, wbraid, fbclid, fbp, fbc';
COMMENT ON COLUMN public.identities.capture_source IS 'Source of identity capture: form, checkout, shopify_account, klaviyo_form, popup, etc.';