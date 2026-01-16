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

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', profile.account_id)
        .single();

      if (error) {
        console.error('Error fetching account:', error);
        throw error;
      }

      return data;
    },
    enabled: !!profile?.account_id,
  });
}
