import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface SyncStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
  successRate: number;
  recentErrors: Array<{
    id: string;
    error: string;
    created_at: string;
    job_type: string;
  }>;
  lastSyncAt: string | null;
  avgProcessingTime: number;
}

export function SyncHealth() {
  const { currentWorkspace } = useWorkspace();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['sync-health', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Get job counts by status
      const { data: jobs } = await supabase
        .from('sync_jobs')
        .select('status, created_at, completed_at, started_at, last_error, job_type, id')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (!jobs) return null;

      const pending = jobs.filter(j => j.status === 'pending').length;
      const running = jobs.filter(j => j.status === 'running').length;
      const completed = jobs.filter(j => j.status === 'completed').length;
      const failed = jobs.filter(j => j.status === 'failed').length;
      const total = jobs.length;

      // Calculate success rate
      const finishedJobs = completed + failed;
      const successRate = finishedJobs > 0 ? Math.round((completed / finishedJobs) * 100) : 100;

      // Get recent errors
      const recentErrors = jobs
        .filter(j => j.status === 'failed' && j.last_error)
        .slice(0, 5)
        .map(j => ({
          id: j.id,
          error: j.last_error || 'Unknown error',
          created_at: j.created_at,
          job_type: j.job_type,
        }));

      // Get last sync
      const lastCompleted = jobs.find(j => j.status === 'completed' && j.completed_at);
      const lastSyncAt = lastCompleted?.completed_at || null;

      // Calculate avg processing time
      const completedWithTimes = jobs.filter(j => j.started_at && j.completed_at);
      let avgProcessingTime = 0;
      if (completedWithTimes.length > 0) {
        const totalTime = completedWithTimes.reduce((sum, j) => {
          const start = new Date(j.started_at!).getTime();
          const end = new Date(j.completed_at!).getTime();
          return sum + (end - start);
        }, 0);
        avgProcessingTime = Math.round(totalTime / completedWithTimes.length);
      }

      return {
        pending,
        running,
        completed,
        failed,
        total,
        successRate,
        recentErrors,
        lastSyncAt,
        avgProcessingTime,
      } as SyncStats;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = stats?.successRate >= 95 ? 'healthy' : stats?.successRate >= 80 ? 'warning' : 'critical';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Sync Health
            </CardTitle>
            <CardDescription>
              Stato job queue (ultime 24h)
            </CardDescription>
          </div>
          <Badge 
            variant={healthStatus === 'healthy' ? 'default' : healthStatus === 'warning' ? 'secondary' : 'destructive'}
            className={healthStatus === 'healthy' ? 'bg-green-500' : ''}
          >
            {stats?.successRate || 100}% success
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Job Status Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <Clock className="w-4 h-4 mx-auto mb-1 text-yellow-500" />
            <div className="text-xl font-bold">{stats?.pending || 0}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <RefreshCw className="w-4 h-4 mx-auto mb-1 text-blue-500 animate-spin" />
            <div className="text-xl font-bold">{stats?.running || 0}</div>
            <div className="text-xs text-muted-foreground">Running</div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <CheckCircle className="w-4 h-4 mx-auto mb-1 text-green-500" />
            <div className="text-xl font-bold">{stats?.completed || 0}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <XCircle className="w-4 h-4 mx-auto mb-1 text-red-500" />
            <div className="text-xl font-bold">{stats?.failed || 0}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            Ultimo sync: {stats?.lastSyncAt 
              ? formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true, locale: it })
              : 'Mai'}
          </div>
          <div className="text-muted-foreground">
            Tempo medio: {stats?.avgProcessingTime ? `${Math.round(stats.avgProcessingTime / 1000)}s` : 'N/A'}
          </div>
        </div>

        {/* Recent Errors */}
        {stats?.recentErrors && stats.recentErrors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-500">
              <AlertTriangle className="w-4 h-4" />
              Errori recenti
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {stats.recentErrors.map((err) => (
                <div key={err.id} className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{err.job_type}</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(err.created_at), { addSuffix: true, locale: it })}
                    </span>
                  </div>
                  <div className="text-red-400 truncate">{err.error}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
