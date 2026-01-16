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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (!stats) return null;

  const totalProfiles = stats.totalProfilesWithEmail + stats.totalProfilesAnonymous;
  const totalIntentUsers = stats.intentDistribution.low + stats.intentDistribution.medium + stats.intentDistribution.high;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Behavioral Intelligence</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Intent Score Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Intent Distribution</CardTitle>
            <CardDescription>User purchase intent levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">High (61-100)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.intentDistribution.high}</span>
                  <span className="text-xs text-muted-foreground">
                    ({totalIntentUsers > 0 ? Math.round((stats.intentDistribution.high / totalIntentUsers) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm">Medium (31-60)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.intentDistribution.medium}</span>
                  <span className="text-xs text-muted-foreground">
                    ({totalIntentUsers > 0 ? Math.round((stats.intentDistribution.medium / totalIntentUsers) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">Low (0-30)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{stats.intentDistribution.low}</span>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Funnel Drop-off</CardTitle>
            <CardDescription>Where users stop in the funnel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(Object.keys(funnelLabels) as Array<keyof typeof funnelLabels>).map((stage) => {
                const Icon = funnelIcons[stage];
                const count = stats.funnelDropOff[stage];
                const total = Object.values(stats.funnelDropOff).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                
                return (
                  <div key={stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${funnelColors[stage]}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="text-xs">{funnelLabels[stage]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{count}</span>
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement Scores</CardTitle>
            <CardDescription>Average behavioral metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Frequency Score</span>
                </div>
                <span className="font-medium">{stats.avgFrequencyScore}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Depth Score</span>
                </div>
                <span className="font-medium">{stats.avgDepthScore}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Avg Sessions (30d)</span>
                </div>
                <span className="font-medium">{stats.avgSessionCount}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Identified Profiles</span>
                  <span className="font-medium text-green-600">{stats.totalProfilesWithEmail}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Anonymous Profiles</span>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Top Categories (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topCategories.map((cat, index) => (
                <div 
                  key={cat.category}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full text-sm"
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
