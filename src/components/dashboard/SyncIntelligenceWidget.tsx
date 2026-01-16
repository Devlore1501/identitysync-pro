import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSyncIntelligence } from '@/hooks/useSyncIntelligence';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Zap, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Ban,
  Activity,
  TrendingDown
} from 'lucide-react';

export function SyncIntelligenceWidget() {
  const { data: stats, isLoading } = useSyncIntelligence();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBg = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Sync Intelligence</CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <Badge 
                  variant="outline" 
                  className={`${getHealthColor(stats.healthScore)} border-current`}
                >
                  {stats.healthScore}% Health
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Success rate dei sync jobs (esclude skip e block)</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          Solo dati ad alto valore inviati a Klaviyo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Sync Health</span>
            <span className={getHealthColor(stats.healthScore)}>{stats.healthScore}%</span>
          </div>
          <Progress value={stats.healthScore} className={`h-2 ${getHealthBg(stats.healthScore)}`} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Sincronizzati</span>
            </div>
            <p className="text-xl font-bold text-green-600">{stats.synced}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.profilesSynced} profili, {stats.eventsSynced} eventi
            </p>
          </div>

          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-muted-foreground">Bloccati (noise)</span>
            </div>
            <p className="text-xl font-bold text-orange-600">{stats.blocked}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Page views, product views filtrati
            </p>
          </div>

          <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Ban className="w-4 h-4 text-gray-600" />
              <span className="text-xs text-muted-foreground">Skippati</span>
            </div>
            <p className="text-xl font-bold text-gray-600">{stats.skipped}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Utenti senza email
            </p>
          </div>

          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Falliti</span>
            </div>
            <p className="text-xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Errori API Klaviyo
            </p>
          </div>
        </div>

        {/* Last 24h activity */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Ultime 24 ore</span>
          </div>
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Sincronizzati:</span>
              <span className="font-medium">{stats.syncedLast24h}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Bloccati:</span>
              <span className="font-medium">{stats.blockedLast24h}</span>
            </div>
          </div>
          {stats.lastSyncAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Ultimo sync: {formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true, locale: it })}
            </p>
          )}
        </div>

        {/* Noise reduction message */}
        {stats.blocked > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-2">
              <TrendingDown className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary">Noise Reduction Attivo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.blocked} eventi a basso valore filtrati. Klaviyo riceve solo segnali ad alta intenzione.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
