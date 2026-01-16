import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface SyncIntelligence {
  // Sync job stats
  totalProcessed: number;
  synced: number;
  skipped: number;
  blocked: number;
  failed: number;
  
  // Rates
  syncRate: number;
  blockRate: number;
  healthScore: number;
  
  // By type
  profilesSynced: number;
  eventsSynced: number;
  eventsBlocked: number;
  
  // Recent activity
  lastSyncAt: string | null;
  syncedLast24h: number;
  blockedLast24h: number;
}

const BLOCKED_EVENT_PATTERNS = [
  'Page View',
  'Session Start',
  'Scroll Depth',
  'Time on Page',
  'Product Viewed',
  'View Item',
  'View Category',
];

export function useSyncIntelligence() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['sync-intelligence', currentWorkspace?.id],
    queryFn: async (): Promise<SyncIntelligence> => {
      if (!currentWorkspace?.id) {
        return getEmptyStats();
      }

      // Fetch sync jobs from last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: jobs, error } = await supabase
        .from('sync_jobs')
        .select('id, job_type, status, last_error, completed_at')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', sevenDaysAgo)
        .in('status', ['completed', 'failed']);

      if (error) throw error;

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let synced = 0;
      let skipped = 0;
      let blocked = 0;
      let failed = 0;
      let profilesSynced = 0;
      let eventsSynced = 0;
      let eventsBlocked = 0;
      let syncedLast24h = 0;
      let blockedLast24h = 0;
      let lastSyncAt: string | null = null;

      for (const job of jobs || []) {
        const isRecent = job.completed_at && new Date(job.completed_at) > last24h;
        
        if (job.status === 'failed') {
          failed++;
          continue;
        }

        // Completed jobs - analyze by last_error
        const lastError = job.last_error || '';
        
        if (lastError.includes('Skipped')) {
          skipped++;
        } else if (lastError.includes('Blocked')) {
          blocked++;
          eventsBlocked++;
          if (isRecent) blockedLast24h++;
        } else if (lastError === '' || lastError === null) {
          // Successfully synced - no error
          synced++;
          if (isRecent) syncedLast24h++;
          
          if (job.job_type === 'profile_upsert') {
            profilesSynced++;
          } else if (job.job_type === 'event_track') {
            eventsSynced++;
          }

          if (job.completed_at && (!lastSyncAt || job.completed_at > lastSyncAt)) {
            lastSyncAt = job.completed_at;
          }
        } else {
          // Has an error but not Skipped/Blocked = actual failure
          failed++;
        }
      }

      const totalProcessed = synced + skipped + blocked + failed;
      const syncRate = totalProcessed > 0 ? Math.round((synced / totalProcessed) * 100) : 0;
      const blockRate = totalProcessed > 0 ? Math.round(((blocked + skipped) / totalProcessed) * 100) : 0;
      
      // Health score: penalize failures, reward blocking noise
      const healthScore = totalProcessed > 0 
        ? Math.round(((synced + blocked + skipped) / totalProcessed) * 100)
        : 100;

      return {
        totalProcessed,
        synced,
        skipped,
        blocked,
        failed,
        syncRate,
        blockRate,
        healthScore,
        profilesSynced,
        eventsSynced,
        eventsBlocked,
        lastSyncAt,
        syncedLast24h,
        blockedLast24h,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

function getEmptyStats(): SyncIntelligence {
  return {
    totalProcessed: 0,
    synced: 0,
    skipped: 0,
    blocked: 0,
    failed: 0,
    syncRate: 0,
    blockRate: 0,
    healthScore: 100,
    profilesSynced: 0,
    eventsSynced: 0,
    eventsBlocked: 0,
    lastSyncAt: null,
    syncedLast24h: 0,
    blockedLast24h: 0,
  };
}
