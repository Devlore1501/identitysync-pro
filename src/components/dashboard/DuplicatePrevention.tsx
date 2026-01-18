import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  Copy, 
  TrendingDown,
  Percent
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';

interface DupeStats {
  totalEvents: number;
  duplicatedEvents: number;
  totalDuplicatesPrevented: number;
  dedupeRate: number;
  topRepeatedFingerprints: Array<{
    dedupe_key: string;
    dupe_count: number;
    event_name: string;
  }>;
}

export function DuplicatePrevention() {
  const { currentWorkspace } = useWorkspace();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['duplicate-prevention', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get events with dupe_count > 0
      const { data: events } = await supabase
        .from('events')
        .select('id, dedupe_key, dupe_count, event_name')
        .eq('workspace_id', currentWorkspace.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('dupe_count', { ascending: false })
        .limit(1000);

      if (!events) return null;

      const totalEvents = events.length;
      const duplicatedEvents = events.filter(e => (e.dupe_count || 0) > 0).length;
      const totalDuplicatesPrevented = events.reduce((sum, e) => sum + (e.dupe_count || 0), 0);
      const dedupeRate = totalEvents > 0 
        ? Math.round((totalDuplicatesPrevented / (totalEvents + totalDuplicatesPrevented)) * 100) 
        : 0;

      // Top repeated fingerprints
      const topRepeatedFingerprints = events
        .filter(e => (e.dupe_count || 0) > 0)
        .slice(0, 5)
        .map(e => ({
          dedupe_key: e.dedupe_key?.slice(0, 16) + '...' || 'N/A',
          dupe_count: e.dupe_count || 0,
          event_name: e.event_name,
        }));

      return {
        totalEvents,
        duplicatedEvents,
        totalDuplicatesPrevented,
        dedupeRate,
        topRepeatedFingerprints,
      } as DupeStats;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-500" />
          Duplicate Prevention
        </CardTitle>
        <CardDescription>
          Protezione anti-spam per Klaviyo (ultimi 7 giorni)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <Copy className="w-4 h-4 mx-auto mb-1 text-blue-500" />
            <div className="text-xl font-bold">{stats?.totalEvents || 0}</div>
            <div className="text-xs text-muted-foreground">Eventi totali</div>
          </div>
          
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
            <TrendingDown className="w-4 h-4 mx-auto mb-1 text-green-500" />
            <div className="text-xl font-bold text-green-500">{stats?.totalDuplicatesPrevented || 0}</div>
            <div className="text-xs text-muted-foreground">Duplicati bloccati</div>
          </div>
          
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
            <Percent className="w-4 h-4 mx-auto mb-1 text-primary" />
            <div className="text-xl font-bold text-primary">{stats?.dedupeRate || 0}%</div>
            <div className="text-xs text-muted-foreground">Dedupe rate</div>
          </div>
        </div>

        {/* Dedupe Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Efficacia deduplica</span>
            <span className="font-medium">{stats?.dedupeRate || 0}%</span>
          </div>
          <Progress value={stats?.dedupeRate || 0} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {stats?.totalDuplicatesPrevented || 0} eventi duplicati bloccati su {(stats?.totalEvents || 0) + (stats?.totalDuplicatesPrevented || 0)} totali
          </p>
        </div>

        {/* Top Repeated Fingerprints */}
        {stats?.topRepeatedFingerprints && stats.topRepeatedFingerprints.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Top fingerprint ripetuti</div>
            <div className="space-y-1">
              {stats.topRepeatedFingerprints.map((fp, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {fp.dedupe_key}
                    </Badge>
                    <span className="text-muted-foreground">{fp.event_name}</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                    -{fp.dupe_count} dupe
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explanation */}
        <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground">
          <strong>Perché è importante:</strong> Ogni evento duplicato bloccato significa meno spam 
          in Klaviyo metrics. Le properties vengono comunque aggiornate, ma l'evento non viene 
          reinviato - così i flow non si attivano più volte per lo stesso utente.
        </div>
      </CardContent>
    </Card>
  );
}
