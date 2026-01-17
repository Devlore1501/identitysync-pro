import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  RefreshCw, 
  Target, 
  ShoppingCart, 
  CreditCard, 
  Eye,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Clock,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { usePredictiveSignalStats, useRunPredictiveEngine } from '@/hooks/usePredictiveSignals';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

const SIGNAL_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}> = {
  high_intent_cart: {
    icon: ShoppingCart,
    label: 'Cart High Intent',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
  },
  checkout_urgency: {
    icon: CreditCard,
    label: 'Checkout Urgente',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10 border-red-500/20',
  },
  browse_warming: {
    icon: Eye,
    label: 'Browse Warming',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
  },
  churn_risk: {
    icon: AlertTriangle,
    label: 'Churn Risk',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  category_interest: {
    icon: Target,
    label: 'Category Interest',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
  },
  about_to_purchase: {
    icon: Zap,
    label: 'About to Purchase',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10 border-green-500/20',
  },
};

// Sync handled by SyncStatusCompact - removed duplicate function

export function PredictiveRegistry() {
  const { data: stats, isLoading, dataUpdatedAt } = usePredictiveSignalStats();
  const runEngine = useRunPredictiveEngine();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await runEngine.mutateAsync();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const signalTypes = Object.entries(stats?.by_type || {}).sort((a, b) => b[1] - a[1]);
  const lastUpdated = dataUpdatedAt ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: it }) : null;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <CardTitle className="text-sm md:text-base font-semibold">Registro Predittivo</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing || runEngine.isPending}
              className="h-7 md:h-8 text-xs"
            >
              <RefreshCw className={`w-3 h-3 md:w-4 md:h-4 mr-1 ${isRefreshing || runEngine.isPending ? 'animate-spin' : ''}`} />
              Ricalcola
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Segnali comportamentali pronti per flow Klaviyo
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0 space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 md:gap-3">
          <div className="text-center p-2 md:p-3 rounded-lg bg-muted/50">
            <div className="text-lg md:text-2xl font-bold text-foreground">{stats?.total || 0}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Segnali</div>
          </div>
          <div className="text-center p-2 md:p-3 rounded-lg bg-green-500/10">
            <div className="flex items-center justify-center gap-1">
              <div className="text-lg md:text-2xl font-bold text-green-600">{stats?.synced || 0}</div>
              {stats?.synced && stats.synced > 0 && (
                <ArrowUpRight className="w-3 h-3 text-green-600" />
              )}
            </div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Sincronizzati</div>
          </div>
          <div className="text-center p-2 md:p-3 rounded-lg bg-orange-500/10">
            <div className="text-lg md:text-2xl font-bold text-orange-600">{stats?.pending_flows || 0}</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Flow Pronti</div>
          </div>
          <div className="text-center p-2 md:p-3 rounded-lg bg-primary/10">
            <div className="text-lg md:text-2xl font-bold text-primary">{stats?.avg_confidence || 0}%</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Confidenza</div>
          </div>
        </div>

        {/* Signal Types */}
        {signalTypes.length > 0 ? (
          <div className="space-y-2">
            {signalTypes.map(([type, count]) => {
              const config = SIGNAL_CONFIG[type] || {
                icon: Target,
                label: type.replace(/_/g, ' '),
                color: 'text-muted-foreground',
                bgColor: 'bg-muted',
              };
              const Icon = config.icon;

              return (
                <div 
                  key={type}
                  className={`flex items-center justify-between p-2 md:p-3 rounded-lg border ${config.bgColor}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className="text-xs md:text-sm font-medium">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {count} utenti
                    </Badge>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessun segnale predittivo attivo</p>
            <p className="text-xs mt-1">Clicca "Ricalcola" per generare segnali</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{lastUpdated || 'Mai aggiornato'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Auto-refresh ogni 30s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
