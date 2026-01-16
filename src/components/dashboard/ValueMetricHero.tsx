import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ValueMetrics {
  checkoutStarted: number;
  profilesWithCheckoutAbandoned: number;
  recoveredEstimate: number;
  highIntentProfiles: number;
  profilesSynced: number;
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
          body: { workspace_id: currentWorkspace.id }
        });

        if (error) throw error;

        setMetrics({
          checkoutStarted: data.checkout_started || 0,
          profilesWithCheckoutAbandoned: data.profiles_with_checkout_abandoned || 0,
          recoveredEstimate: data.recovered_users_estimate || 0,
          highIntentProfiles: data.high_intent_profiles || 0,
          profilesSynced: data.profiles_synced_to_klaviyo || 0,
        });
      } catch (err) {
        console.error('Value metrics error:', err);
        setMetrics({
          checkoutStarted: 0,
          profilesWithCheckoutAbandoned: 0,
          recoveredEstimate: 0,
          highIntentProfiles: 0,
          profilesSynced: 0,
        });
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
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const mainValue = metrics?.profilesWithCheckoutAbandoned || 0;
  const syncedValue = metrics?.profilesSynced || 0;

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      <CardContent className="p-4 md:p-6">
        {/* Main value metric */}
        <div className="text-center mb-4 md:mb-6">
          <p className="text-sm text-muted-foreground mb-2">
            Utenti recuperati per Klaviyo
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="text-4xl md:text-6xl font-bold text-primary animate-number">
              {mainValue}
            </div>
            {syncedValue > 0 && (
              <div className="flex items-center gap-1 text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">{syncedValue} sync</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            con <code className="bg-muted px-1 py-0.5 rounded text-xs">sf_checkout_abandoned_at</code> settata
          </p>
        </div>

        {/* Flow explanation */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-center md:text-left">
              <div className="font-medium text-foreground">{metrics?.checkoutStarted || 0}</div>
              <div className="text-xs">checkout</div>
            </div>
          </div>
          
          <ArrowRight className="w-4 h-4 hidden md:block" />
          <div className="text-xs md:hidden">↓</div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="text-center md:text-left">
              <div className="font-medium text-primary">{mainValue}</div>
              <div className="text-xs">identificati</div>
            </div>
          </div>
          
          <ArrowRight className="w-4 h-4 hidden md:block" />
          <div className="text-xs md:hidden">↓</div>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-center md:text-left">
              <div className="font-medium text-green-600">{syncedValue}</div>
              <div className="text-xs">in Klaviyo</div>
            </div>
          </div>
        </div>

        {/* Value proposition */}
        {mainValue > 0 && (
          <div className="mt-4 md:mt-6 pt-4 border-t border-border text-center">
            <p className="text-sm">
              <span className="font-medium text-primary">{mainValue} utenti</span>
              {" "}possono entrare nei flow Klaviyo grazie a IdentitySync
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
