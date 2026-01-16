/**
 * Klaviyo Sync Job Types
 * 
 * Defines the job types used by the sync-klaviyo edge function.
 */

export type SyncJobType = 'profile_upsert' | 'event_track';
export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SyncJob {
  id: string;
  workspaceId: string;
  destinationId: string;
  jobType: SyncJobType;
  status: SyncJobStatus;
  
  // References
  eventId?: string;
  unifiedUserId?: string;
  
  // Execution tracking
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  
  // Timestamps
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

/**
 * Sync job outcome statistics
 */
export interface SyncStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  skipped: number; // No email - correctly skipped
}

/**
 * Calculate sync health percentage
 */
export function calculateSyncHealth(stats: SyncStats): number {
  const processed = stats.completed + stats.skipped;
  const total = stats.completed + stats.failed + stats.skipped;
  
  if (total === 0) return 100;
  return Math.round((processed / total) * 100);
}

/**
 * Get sync status message
 */
export function getSyncStatusMessage(stats: SyncStats): string {
  if (stats.pending > 0) {
    return `${stats.pending} jobs pending`;
  }
  if (stats.running > 0) {
    return `${stats.running} jobs in progress`;
  }
  if (stats.failed > 0) {
    return `${stats.failed} jobs failed`;
  }
  return 'All synced';
}
