import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface FunnelStep {
  name: string;
  count: number;
  conversionRate: number;
  dropOff: number;
}

interface FunnelStats {
  steps: FunnelStep[];
  overallConversion: number;
  period: string;
}

export function useFunnelStats(days: number = 7) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['funnel-stats', currentWorkspace?.id, days],
    queryFn: async (): Promise<FunnelStats> => {
      if (!currentWorkspace?.id) {
        return { steps: [], overallConversion: 0, period: `${days} days` };
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch event counts by event_name for funnel steps
      const { data: events, error } = await supabase
        .from('events')
        .select('event_name')
        .eq('workspace_id', currentWorkspace.id)
        .gte('event_time', startDate.toISOString());

      if (error) throw error;

      // Count events by type
      const eventCounts: Record<string, number> = {};
      (events || []).forEach((e) => {
        const name = e.event_name;
        eventCounts[name] = (eventCounts[name] || 0) + 1;
      });

      // Define funnel steps in order
      const funnelSteps = [
        { key: 'Page View', label: 'Visitatori' },
        { key: 'View Collection', label: 'Collezioni' },
        { key: 'View Item', label: 'Prodotti' },
        { key: 'Add to Cart', label: 'Carrello' },
        { key: 'Begin Checkout', label: 'Checkout' },
        { key: 'Purchase', label: 'Acquisti' },
      ];

      const steps: FunnelStep[] = [];
      let previousCount = 0;

      funnelSteps.forEach((step, index) => {
        const count = eventCounts[step.key] || 0;
        const conversionRate = index === 0 ? 100 : (previousCount > 0 ? (count / previousCount) * 100 : 0);
        const dropOff = index === 0 ? 0 : (previousCount > 0 ? ((previousCount - count) / previousCount) * 100 : 0);

        steps.push({
          name: step.label,
          count,
          conversionRate: Math.round(conversionRate * 10) / 10,
          dropOff: Math.round(dropOff * 10) / 10,
        });

        previousCount = count;
      });

      // Overall conversion: Purchases / Page Views
      const pageViews = eventCounts['Page View'] || 0;
      const purchases = eventCounts['Purchase'] || 0;
      const overallConversion = pageViews > 0 ? (purchases / pageViews) * 100 : 0;

      return {
        steps,
        overallConversion: Math.round(overallConversion * 100) / 100,
        period: `${days} giorni`,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });
}

export function usePixelStatus() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['pixel-status', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) {
        return { jsPixel: null, webhooks: null };
      }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get last JS pixel event
      const { data: jsEvents } = await supabase
        .from('events')
        .select('event_time, event_name, source')
        .eq('workspace_id', currentWorkspace.id)
        .eq('source', 'js')
        .order('event_time', { ascending: false })
        .limit(1);

      // Get last webhook event
      const { data: webhookEvents } = await supabase
        .from('events')
        .select('event_time, event_name, source')
        .eq('workspace_id', currentWorkspace.id)
        .eq('source', 'shopify')
        .order('event_time', { ascending: false })
        .limit(1);

      // Count events in last 24h by source
      const { data: jsCounts } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('source', 'js')
        .gte('event_time', oneDayAgo.toISOString());

      const { data: webhookCounts } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('source', 'shopify')
        .gte('event_time', oneDayAgo.toISOString());

      return {
        jsPixel: {
          lastEvent: jsEvents?.[0] || null,
          countLast24h: (jsCounts as unknown as { count: number })?.count || 0,
        },
        webhooks: {
          lastEvent: webhookEvents?.[0] || null,
          countLast24h: (webhookCounts as unknown as { count: number })?.count || 0,
        },
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });
}
