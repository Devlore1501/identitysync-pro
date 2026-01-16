import { useBehavioralStats } from '@/hooks/useBehavioralStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Target, 
  TrendingUp, 
  Layers, 
  Tag,
  Users,
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  Eye
} from 'lucide-react';

const funnelIcons = {
  visitor: Eye,
  browse_abandoned: Layers,
  cart_abandoned: ShoppingCart,
  checkout_abandoned: CreditCard,
  completed: CheckCircle2,
};

const funnelLabels = {
  visitor: 'Visitor',
  browse_abandoned: 'Browse',
  cart_abandoned: 'Cart',
  checkout_abandoned: 'Checkout',
  completed: 'Done',
};

const funnelLabelsFull = {
  visitor: 'Visitor',
  browse_abandoned: 'Browse Abandon',
  cart_abandoned: 'Cart Abandon',
  checkout_abandoned: 'Checkout Abandon',
  completed: 'Completed',
};

const funnelColors = {
  visitor: 'bg-muted',
  browse_abandoned: 'bg-blue-500/20 text-blue-600',
  cart_abandoned: 'bg-orange-500/20 text-orange-600',
  checkout_abandoned: 'bg-red-500/20 text-red-600',
  completed: 'bg-green-500/20 text-green-600',
};

export function BehavioralInsights() {
  const { data: stats, isLoading } = useBehavioralStats();

  if (isLoading) {
    return (
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[180px] md:h-[200px]" />
        <Skeleton className="h-[180px] md:h-[200px]" />
        <Skeleton className="h-[180px] md:h-[200px]" />
      </div>
    );
  }

  if (!stats) return null;

  const totalProfiles = stats.totalProfilesWithEmail + stats.totalProfilesAnonymous;
  const totalIntentUsers = stats.intentDistribution.low + stats.intentDistribution.medium + stats.intentDistribution.high;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        <h2 className="text-base md:text-lg font-semibold">Behavioral Intelligence</h2>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Intent Score Distribution */}
        <Card>
          <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-sm font-medium">Intent Distribution</CardTitle>
            <CardDescription className="text-xs">User purchase intent levels</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500" />
                  <span className="text-xs md:text-sm">High (61-100)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="font-medium text-sm">{stats.intentDistribution.high}</span>
                  <span className="text-xs text-muted-foreground">
                    ({totalIntentUsers > 0 ? Math.round((stats.intentDistribution.high / totalIntentUsers) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-yellow-500" />
                  <span className="text-xs md:text-sm">Medium (31-60)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="font-medium text-sm">{stats.intentDistribution.medium}</span>
                  <span className="text-xs text-muted-foreground">
                    ({totalIntentUsers > 0 ? Math.round((stats.intentDistribution.medium / totalIntentUsers) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500" />
                  <span className="text-xs md:text-sm">Low (0-30)</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="font-medium text-sm">{stats.intentDistribution.low}</span>
                  <span className="text-xs text-muted-foreground">
                    ({totalIntentUsers > 0 ? Math.round((stats.intentDistribution.low / totalIntentUsers) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Drop-off */}
        <Card>
          <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-sm font-medium">Funnel Drop-off</CardTitle>
            <CardDescription className="text-xs">Where users stop in the funnel</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="space-y-1.5 md:space-y-2">
              {(Object.keys(funnelLabels) as Array<keyof typeof funnelLabels>).map((stage) => {
                const Icon = funnelIcons[stage];
                const count = stats.funnelDropOff[stage];
                const total = Object.values(stats.funnelDropOff).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                
                return (
                  <div key={stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className={`p-0.5 md:p-1 rounded ${funnelColors[stage]}`}>
                        <Icon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      </div>
                      <span className="text-xs hidden sm:inline">{funnelLabelsFull[stage]}</span>
                      <span className="text-xs sm:hidden">{funnelLabels[stage]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="font-medium text-xs md:text-sm">{count}</span>
                      <div className="w-8 md:w-12 h-1 md:h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Metrics */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-sm font-medium">Engagement Scores</CardTitle>
            <CardDescription className="text-xs">Average behavioral metrics</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
                  <span className="text-xs md:text-sm">Frequency</span>
                </div>
                <span className="font-medium text-sm">{stats.avgFrequencyScore}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
                  <span className="text-xs md:text-sm">Depth</span>
                </div>
                <span className="font-medium text-sm">{stats.avgDepthScore}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
                  <span className="text-xs md:text-sm">Sessions (30d)</span>
                </div>
                <span className="font-medium text-sm">{stats.avgSessionCount}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Identified</span>
                  <span className="font-medium text-green-600">{stats.totalProfilesWithEmail}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Anonymous</span>
                  <span className="font-medium text-muted-foreground">{stats.totalProfilesAnonymous}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      {stats.topCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Top Categories (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {stats.topCategories.map((cat, index) => (
                <div 
                  key={cat.category}
                  className="flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-0.5 md:py-1 bg-muted rounded-full text-xs md:text-sm"
                >
                  <span className="font-medium">{cat.category}</span>
                  <span className="text-xs text-muted-foreground">({cat.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}