import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface Destination {
  id: string;
  workspace_id: string;
  name: string;
  type: 'klaviyo' | 'webhook' | 'ga4' | 'meta';
  config: Json;
  event_mapping: Json;
  property_mapping: Json;
  enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

// Helper to log audit events
async function logAuditEvent(
  workspaceId: string,
  action: 'create' | 'update' | 'delete',
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
            resource_type: 'destination',
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

export function useDestinations() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: destinations, isLoading, error } = useQuery({
    queryKey: ['destinations', currentWorkspace?.id],
    queryFn: async (): Promise<Destination[]> => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Destination[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const createDestination = useMutation({
    mutationFn: async (destination: { name: string; type: 'klaviyo' | 'webhook' | 'ga4' | 'meta'; config: Json; enabled: boolean }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase
        .from('destinations')
        .insert({
          workspace_id: currentWorkspace.id,
          name: destination.name,
          type: destination.type,
          config: destination.config,
          enabled: destination.enabled,
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await logAuditEvent(currentWorkspace.id, 'create', data.id, {
        name: destination.name,
        type: destination.type,
        enabled: destination.enabled,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations', currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('Destination created');
    },
    onError: (error) => {
      console.error('Error creating destination:', error);
      toast.error('Failed to create destination');
    },
  });

  const updateDestination = useMutation({
    mutationFn: async ({ id, name, type, config, enabled }: { id: string; name?: string; type?: 'klaviyo' | 'webhook' | 'ga4' | 'meta'; config?: Json; enabled?: boolean }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (config !== undefined) updates.config = config;
      if (enabled !== undefined) updates.enabled = enabled;

      const { data, error } = await supabase
        .from('destinations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await logAuditEvent(currentWorkspace.id, 'update', id, updates);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations', currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('Destination updated');
    },
    onError: (error) => {
      console.error('Error updating destination:', error);
      toast.error('Failed to update destination');
    },
  });

  const deleteDestination = useMutation({
    mutationFn: async (id: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      // Get destination info for audit log
      const { data: destInfo } = await supabase
        .from('destinations')
        .select('name, type')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('destinations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log audit event
      await logAuditEvent(currentWorkspace.id, 'delete', id, {
        name: destInfo?.name,
        type: destInfo?.type,
        deleted_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations', currentWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('Destination deleted');
    },
    onError: (error) => {
      console.error('Error deleting destination:', error);
      toast.error('Failed to delete destination');
    },
  });

  return {
    destinations: destinations || [],
    isLoading,
    error,
    createDestination,
    updateDestination,
    deleteDestination,
  };
}

export function useSyncStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['sync-stats', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { total: 0, completed: 0, failed: 0, pending: 0, successRate: 100 };

      const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('sync_jobs')
        .select('status')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startOfWeek);

      if (error) throw error;

      const jobs = data || [];
      const total = jobs.length;
      const completed = jobs.filter(j => j.status === 'completed').length;
      const failed = jobs.filter(j => j.status === 'failed').length;
      const pending = jobs.filter(j => j.status === 'pending' || j.status === 'running').length;
      const successRate = total > 0 ? Math.round((completed / (completed + failed)) * 100) || 100 : 100;

      return { total, completed, failed, pending, successRate };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}
