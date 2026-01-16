import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface DashboardStats {
  eventsToday: number;
  eventsThisWeek: number;
  profilesResolved: number;
  syncSuccessRate: number;
}

export function useDashboardStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['dashboard-stats', currentWorkspace?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!currentWorkspace?.id) {
        return { eventsToday: 0, eventsThisWeek: 0, profilesResolved: 0, syncSuccessRate: 0 };
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get events count today
      const { count: eventsToday } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .gte('event_time', startOfToday);

      // Get events count this week
      const { count: eventsThisWeek } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .gte('event_time', startOfWeek);

      // Get profiles count
      const { count: profilesResolved } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);

      // Get sync success rate
      const { data: syncJobs } = await supabase
        .from('sync_jobs')
        .select('status')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', startOfWeek);

      const totalJobs = syncJobs?.length || 0;
      const completedJobs = syncJobs?.filter(j => j.status === 'completed').length || 0;
      const syncSuccessRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 100;

      return {
        eventsToday: eventsToday || 0,
        eventsThisWeek: eventsThisWeek || 0,
        profilesResolved: profilesResolved || 0,
        syncSuccessRate: Math.round(syncSuccessRate),
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
