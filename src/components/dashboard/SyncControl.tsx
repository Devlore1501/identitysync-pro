import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useSyncStats } from '@/hooks/useDestinations';
import { useQueryClient } from '@tanstack/react-query';

interface SyncResult {
  processed?: number;
  success?: number;
  failed?: number;
  message?: string;
  error?: string;
}

export function SyncControl() {
  const [syncing, setSyncing] = useState(false);
  const [processingBackground, setProcessingBackground] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const { data: syncStats, refetch: refetchStats } = useSyncStats();
  const queryClient = useQueryClient();

  const handleForceSync = async () => {
    setSyncing(true);
    setLastResult(null);

    try {
      // Call sync-klaviyo directly to process pending jobs
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-klaviyo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const data = await response.json();
      setLastResult(data);

      if (response.ok) {
        if (data.processed > 0) {
          toast.success(`Sync completato: ${data.success}/${data.processed} job processati`);
        } else {
          toast.info('Nessun job pending da processare');
        }
      } else {
        toast.error(`Errore sync: ${data.error || 'Unknown error'}`);
      }

      // Refresh stats
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['sync-stats'] });
    } catch (error) {
      toast.error('Errore durante il sync');
      setLastResult({ error: 'Network error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleBackgroundProcess = async () => {
    setProcessingBackground(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/background-processor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ limit: 100 }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const updates = [
          data.recencyUpdated > 0 ? `${data.recencyUpdated} recency` : null,
          data.signalsRecomputed > 0 ? `${data.signalsRecomputed} signals` : null,
          data.profileSyncsScheduled > 0 ? `${data.profileSyncsScheduled} syncs scheduled` : null,
          data.abandonmentDetected > 0 ? `${data.abandonmentDetected} abandonments` : null,
        ].filter(Boolean);

        if (updates.length > 0) {
          toast.success(`Background process: ${updates.join(', ')}`);
        } else {
          toast.info('Nessun aggiornamento necessario');
        }
      } else {
        toast.error(`Errore: ${data.error || 'Unknown error'}`);
      }

      // Refresh all relevant queries
      queryClient.invalidateQueries({ queryKey: ['behavioral-stats'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      refetchStats();
    } catch (error) {
      toast.error('Errore durante il background processing');
    } finally {
      setProcessingBackground(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Sync Control
        </CardTitle>
        <CardDescription>
          Forza sync manuale verso Klaviyo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending jobs indicator */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Sync Jobs Pending</p>
            <p className="text-xs text-muted-foreground">In attesa di essere processati</p>
          </div>
          <div className="text-2xl font-bold text-primary">
            {syncStats?.pending || 0}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleForceSync} 
            disabled={syncing || (syncStats?.pending === 0)}
            className="flex-1"
            variant={syncStats?.pending && syncStats.pending > 0 ? "default" : "outline"}
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Klaviyo
              </>
            )}
          </Button>

          <Button 
            onClick={handleBackgroundProcess} 
            disabled={processingBackground}
            variant="outline"
            className="flex-1"
          >
            {processingBackground ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Recompute Traits
              </>
            )}
          </Button>
        </div>

        {/* Last result */}
        {lastResult && (
          <div className={`flex items-center gap-2 p-2 rounded text-sm ${
            lastResult.error 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-green-500/10 text-green-600'
          }`}>
            {lastResult.error ? (
              <>
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{lastResult.error}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  {lastResult.processed === 0 
                    ? 'No pending jobs' 
                    : `${lastResult.success}/${lastResult.processed} synced`}
                  {lastResult.failed && lastResult.failed > 0 && ` (${lastResult.failed} failed)`}
                </span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
