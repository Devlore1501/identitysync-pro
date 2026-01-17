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
  page?: number;
  status?: 'pending' | 'processed' | 'failed' | 'synced';
  eventType?: string;
  eventTypes?: string[];
  source?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useEvents(options: UseEventsOptions = {}) {
  const { currentWorkspace } = useWorkspace();
  const { limit = 50, page = 0, status, eventType, eventTypes, source, search, dateFrom, dateTo } = options;

  return useQuery({
    queryKey: ['events', currentWorkspace?.id, limit, page, status, eventType, eventTypes, source, search, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async (): Promise<Event[]> => {
      if (!currentWorkspace?.id) return [];

      let query = supabase
        .from('events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('event_time', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (status) {
        query = query.eq('status', status);
      }
      if (eventType) {
        query = query.eq('event_type', eventType);
      }
      if (eventTypes && eventTypes.length > 0) {
        query = query.in('event_type', eventTypes);
      }
      if (source) {
        query = query.eq('source', source);
      }
      if (dateFrom) {
        query = query.gte('event_time', dateFrom.toISOString());
      }
      if (dateTo) {
        query = query.lte('event_time', dateTo.toISOString());
      }
      if (search && search.trim()) {
        query = query.or(`event_name.ilike.%${search}%,event_type.ilike.%${search}%,id.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Event[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useEventsCount(search?: string) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['events-count', currentWorkspace?.id, search],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { total: 0, today: 0, week: 0 };

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Build base query for total count
      let totalQuery = supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);
      
      if (search && search.trim()) {
        totalQuery = totalQuery.or(`event_name.ilike.%${search}%,event_type.ilike.%${search}%,id.ilike.%${search}%`);
      }

      const [totalResult, todayResult, weekResult] = await Promise.all([
        totalQuery,
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
        total: totalResult.count || 0,
        today: todayResult.count || 0,
        week: weekResult.count || 0,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}
