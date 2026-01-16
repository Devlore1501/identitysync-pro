import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CreditCard, 
  Zap, 
  TrendingUp, 
  ArrowUpRight,
  Calendar,
  Download
} from "lucide-react";
import { Link } from "react-router-dom";
import { useBillingUsage, useBillingHistory } from "@/hooks/useBillingUsage";
import { useAccount } from "@/hooks/useAccount";
import { PLANS, getPlanById, formatEventCount, OVERAGE_PRICE } from "@/lib/plans";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export function BillingSection() {
  const { data: currentUsage, isLoading } = useBillingUsage();
  const { data: billingHistory } = useBillingHistory();
  const { data: account } = useAccount();
  
  const accountPlan = account?.plan || "pro";
  const plan = getPlanById(accountPlan) || PLANS[0];
  const eventsUsed = currentUsage?.events_count || 0;
  const eventsLimit = plan.events;
  const usagePercent = Math.min((eventsUsed / eventsLimit) * 100, 100);
  const isNearLimit = usagePercent >= 80;
  const isOverLimit = eventsUsed > eventsLimit;
  const overageEvents = Math.max(0, eventsUsed - eventsLimit);
  const overageCost = Math.ceil(overageEvents / 100000) * OVERAGE_PRICE;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Piano {plan.name}
                <Badge variant={plan.popular ? "default" : "secondary"}>
                  Attivo
                </Badge>
              </CardTitle>
              <CardDescription>
                €{plan.price}{plan.period} • {plan.eventsLabel}
              </CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link to="/pricing">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Cambia Piano
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Utilizzo Eventi</span>
              <span className={`text-sm ${isOverLimit ? "text-destructive" : isNearLimit ? "text-orange-500" : "text-muted-foreground"}`}>
                {formatEventCount(eventsUsed)} / {formatEventCount(eventsLimit)}
              </span>
            </div>
            <Progress 
              value={usagePercent} 
              className={`h-2 ${isOverLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-orange-500" : ""}`}
            />
            {isNearLimit && !isOverLimit && (
              <p className="text-xs text-orange-500 mt-1">
                Stai per raggiungere il limite del tuo piano
              </p>
            )}
            {isOverLimit && (
              <p className="text-xs text-destructive mt-1">
                Hai superato il limite di {formatEventCount(overageEvents)} eventi (€{overageCost} overage)
              </p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div>
              <div className="text-2xl font-bold">{formatEventCount(eventsUsed)}</div>
              <div className="text-xs text-muted-foreground">Eventi questo mese</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{currentUsage?.profiles_count || 0}</div>
              <div className="text-xs text-muted-foreground">Profili attivi</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{currentUsage?.syncs_count || 0}</div>
              <div className="text-xs text-muted-foreground">Sync effettuati</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Estimate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Prossima Fattura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted-foreground">Piano {plan.name}</span>
            <span>€{plan.price}</span>
          </div>
          {overageCost > 0 && (
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="text-muted-foreground">
                Overage ({formatEventCount(overageEvents)} eventi extra)
              </span>
              <span className="text-destructive">€{overageCost}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-3 font-bold">
            <span>Totale stimato</span>
            <span>€{plan.price + overageCost}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Addebito previsto: {format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), "d MMMM yyyy", { locale: it })}
          </p>
        </CardContent>
      </Card>

      {/* Billing History */}
      {billingHistory && billingHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Storico Fatturazione
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {billingHistory.slice(0, 6).map((record) => (
                <div 
                  key={record.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <div className="font-medium">
                      {format(new Date(record.period_start), "MMMM yyyy", { locale: it })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatEventCount(record.events_count)} eventi
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Method (Mock) */}
      <Card>
        <CardHeader>
          <CardTitle>Metodo di Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-8 rounded bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                VISA
              </div>
              <div>
                <div className="font-medium">•••• •••• •••• 4242</div>
                <div className="text-xs text-muted-foreground">Scade 12/25</div>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Modifica
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
