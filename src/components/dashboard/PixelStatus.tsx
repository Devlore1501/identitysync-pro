import { usePixelStatus } from "@/hooks/useFunnelStats";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Code, Webhook } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

export function PixelStatus() {
  const { data: status, isLoading } = usePixelStatus();

  if (isLoading) {
    return null;
  }

  const jsActive = status?.jsPixel?.lastEvent != null;
  const webhooksActive = status?.webhooks?.lastEvent != null;

  return (
    <div className="space-y-4">
      <h4 className="font-medium flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Stato Installazione
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* JS Pixel Status */}
        <div className={`p-4 rounded-lg border ${jsActive ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4" />
            <span className="font-medium">JS Pixel</span>
            {jsActive ? (
              <Badge variant="default" className="ml-auto bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Attivo
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto">
                <XCircle className="w-3 h-3 mr-1" />
                Non rilevato
              </Badge>
            )}
          </div>
          
          {jsActive && status?.jsPixel?.lastEvent ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Ultimo evento: <span className="font-mono text-xs">{status.jsPixel.lastEvent.event_name}</span>
              </div>
              <div>
                {formatDistanceToNow(new Date(status.jsPixel.lastEvent.event_time), { addSuffix: true, locale: it })}
              </div>
              <div className="text-xs">
                {status.jsPixel.countLast24h} eventi nelle ultime 24h
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Installa lo snippet JS per iniziare a tracciare eventi dal browser
            </p>
          )}
        </div>

        {/* Webhooks Status */}
        <div className={`p-4 rounded-lg border ${webhooksActive ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Webhook className="w-4 h-4" />
            <span className="font-medium">Shopify Webhooks</span>
            {webhooksActive ? (
              <Badge variant="default" className="ml-auto bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Attivo
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto">
                <XCircle className="w-3 h-3 mr-1" />
                Non rilevato
              </Badge>
            )}
          </div>
          
          {webhooksActive && status?.webhooks?.lastEvent ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Ultimo evento: <span className="font-mono text-xs">{status.webhooks.lastEvent.event_name}</span>
              </div>
              <div>
                {formatDistanceToNow(new Date(status.webhooks.lastEvent.event_time), { addSuffix: true, locale: it })}
              </div>
              <div className="text-xs">
                {status.webhooks.countLast24h} eventi nelle ultime 24h
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Configura i webhooks Shopify per ricevere ordini e checkout
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
