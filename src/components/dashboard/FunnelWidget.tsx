import { useFunnelStats } from "@/hooks/useFunnelStats";
import { TrendingDown, TrendingUp, Users, Eye, ShoppingCart, CreditCard, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const stepIcons: Record<string, React.ReactNode> = {
  'Visitatori': <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'Collezioni': <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'Prodotti': <Package className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'Carrello': <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'Checkout': <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4" />,
  'Acquisti': <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />,
};

export function FunnelWidget() {
  const { data: funnelStats, isLoading } = useFunnelStats(7);

  if (isLoading) {
    return (
      <div className="metric-card">
        <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Funnel Conversione</h3>
        <div className="space-y-2 md:space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 md:h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...(funnelStats?.steps.map(s => s.count) || [1]), 1);

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-semibold">Funnel Conversione</h3>
        <span className="text-xs text-muted-foreground">{funnelStats?.period}</span>
      </div>

      <div className="space-y-1.5 md:space-y-2">
        {funnelStats?.steps.map((step, index) => {
          const widthPercent = (step.count / maxCount) * 100;
          const isLast = index === (funnelStats?.steps.length || 0) - 1;

          return (
            <div key={step.name} className="relative">
              <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg bg-muted/30 relative overflow-hidden">
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                  style={{ width: `${widthPercent}%` }}
                />
                
                {/* Content */}
                <div className="relative flex items-center gap-2 md:gap-3 flex-1 z-10">
                  <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full bg-primary/20 text-primary flex-shrink-0">
                    {stepIcons[step.name] || <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs md:text-sm truncate">{step.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {step.count.toLocaleString()} <span className="hidden sm:inline">eventi</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {index > 0 && (
                      <div className={`text-xs md:text-sm font-medium flex items-center gap-0.5 md:gap-1 ${
                        step.conversionRate >= 50 ? 'text-green-600' : 
                        step.conversionRate >= 20 ? 'text-yellow-600' : 'text-red-500'
                      }`}>
                        {step.conversionRate}%
                        {step.dropOff > 0 && (
                          <span className="text-xs text-muted-foreground hidden sm:flex items-center">
                            <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5" />
                            -{step.dropOff}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex justify-center py-0.5 md:py-1">
                  <div className="w-0.5 h-1.5 md:h-2 bg-border" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall conversion */}
      <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs md:text-sm text-muted-foreground">Conversione Totale</span>
          <span className="text-base md:text-lg font-bold text-primary">
            {funnelStats?.overallConversion}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 md:mt-1">
          Da visita a acquisto
        </p>
      </div>
    </div>
  );
}