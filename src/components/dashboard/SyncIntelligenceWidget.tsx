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
        <CardHeader className="p-3 md:p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <div className="space-y-3 md:space-y-4">
            <Skeleton className="h-16 md:h-20" />
            <Skeleton className="h-12 md:h-16" />
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
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <CardTitle className="text-sm md:text-base">Sync Intelligence</CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getHealthColor(stats.healthScore)} border-current`}
                >
                  {stats.healthScore}%
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Success rate dei sync jobs</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription className="text-xs">
          Solo dati ad alto valore inviati a Klaviyo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4 p-3 pt-0 md:p-6 md:pt-0">
        {/* Health bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Sync Health</span>
            <span className={getHealthColor(stats.healthScore)}>{stats.healthScore}%</span>
          </div>
          <Progress value={stats.healthScore} className={`h-1.5 md:h-2 ${getHealthBg(stats.healthScore)}`} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="p-2 md:p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
              <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Sincronizzati</span>
            </div>
            <p className="text-lg md:text-xl font-bold text-green-600">{stats.synced}</p>
            <p className="text-xs text-muted-foreground mt-0.5 md:mt-1 hidden sm:block">
              {stats.profilesSynced} profili, {stats.eventsSynced} eventi
            </p>
          </div>

          <div className="p-2 md:p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
              <Shield className="w-3 h-3 md:w-4 md:h-4 text-orange-600" />
              <span className="text-xs text-muted-foreground">Bloccati</span>
            </div>
            <p className="text-lg md:text-xl font-bold text-orange-600">{stats.blocked}</p>
            <p className="text-xs text-muted-foreground mt-0.5 md:mt-1 hidden sm:block">
              Noise filtrato
            </p>
          </div>

          <div className="p-2 md:p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
              <Ban className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
              <span className="text-xs text-muted-foreground">Skippati</span>
            </div>
            <p className="text-lg md:text-xl font-bold text-gray-600">{stats.skipped}</p>
            <p className="text-xs text-muted-foreground mt-0.5 md:mt-1 hidden sm:block">
              Senza email
            </p>
          </div>

          <div className="p-2 md:p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
              <XCircle className="w-3 h-3 md:w-4 md:h-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Falliti</span>
            </div>
            <p className="text-lg md:text-xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-muted-foreground mt-0.5 md:mt-1 hidden sm:block">
              Errori API
            </p>
          </div>
        </div>

        {/* Last 24h activity */}
        <div className="pt-2 md:pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            <span className="text-xs md:text-sm font-medium">Ultime 24 ore</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs md:text-sm">
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Sync:</span>
              <span className="font-medium">{stats.syncedLast24h}</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Bloccati:</span>
              <span className="font-medium">{stats.blockedLast24h}</span>
            </div>
          </div>
          {stats.lastSyncAt && (
            <p className="text-xs text-muted-foreground mt-1.5 md:mt-2">
              Ultimo: {formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true, locale: it })}
            </p>
          )}
        </div>

        {/* Noise reduction message */}
        {stats.blocked > 0 && (
          <div className="p-2 md:p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-1.5 md:gap-2">
              <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-medium text-primary">Noise Reduction</p>
                <p className="text-xs text-muted-foreground mt-0.5 md:mt-1">
                  {stats.blocked} eventi filtrati. Solo segnali di valore.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}