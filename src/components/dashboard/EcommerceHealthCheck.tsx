import { useEcommerceHealth, EcommerceEventStatus } from "@/hooks/useEcommerceHealth";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ShoppingCart, Package, CreditCard, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface EventRowProps {
  icon: React.ReactNode;
  title: string;
  status: EcommerceEventStatus;
  description: string;
}

function EventRow({ icon, title, status, description }: EventRowProps) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      status.hasRecent 
        ? 'border-green-500/30 bg-green-500/5' 
        : 'border-destructive/30 bg-destructive/5'
    }`}>
      <div className={`p-2 rounded-lg ${
        status.hasRecent ? 'bg-green-500/20 text-green-600' : 'bg-destructive/20 text-destructive'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{title}</span>
          {status.hasRecent ? (
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">
              {status.count} eventi
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">Mancante</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {status.hasRecent && status.lastAt
            ? `Ultimo: ${formatDistanceToNow(new Date(status.lastAt), { addSuffix: true, locale: it })}`
            : description}
        </p>
      </div>
      {status.hasRecent ? (
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-destructive shrink-0" />
      )}
    </div>
  );
}

export function EcommerceHealthCheck() {
  const { data: health, isLoading, error } = useEcommerceHealth();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifica E-commerce Tracking...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Errore nella verifica
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const getOverallBadge = () => {
    switch (health.overall) {
      case 'healthy':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Tracking Attivo</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Parziale</Badge>;
      case 'critical':
        return <Badge variant="destructive">Non Funzionante</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">E-commerce Tracking</CardTitle>
          {getOverallBadge()}
        </div>
        {health.issues.length > 0 && health.overall !== 'healthy' && (
          <p className="text-sm text-muted-foreground mt-1">
            {health.issues.length} {health.issues.length === 1 ? 'problema rilevato' : 'problemi rilevati'}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <EventRow
          icon={<Package className="w-4 h-4" />}
          title="Product Viewed"
          status={health.productViews}
          description="Installa lo snippet JS nelle pagine prodotto"
        />
        <EventRow
          icon={<ShoppingCart className="w-4 h-4" />}
          title="Add to Cart"
          status={health.addToCart}
          description="Verifica lo snippet catturi gli eventi carrello"
        />
        <EventRow
          icon={<CreditCard className="w-4 h-4" />}
          title="Checkout"
          status={health.checkout}
          description="Lo snippet deve essere attivo nel checkout"
        />
        <EventRow
          icon={<Receipt className="w-4 h-4" />}
          title="Ordini"
          status={health.orders}
          description="Configura i Shopify webhooks per orders/create"
        />

        {health.overall === 'critical' && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Il tracking e-commerce non è configurato correttamente.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Verifica che lo snippet JavaScript sia installato nel tema Shopify e che i webhooks siano configurati.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
