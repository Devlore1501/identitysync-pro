import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BillingUsage {
  id: string;
  account_id: string;
  workspace_id: string | null;
  period_start: string;
  period_end: string;
  events_count: number;
  profiles_count: number;
  syncs_count: number;
}

export function useBillingUsage() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['billing-usage', profile?.account_id],
    queryFn: async (): Promise<BillingUsage | null> => {
      if (!profile?.account_id) return null;

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('billing_usage')
        .select('*')
        .eq('account_id', profile.account_id)
        .eq('period_start', periodStart)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching billing usage:', error);
        throw error;
      }

      return data;
    },
    enabled: !!profile?.account_id,
  });
}

export function useBillingHistory() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['billing-history', profile?.account_id],
    queryFn: async (): Promise<BillingUsage[]> => {
      if (!profile?.account_id) return [];

      const { data, error } = await supabase
        .from('billing_usage')
        .select('*')
        .eq('account_id', profile.account_id)
        .order('period_start', { ascending: false })
        .limit(12);

      if (error) {
        console.error('Error fetching billing history:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!profile?.account_id,
  });
}
