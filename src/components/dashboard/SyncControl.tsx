import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Zap, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { useSyncStats } from '@/hooks/useDestinations';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SyncResult {
  processed?: number;
  success?: number;
  failed?: number;
  skipped?: number;
  message?: string;
  error?: string;
}

export function SyncControl() {
  const [syncing, setSyncing] = useState(false);
  const [processingBackground, setProcessingBackground] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const autoSyncRef = useRef<NodeJS.Timeout | null>(null);
  const { data: syncStats, refetch: refetchStats } = useSyncStats();
  const queryClient = useQueryClient();

  // Auto-sync effect
  useEffect(() => {
    if (autoSync) {
      // Run immediately
      handleForceSync();
      
      // Then run every 30 seconds
      autoSyncRef.current = setInterval(() => {
        handleForceSync();
      }, 30000);
    } else {
      if (autoSyncRef.current) {
        clearInterval(autoSyncRef.current);
        autoSyncRef.current = null;
      }
    }

    return () => {
      if (autoSyncRef.current) {
        clearInterval(autoSyncRef.current);
      }
    };
  }, [autoSync]);

  const handleForceSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setLastResult(null);

    try {
      // Call sync-scheduler to process all destinations
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
      
      // Parse results from scheduler
      const klaviyoResult = data.results?.klaviyo || {};
      const result: SyncResult = {
        processed: klaviyoResult.processed || 0,
        success: klaviyoResult.success || 0,
        failed: klaviyoResult.failed || 0,
        skipped: klaviyoResult.skipped || 0,
      };
      setLastResult(result);

      if (response.ok) {
        if (result.processed && result.processed > 0) {
          const parts = [];
          if (result.success) parts.push(`${result.success} sync`);
          if (result.skipped) parts.push(`${result.skipped} skip`);
          if (result.failed) parts.push(`${result.failed} fail`);
          toast.success(`Sync: ${parts.join(', ')}`);
        } else if (!autoSync) {
          toast.info('Nessun job pending');
        }
      } else {
        toast.error(`Errore: ${data.error || 'Unknown'}`);
      }

      // Refresh stats
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ['sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['system-health'] });
    } catch (error) {
      if (!autoSync) {
        toast.error('Errore durante il sync');
      }
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
          data.profileSyncsScheduled > 0 ? `${data.profileSyncsScheduled} syncs` : null,
          data.abandonmentDetected > 0 ? `${data.abandonmentDetected} abandons` : null,
        ].filter(Boolean);

        if (updates.length > 0) {
          toast.success(`Background: ${updates.join(', ')}`);
        } else {
          toast.info('Nessun aggiornamento');
        }
      } else {
        toast.error(`Errore: ${data.error || 'Unknown'}`);
      }

      queryClient.invalidateQueries({ queryKey: ['behavioral-stats'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['system-health'] });
      refetchStats();
    } catch (error) {
      toast.error('Errore background processing');
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
          Sincronizza profili ed eventi con Klaviyo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-sync toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            {autoSync ? (
              <Play className="w-4 h-4 text-green-500" />
            ) : (
              <Pause className="w-4 h-4 text-muted-foreground" />
            )}
            <Label htmlFor="auto-sync" className="text-sm font-medium cursor-pointer">
              Auto-Sync
            </Label>
          </div>
          <Switch
            id="auto-sync"
            checked={autoSync}
            onCheckedChange={setAutoSync}
          />
        </div>

        {autoSync && (
          <p className="text-xs text-muted-foreground">
            Sync automatico ogni 30 secondi
          </p>
        )}

        {/* Pending jobs indicator */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Jobs Pending</p>
            <p className="text-xs text-muted-foreground">In attesa di sync</p>
          </div>
          <div className="text-2xl font-bold text-primary">
            {syncStats?.pending || 0}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleForceSync} 
            disabled={syncing}
            className="flex-1"
            variant={syncStats?.pending && syncStats.pending > 0 ? "default" : "outline"}
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sync...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Now
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
                ...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Recompute
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
                    ? 'No pending' 
                    : `${lastResult.success}✓ ${lastResult.skipped || 0}⊘ ${lastResult.failed || 0}✗`}
                </span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
