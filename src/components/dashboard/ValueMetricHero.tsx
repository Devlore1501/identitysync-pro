import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, CheckCircle2, ArrowRight, Eye, ShoppingCart, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ValueMetrics {
  checkoutStarted: number;
  profilesWithCheckoutAbandoned: number;
  recoveredUsers: number;
  recoveryRatePercent: number;
  profilesSynced: number;
  extendedFunnel: {
    productViewsTotal: number;
    productViewHighIntent: number;
    productViewSynced: number;
    cartEventsTotal: number;
    cartHighIntent: number;
    cartSynced: number;
    browseAbandonmentPotential: number;
    cartAbandonmentPotential: number;
  };
  intentDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export function ValueMetricHero() {
  const { currentWorkspace } = useWorkspace();
  const [metrics, setMetrics] = useState<ValueMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!currentWorkspace) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('value-metrics', {
          body: { workspace_id: currentWorkspace.id, days: 30 }
        });

        if (error) throw error;

        setMetrics({
          checkoutStarted: data.checkout_started_total || 0,
          profilesWithCheckoutAbandoned: data.profiles_with_sf_checkout_abandoned_at || 0,
          recoveredUsers: data.recovered_users || 0,
          recoveryRatePercent: data.recovery_rate_percent || 0,
          profilesSynced: data.profiles_synced_to_klaviyo || 0,
          extendedFunnel: {
            productViewsTotal: data.extended_funnel?.product_views_total || 0,
            productViewHighIntent: data.extended_funnel?.product_view_high_intent || 0,
            productViewSynced: data.extended_funnel?.product_view_synced || 0,
            cartEventsTotal: data.extended_funnel?.cart_events_total || 0,
            cartHighIntent: data.extended_funnel?.cart_high_intent || 0,
            cartSynced: data.extended_funnel?.cart_synced || 0,
            browseAbandonmentPotential: data.extended_funnel?.browse_abandonment_potential || 0,
            cartAbandonmentPotential: data.extended_funnel?.cart_abandonment_potential || 0,
          },
          intentDistribution: {
            high: data.intent_score_distribution?.high || 0,
            medium: data.intent_score_distribution?.medium || 0,
            low: data.intent_score_distribution?.low || 0,
          },
        });
      } catch (err) {
        console.error('Value metrics error:', err);
        setMetrics(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [currentWorkspace]);

  if (isLoading) {
    return (
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4 md:p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const mainValue = metrics?.recoveredUsers || 0;
  const syncedValue = metrics?.profilesSynced || 0;
  const recoveryRate = metrics?.recoveryRatePercent || 0;

  // Calculate total potential across funnel
  const totalPotential = 
    (metrics?.extendedFunnel.browseAbandonmentPotential || 0) +
    (metrics?.extendedFunnel.cartAbandonmentPotential || 0) +
    mainValue;

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      <CardContent className="p-4 md:p-6">
        {/* Main value metric */}
        <div className="text-center mb-4 md:mb-6">
          <p className="text-sm text-muted-foreground mb-2">
            Utenti recuperabili per Klaviyo Flows
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="text-4xl md:text-6xl font-bold text-primary">
              {totalPotential}
            </div>
            {syncedValue > 0 && (
              <div className="flex items-center gap-1 text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">{syncedValue} sync</span>
              </div>
            )}
          </div>
          {recoveryRate > 0 && (
            <p className="text-xs text-green-600 mt-1 font-medium">
              {recoveryRate}% recovery rate
            </p>
          )}
        </div>

        {/* Extended Funnel - 3 columns */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
          {/* Browse Abandonment */}
          <div className="text-center p-2 md:p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Eye className="w-4 h-4 md:w-5 md:h-5 mx-auto text-blue-500 mb-1" />
            <div className="text-lg md:text-2xl font-bold text-blue-600">
              {metrics?.extendedFunnel.productViewHighIntent || 0}
            </div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Browse</div>
            <div className="text-[10px] text-blue-500">intent ≥30</div>
          </div>

          {/* Cart Abandonment */}
          <div className="text-center p-2 md:p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 mx-auto text-orange-500 mb-1" />
            <div className="text-lg md:text-2xl font-bold text-orange-600">
              {metrics?.extendedFunnel.cartHighIntent || 0}
            </div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Cart</div>
            <div className="text-[10px] text-orange-500">intent ≥50</div>
          </div>

          {/* Checkout Abandonment */}
          <div className="text-center p-2 md:p-3 rounded-lg bg-primary/10 border border-primary/20">
            <CreditCard className="w-4 h-4 md:w-5 md:h-5 mx-auto text-primary mb-1" />
            <div className="text-lg md:text-2xl font-bold text-primary">
              {mainValue}
            </div>
            <div className="text-[10px] md:text-xs text-muted-foreground">Checkout</div>
            <div className="text-[10px] text-primary">sempre</div>
          </div>
        </div>

        {/* Flow explanation - compact */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-muted-foreground border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-3 h-3 md:w-4 md:h-4" />
            </div>
            <div className="text-center md:text-left">
              <div className="font-medium text-foreground text-sm md:text-base">
                {(metrics?.extendedFunnel.productViewsTotal || 0) + 
                 (metrics?.extendedFunnel.cartEventsTotal || 0) + 
                 (metrics?.checkoutStarted || 0)}
              </div>
              <div className="text-[10px] md:text-xs">eventi</div>
            </div>
          </div>
          
          <ArrowRight className="w-4 h-4 hidden md:block" />
          <div className="text-xs md:hidden">↓</div>
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-primary" />
            </div>
            <div className="text-center md:text-left">
              <div className="font-medium text-primary text-sm md:text-base">{totalPotential}</div>
              <div className="text-[10px] md:text-xs">high intent</div>
            </div>
          </div>
          
          <ArrowRight className="w-4 h-4 hidden md:block" />
          <div className="text-xs md:hidden">↓</div>
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
            </div>
            <div className="text-center md:text-left">
              <div className="font-medium text-green-600 text-sm md:text-base">{syncedValue}</div>
              <div className="text-[10px] md:text-xs">in Klaviyo</div>
            </div>
          </div>
        </div>

        {/* Klaviyo properties info */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] md:text-xs text-center text-muted-foreground">
            Properties Klaviyo: 
            <code className="bg-muted px-1 py-0.5 rounded mx-1">sf_last_product_viewed_at</code>
            <code className="bg-muted px-1 py-0.5 rounded mx-1">sf_last_cart_at</code>
            <code className="bg-muted px-1 py-0.5 rounded">sf_checkout_abandoned_at</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
