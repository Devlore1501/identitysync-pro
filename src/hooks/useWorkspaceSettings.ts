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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      refetch();
      toast.success('Settings updated');
    },
    onError: (error) => {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    },
  });
}
