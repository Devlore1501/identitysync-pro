import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

interface UnifiedUser {
  id: string;
  workspace_id: string;
  primary_email: string | null;
  emails: string[];
  phone: string | null;
  customer_ids: string[];
  anonymous_ids: string[];
  external_ids: Record<string, unknown>;
  traits: Record<string, unknown>;
  computed: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

interface Identity {
  id: string;
  identity_type: string;
  identity_value: string;
  confidence: number;
  source: string;
  created_at: string;
}

interface Event {
  id: string;
  event_name: string;
  event_type: string;
  properties: Record<string, unknown>;
  context: Record<string, unknown>;
  source: string;
  event_time: string;
  status: string;
}

export function useIdentityDetail(profileId: string | undefined) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['identity-detail', profileId],
    queryFn: async (): Promise<UnifiedUser | null> => {
      if (!profileId || !currentWorkspace?.id) return null;

      const { data, error } = await supabase
        .from('users_unified')
        .select('*')
        .eq('id', profileId)
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (error) throw error;
      return data as UnifiedUser;
    },
    enabled: !!profileId && !!currentWorkspace?.id,
  });
}

export function useIdentityIdentities(profileId: string | undefined) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['identity-identities', profileId],
    queryFn: async (): Promise<Identity[]> => {
      if (!profileId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('identities')
        .select('*')
        .eq('unified_user_id', profileId)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Identity[];
    },
    enabled: !!profileId && !!currentWorkspace?.id,
  });
}

export function useIdentityEvents(profileId: string | undefined, limit = 50) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['identity-events', profileId, limit],
    queryFn: async (): Promise<Event[]> => {
      if (!profileId || !currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_type, properties, context, source, event_time, status')
        .eq('unified_user_id', profileId)
        .eq('workspace_id', currentWorkspace.id)
        .order('event_time', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as Event[];
    },
    enabled: !!profileId && !!currentWorkspace?.id,
  });
}

export function useDeleteIdentity() {
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (profileId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdpr-delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            profileId,
            workspaceId: currentWorkspace.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete profile');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['identities-count'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('Profile deleted successfully (GDPR compliance)');
    },
    onError: (error) => {
      console.error('Error deleting profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete profile');
    },
  });
}
