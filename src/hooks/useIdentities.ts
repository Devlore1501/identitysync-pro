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

interface UseIdentitiesOptions {
  limit?: number;
  page?: number;
  search?: string;
  hasEmail?: boolean;
  hasPhone?: boolean;
  anonymousOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useIdentities(options: UseIdentitiesOptions | number = {}) {
  const { currentWorkspace } = useWorkspace();
  
  // Support legacy call with just limit number
  const opts = typeof options === 'number' ? { limit: options } : options;
  const { limit = 50, page = 0, search, hasEmail, hasPhone, anonymousOnly, dateFrom, dateTo } = opts;

  return useQuery({
    queryKey: ['identities', currentWorkspace?.id, limit, page, search, hasEmail, hasPhone, anonymousOnly, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async (): Promise<UnifiedUser[]> => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('users_unified')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('last_seen_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (search && search.trim()) {
        query = query.or(`primary_email.ilike.%${search}%,phone.ilike.%${search}%,id.ilike.%${search}%`);
      }

      if (hasEmail) {
        query = query.not('primary_email', 'is', null);
      }

      if (hasPhone) {
        query = query.not('phone', 'is', null);
      }

      if (anonymousOnly) {
        query = query.is('primary_email', null).is('phone', null);
      }

      if (dateFrom) {
        query = query.gte('last_seen_at', dateFrom.toISOString());
      }

      if (dateTo) {
        query = query.lte('last_seen_at', dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as UnifiedUser[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useIdentitiesCount(search?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['identities-count', currentWorkspace?.id, search],
    queryFn: async () => {
      if (!currentWorkspace?.id) return 0;

      let query = supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);

      if (search && search.trim()) {
        query = query.or(`primary_email.ilike.%${search}%,phone.ilike.%${search}%,id.ilike.%${search}%`);
      }

      const { count, error } = await query;

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}
