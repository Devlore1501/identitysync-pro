-- Fix: Drop the SECURITY DEFINER view and use a simpler approach
-- Instead of a view, we'll let regular members access accounts via a function

-- Drop the problematic view
DROP VIEW IF EXISTS public.accounts_public;

-- Create a security definer function for non-owner members to get basic account info
CREATE OR REPLACE FUNCTION public.get_account_info(p_account_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  plan text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    a.id,
    a.name,
    a.plan,
    a.created_at,
    a.updated_at
  FROM accounts a
  WHERE a.id = p_account_id
    AND a.id = get_user_account_id(auth.uid())
$$;

COMMENT ON FUNCTION public.get_account_info IS 
'Returns non-sensitive account info for members. Does not expose stripe_customer_id.';