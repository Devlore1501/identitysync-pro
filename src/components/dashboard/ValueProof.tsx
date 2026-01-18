import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  ShoppingCart, 
  Mail, 
  Target, 
  ArrowRight,
  Calculator,
  Info
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ValueMetrics {
  shopifyCheckouts: number; // A - Manual input
  klaviyoStartedCheckout: number; // B - From events or estimate
  identitySyncDetected: number; // C - From users_unified with checkout_abandoned_at
  recoveredGap: number; // C - B
  coverageVsShopify: number; // C / A * 100
  cartAbandoned: number;
  browseHighIntent: number;
}

export function ValueProof() {
  const { currentWorkspace } = useWorkspace();
  const [dateRange, setDateRange] = useState<'7' | '14' | '30'>('7');
  const [shopifyInput, setShopifyInput] = useState<string>('');
  const [manualShopify, setManualShopify] = useState<number | null>(null);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['value-proof', currentWorkspace?.id, dateRange],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));

      // Get checkout_abandoned users (C)
      const { count: checkoutAbandoned } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .not('computed->checkout_abandoned_at', 'is', null)
        .gte('updated_at', daysAgo.toISOString());

      // Get cart_abandoned users
      const { count: cartAbandoned } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .not('computed->cart_abandoned_at', 'is', null)
        .gte('updated_at', daysAgo.toISOString());

      // Get browse high intent users (intent >= 30, no cart)
      const { data: browseUsers } = await supabase
        .from('users_unified')
        .select('computed')
        .eq('workspace_id', currentWorkspace.id)
        .gte('updated_at', daysAgo.toISOString())
        .limit(1000);

      const browseHighIntent = browseUsers?.filter(u => {
        const computed = u.computed as Record<string, unknown>;
        const intent = Number(computed?.intent_score || 0);
        const stage = computed?.drop_off_stage;
        return intent >= 30 && (stage === 'engaged' || stage === 'browsing');
      }).length || 0;

      // Estimate Klaviyo Started Checkout from events (B)
      const { count: klaviyoEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .in('event_name', ['Started Checkout', 'Checkout Started', 'Begin Checkout'])
        .gte('event_time', daysAgo.toISOString());

      const c = checkoutAbandoned || 0;
      const b = klaviyoEvents || 0;
      const a = manualShopify || 0;

      return {
        shopifyCheckouts: a,
        klaviyoStartedCheckout: b,
        identitySyncDetected: c,
        recoveredGap: Math.max(0, c - b),
        coverageVsShopify: a > 0 ? Math.round((c / a) * 100) : 0,
        cartAbandoned: cartAbandoned || 0,
        browseHighIntent,
      } as ValueMetrics;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });

  const handleSetShopify = () => {
    const val = parseInt(shopifyInput);
    if (!isNaN(val) && val >= 0) {
      setManualShopify(val);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Value Proof
            </CardTitle>
            <CardDescription>
              Confronto A/B/C: Shopify vs Klaviyo vs IdentitySync
            </CardDescription>
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as '7' | '14' | '30')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 giorni</SelectItem>
              <SelectItem value="14">14 giorni</SelectItem>
              <SelectItem value="30">30 giorni</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* A/B/C Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* A - Shopify */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">A - Shopify Checkouts</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Checkout totali da Shopify (inserimento manuale)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {manualShopify !== null ? (
              <div className="text-3xl font-bold text-green-500">{manualShopify}</div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Es: 150"
                  value={shopifyInput}
                  onChange={(e) => setShopifyInput(e.target.value)}
                  className="w-24 h-8"
                />
                <Button size="sm" variant="outline" onClick={handleSetShopify}>
                  <Calculator className="w-3 h-3 mr-1" />
                  Set
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {manualShopify !== null ? 'Da Shopify Analytics' : 'Inserisci da Shopify'}
            </p>
          </div>

          {/* B - Klaviyo */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">B - Klaviyo Started</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Eventi Started Checkout in Klaviyo (stima da eventi)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-3xl font-bold text-purple-500">
              {metrics?.klaviyoStartedCheckout || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Profili unici con checkout</p>
          </div>

          {/* C - IdentitySync */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">C - IdentitySync</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Utenti con checkout_abandoned rilevato da IdentitySync</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-3xl font-bold text-primary">
              {metrics?.identitySyncDetected || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Checkout abandoned detected</p>
          </div>
        </div>

        {/* Recovered Gap */}
        <div className="flex items-center justify-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Recovered Gap (C - B)</div>
            <div className="text-4xl font-bold text-green-500">
              +{metrics?.recoveredGap || 0}
            </div>
            <p className="text-xs text-green-600 mt-1">
              Utenti recuperati che Klaviyo non vedeva
            </p>
          </div>
          
          {manualShopify !== null && manualShopify > 0 && (
            <>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Coverage vs Shopify</div>
                <div className="text-4xl font-bold text-primary">
                  {metrics?.coverageVsShopify || 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Copertura checkout
                </p>
              </div>
            </>
          )}
        </div>

        {/* Extended Funnel Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">Cart Abandoned</span>
            </div>
            <div className="text-2xl font-bold">{metrics?.cartAbandoned || 0}</div>
            <p className="text-xs text-muted-foreground">Utenti con carrello abbandonato</p>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Browse High Intent</span>
            </div>
            <div className="text-2xl font-bold">{metrics?.browseHighIntent || 0}</div>
            <p className="text-xs text-muted-foreground">Intent ≥30, no cart</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
