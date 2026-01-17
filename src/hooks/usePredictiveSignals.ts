import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface PredictiveSignal {
  id: string;
  workspace_id: string;
  unified_user_id: string;
  signal_type: string;
  signal_name: string;
  confidence: number;
  payload: Record<string, unknown>;
  synced_to: Record<string, string | null>;
  last_synced_at: string | null;
  should_trigger_flow: boolean;
  flow_triggered_at: string | null;
  flow_name: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface SignalStats {
  total: number;
  by_type: Record<string, number>;
  pending_flows: number;
  synced: number;
  avg_confidence: number;
}

export function usePredictiveSignals() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['predictive-signals', currentWorkspace?.id],
    queryFn: async (): Promise<PredictiveSignal[]> => {
      if (!currentWorkspace?.id) return [];

      const { data, error } = await supabase
        .from('predictive_signals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('confidence', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Type assertion since the table was just created
      return (data || []) as unknown as PredictiveSignal[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

export function usePredictiveSignalStats() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['predictive-signal-stats', currentWorkspace?.id],
    queryFn: async (): Promise<SignalStats> => {
      if (!currentWorkspace?.id) {
        return { total: 0, by_type: {}, pending_flows: 0, synced: 0, avg_confidence: 0 };
      }

      const { data, error } = await supabase
        .from('predictive_signals')
        .select('signal_type, confidence, should_trigger_flow, flow_triggered_at, synced_to')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const signals = (data || []) as unknown as PredictiveSignal[];
      
      const by_type: Record<string, number> = {};
      let totalConfidence = 0;
      let pendingFlows = 0;
      let synced = 0;

      for (const signal of signals) {
        by_type[signal.signal_type] = (by_type[signal.signal_type] || 0) + 1;
        totalConfidence += signal.confidence;
        if (signal.should_trigger_flow && !signal.flow_triggered_at) {
          pendingFlows++;
        }
        // Conta come sincronizzato se synced_to ha almeno una chiave con valore non null
        const syncedTo = signal.synced_to as Record<string, string | null>;
        if (syncedTo && Object.values(syncedTo).some(v => v !== null)) {
          synced++;
        }
      }

      return {
        total: signals.length,
        by_type,
        pending_flows: pendingFlows,
        synced,
        avg_confidence: signals.length > 0 ? Math.round(totalConfidence / signals.length) : 0,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}

export function useRunPredictiveEngine() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.functions.invoke('predictive-engine', {
        body: { workspace_id: currentWorkspace.id }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['predictive-signals'] });
      queryClient.invalidateQueries({ queryKey: ['predictive-signal-stats'] });
      toast.success(`Engine eseguito: ${data.signals_created} segnali creati, ${data.signals_updated} aggiornati`);
    },
    onError: (error) => {
      console.error('Predictive engine error:', error);
      toast.error('Errore durante esecuzione engine predittivo');
    }
  });
}
