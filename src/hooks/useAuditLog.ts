import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface AuditLogEntry {
  action: 'create' | 'update' | 'delete' | 'revoke';
  resource_type: 'api_key' | 'destination' | 'workspace' | 'identity' | 'settings';
  resource_id?: string;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (entries: AuditLogEntry | AuditLogEntry[]) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const entriesArray = Array.isArray(entries) ? entries : [entries];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-log`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            workspaceId: currentWorkspace.id,
            entries: entriesArray,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to log audit event');
      }

      return response.json();
    },
  });
}
