-- Fix: Restrict accounts table access to owners only
-- This prevents regular members from seeing stripe_customer_id

-- Drop existing policy that exposes stripe_customer_id to all account members
DROP POLICY IF EXISTS "Users can view their own account" ON public.accounts;

-- Create new policy that restricts full account details to owners only
CREATE POLICY "Owners can view account details"
ON public.accounts
FOR SELECT
USING (has_role(auth.uid(), id, 'owner'::app_role));

-- Create a view for non-sensitive account info that all members can access
CREATE OR REPLACE VIEW public.accounts_public AS
SELECT 
  id,
  name,
  plan,
  created_at,
  updated_at
FROM public.accounts;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.accounts_public TO authenticated;

-- Add RLS comment for documentation
COMMENT ON POLICY "Owners can view account details" ON public.accounts IS 
'Restricts full account access (including stripe_customer_id) to owners only. Regular members should use accounts_public view.';