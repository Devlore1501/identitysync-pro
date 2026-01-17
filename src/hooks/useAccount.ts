import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Account {
  id: string;
  name: string;
  plan: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAccount() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['account', profile?.account_id],
    queryFn: async (): Promise<Account | null> => {
      if (!profile?.account_id) return null;

      // Use RPC function to get account info (works for all members, not just owners)
      // This function returns non-sensitive data (excludes stripe_customer_id)
      const { data, error } = await supabase
        .rpc('get_account_info', { p_account_id: profile.account_id })
        .single();

      if (error) {
        console.error('Error fetching account:', error);
        throw error;
      }

      // The RPC returns the account without stripe_customer_id
      // Add null for stripe_customer_id to maintain interface compatibility
      return data ? { ...data, stripe_customer_id: null } : null;
    },
    enabled: !!profile?.account_id,
  });
}
