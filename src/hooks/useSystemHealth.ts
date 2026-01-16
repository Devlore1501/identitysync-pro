import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface SystemHealth {
  // User stats
  totalUsers: number;
  usersWithEmail: number;
  usersWithoutEmail: number;
  emailCaptureRate: number;
  
  // Event stats
  totalEvents: number;
  eventsToday: number;
  eventsThisWeek: number;
  eventsLinkedToUsers: number;
  orphanEvents: number;
  
  // Sync stats
  pendingSyncs: number;
  completedSyncs: number;
  failedSyncs: number;
  skippedSyncs: number;
  syncSuccessRate: number;
  
  // Destination stats
  activeDestinations: number;
  
  // Timestamps
  lastEventAt: string | null;
  lastSyncAt: string | null;
}

export function useSystemHealth() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['system-health', currentWorkspace?.id],
    queryFn: async (): Promise<SystemHealth> => {
      if (!currentWorkspace?.id) {
        return getEmptyStats();
      }

      const workspaceId = currentWorkspace.id;
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all stats in parallel
      const [
        usersResult,
        usersWithEmailResult,
        eventsResult,
        eventsTodayResult,
        eventsWeekResult,
        linkedEventsResult,
        syncJobsResult,
        destinationsResult,
        lastEventResult,
        lastSyncResult,
      ] = await Promise.all([
        // Total users
        supabase
          .from('users_unified')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId),
        
        // Users with email
        supabase
          .from('users_unified')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .not('primary_email', 'is', null),
        
        // Total events
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId),
        
        // Events today
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .gte('event_time', startOfToday),
        
        // Events this week
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .gte('event_time', startOfWeek),
        
        // Events linked to users
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .not('unified_user_id', 'is', null),
        
        // Sync jobs this week
        supabase
          .from('sync_jobs')
          .select('status, last_error')
          .eq('workspace_id', workspaceId)
          .gte('created_at', startOfWeek),
        
        // Active destinations
        supabase
          .from('destinations')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('enabled', true),
        
        // Last event
        supabase
          .from('events')
          .select('event_time')
          .eq('workspace_id', workspaceId)
          .order('event_time', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Last completed sync
        supabase
          .from('sync_jobs')
          .select('completed_at')
          .eq('workspace_id', workspaceId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const totalUsers = usersResult.count || 0;
      const usersWithEmail = usersWithEmailResult.count || 0;
      const usersWithoutEmail = totalUsers - usersWithEmail;
      const emailCaptureRate = totalUsers > 0 ? Math.round((usersWithEmail / totalUsers) * 100) : 0;

      const totalEvents = eventsResult.count || 0;
      const eventsToday = eventsTodayResult.count || 0;
      const eventsThisWeek = eventsWeekResult.count || 0;
      const eventsLinkedToUsers = linkedEventsResult.count || 0;
      const orphanEvents = totalEvents - eventsLinkedToUsers;

      const syncJobs = syncJobsResult.data || [];
      const pendingSyncs = syncJobs.filter(j => j.status === 'pending' || j.status === 'running').length;
      const completedSyncs = syncJobs.filter(j => j.status === 'completed' && !j.last_error?.includes('Skipped')).length;
      const failedSyncs = syncJobs.filter(j => j.status === 'failed').length;
      const skippedSyncs = syncJobs.filter(j => j.status === 'completed' && j.last_error?.includes('Skipped')).length;
      const totalProcessed = completedSyncs + failedSyncs;
      const syncSuccessRate = totalProcessed > 0 ? Math.round((completedSyncs / totalProcessed) * 100) : 100;

      return {
        totalUsers,
        usersWithEmail,
        usersWithoutEmail,
        emailCaptureRate,
        totalEvents,
        eventsToday,
        eventsThisWeek,
        eventsLinkedToUsers,
        orphanEvents,
        pendingSyncs,
        completedSyncs,
        failedSyncs,
        skippedSyncs,
        syncSuccessRate,
        activeDestinations: destinationsResult.count || 0,
        lastEventAt: lastEventResult.data?.event_time || null,
        lastSyncAt: lastSyncResult.data?.completed_at || null,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 15000, // Refresh every 15 seconds
  });
}

function getEmptyStats(): SystemHealth {
  return {
    totalUsers: 0,
    usersWithEmail: 0,
    usersWithoutEmail: 0,
    emailCaptureRate: 0,
    totalEvents: 0,
    eventsToday: 0,
    eventsThisWeek: 0,
    eventsLinkedToUsers: 0,
    orphanEvents: 0,
    pendingSyncs: 0,
    completedSyncs: 0,
    failedSyncs: 0,
    skippedSyncs: 0,
    syncSuccessRate: 100,
    activeDestinations: 0,
    lastEventAt: null,
    lastSyncAt: null,
  };
}
