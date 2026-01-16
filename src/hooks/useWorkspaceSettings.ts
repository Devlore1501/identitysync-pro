import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface WorkspaceUpdate {
  name?: string;
  domain?: string | null;
  platform?: string | null;
  timezone?: string;
  settings?: Json;
}

// Helper to log audit events
async function logAuditEvent(
  workspaceId: string,
  action: 'update',
  resourceId: string,
  details: Record<string, unknown>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-log`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId,
          entries: [{
            action,
            resource_type: 'workspace',
            resource_id: resourceId,
            details,
          }],
        }),
      }
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  const { currentWorkspace, refetch } = useWorkspace();

  return useMutation({
    mutationFn: async (updates: WorkspaceUpdate) => {
      if (!currentWorkspace) throw new Error('No workspace selected');

      const { error } = await supabase
        .from('workspaces')
        .update(updates)
        .eq('id', currentWorkspace.id);

      if (error) throw error;

      // Log audit event
      await logAuditEvent(currentWorkspace.id, 'update', currentWorkspace.id, {
        updated_fields: Object.keys(updates),
        ...updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      refetch();
      toast.success('Workspace updated');
    },
    onError: (error) => {
      console.error('Error updating workspace:', error);
      toast.error('Failed to update workspace');
    },
  });
}

export function useUpdateWorkspaceSettings() {
  const queryClient = useQueryClient();
  const { currentWorkspace, refetch } = useWorkspace();

  return useMutation({
    mutationFn: async (settingsUpdate: Record<string, Json>) => {
      if (!currentWorkspace) throw new Error('No workspace selected');

      const currentSettings = (currentWorkspace.settings as Record<string, Json>) || {};
      const newSettings: Json = { ...currentSettings, ...settingsUpdate };

      const { error } = await supabase
        .from('workspaces')
        .update({ settings: newSettings })
        .eq('id', currentWorkspace.id);

      if (error) throw error;

      // Log audit event
      await logAuditEvent(currentWorkspace.id, 'update', currentWorkspace.id, {
        resource_type: 'settings',
        updated_settings: Object.keys(settingsUpdate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      refetch();
      toast.success('Settings updated');
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    },
  });
}
