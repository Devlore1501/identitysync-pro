import { useSyncStats } from '@/hooks/useDestinations';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

export function SyncStatusCompact() {
  const { data: syncStats, refetch } = useSyncStats();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-scheduler`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        const klaviyoResult = data.results?.klaviyo || {};
        if (klaviyoResult.processed > 0) {
          toast.success(`Sync: ${klaviyoResult.success || 0} profili`);
        } else {
          toast.info('Nessun job in coda');
        }
      } else {
        toast.error('Errore sync');
      }
      
      refetch();
    } catch (err) {
      toast.error('Errore di rete');
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingJobs = syncStats?.pending || 0;
  const completedJobs = syncStats?.completed || 0;
  const failedJobs = syncStats?.failed || 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 md:p-4 rounded-lg border border-border bg-muted/30">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {/* Completed */}
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium">{completedJobs}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">sync</span>
        </div>

        {/* Pending */}
        {pendingJobs > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            {pendingJobs} pending
          </Badge>
        )}

        {/* Failed */}
        {failedJobs > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            {failedJobs} failed
          </Badge>
        )}
      </div>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSync}
        disabled={isSyncing}
        className="min-w-[80px]"
      >
        <RefreshCw className={`w-4 h-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
        Sync
      </Button>
    </div>
  );
}
