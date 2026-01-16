import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AuditLog {
  id: string;
  account_id: string;
  workspace_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface UseAuditLogsOptions {
  limit?: number;
  resourceType?: string;
  action?: string;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { profile } = useAuth();
  const { limit = 50, resourceType, action } = options;

  return useQuery({
    queryKey: ['audit-logs', profile?.account_id, limit, resourceType, action],
    queryFn: async (): Promise<AuditLog[]> => {
      if (!profile?.account_id) return [];

      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('account_id', profile.account_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      if (action) {
        query = query.eq('action', action);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
      }

      return (data || []).map(log => ({
        ...log,
        details: log.details as Record<string, unknown>
      }));
    },
    enabled: !!profile?.account_id,
  });
}
