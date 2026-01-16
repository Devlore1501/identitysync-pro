import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Event {
  id: string;
  event_type: string;
  event_name: string;
  properties: Record<string, unknown>;
  context: Record<string, unknown>;
  anonymous_id: string | null;
  source: string;
  status: string;
  event_time: string;
  unified_user_id: string | null;
}

interface UseEventsOptions {
  limit?: number;
  status?: 'pending' | 'processed' | 'failed' | 'synced';
  eventType?: string;
}

export function useEvents(options: UseEventsOptions = {}) {
  const { currentWorkspace } = useWorkspace();
  const { limit = 50, status, eventType } = options;

  return useQuery({
    queryKey: ['events', currentWorkspace?.id, limit, status, eventType],
    queryFn: async (): Promise<Event[]> => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('event_time', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }
      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Event[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useEventsCount() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['events-count', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { today: 0, week: 0 };

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [todayResult, weekResult] = await Promise.all([
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .gte('event_time', startOfToday),
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .gte('event_time', startOfWeek),
      ]);

      return {
        today: todayResult.count || 0,
        week: weekResult.count || 0,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}
