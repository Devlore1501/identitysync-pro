import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface UnifiedUser {
  id: string;
  primary_email: string | null;
  emails: string[];
  phone: string | null;
  customer_ids: string[];
  anonymous_ids: string[];
  traits: Record<string, unknown>;
  computed: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
}

export function useIdentities(limit = 50) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['identities', currentWorkspace?.id, limit],
    queryFn: async (): Promise<UnifiedUser[]> => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('users_unified')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('last_seen_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as UnifiedUser[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useIdentitiesCount() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['identities-count', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return 0;

      const { count, error } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}
