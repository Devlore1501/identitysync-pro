import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Loader2, Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KlaviyoSyncSectionProps {
  workspaceId?: string;
}

export function KlaviyoSyncSection({ workspaceId }: KlaviyoSyncSectionProps) {
  const [polling, setPolling] = useState(false);
  const [lastPollResult, setLastPollResult] = useState<{
    eventsImported: number;
    usersUpdated: number;
    usersCreated: number;
  } | null>(null);

  const handlePollNow = async () => {
    if (!workspaceId) {
      toast.error("Workspace non trovato");
      return;
    }

    setPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("poll-klaviyo-events", {
        body: {
          workspace_id: workspaceId,
          lookback_minutes: 60, // Poll last hour
        },
      });

      if (error) throw error;

      setLastPollResult({
        eventsImported: data.eventsImported || 0,
        usersUpdated: data.usersUpdated || 0,
        usersCreated: data.usersCreated || 0,
      });

      if (data.eventsImported > 0) {
        toast.success(`Importati ${data.eventsImported} eventi da Klaviyo`);
      } else {
        toast.info("Nessun nuovo evento trovato");
      }
    } catch (err) {
      toast.error(`Errore polling: ${err instanceof Error ? err.message : "Errore sconosciuto"}`);
    } finally {
      setPolling(false);
    }
  };

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5" />
        Klaviyo Sync Bidirezionale
      </h2>
      <div className="metric-card space-y-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <p className="text-sm font-medium text-primary mb-2">🔄 Sincronizzazione Automatica via API</p>
          <p className="text-xs text-muted-foreground">
            Il sistema recupera automaticamente gli eventi email (opens, clicks, subscriptions) da Klaviyo tramite API.
            I profili vengono arricchiti con email engagement score e ri-sincronizzati automaticamente.
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-medium">Polling Manuale</div>
              <div className="text-sm text-muted-foreground">
                Recupera gli eventi dell'ultima ora da Klaviyo
              </div>
            </div>
            <Button onClick={handlePollNow} disabled={polling} variant="outline">
              {polling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {polling ? "Polling..." : "Poll Now"}
            </Button>
          </div>

          {lastPollResult && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
              <Check className="w-4 h-4 text-green-500" />
              <div className="text-sm">
                <span className="font-medium">{lastPollResult.eventsImported}</span> eventi importati,{" "}
                <span className="font-medium">{lastPollResult.usersUpdated}</span> utenti aggiornati,{" "}
                <span className="font-medium">{lastPollResult.usersCreated}</span> nuovi utenti
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <div className="font-medium mb-2">Eventi Importati da Klaviyo</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { event: "Opened Email", score: "+3 intent" },
              { event: "Clicked Email", score: "+5 intent" },
              { event: "Subscribed to List", score: "+2 intent" },
              { event: "Clicked SMS", score: "+4 intent" },
            ].map((item) => (
              <div
                key={item.event}
                className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
              >
                <span>{item.event}</span>
                <Badge variant="secondary" className="text-xs">
                  {item.score}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="font-medium mb-2">Proprietà Sincronizzate</div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              • <code className="text-xs">sf_email_opens_30d</code> - Aperture email ultimi 30gg
            </p>
            <p>
              • <code className="text-xs">sf_email_clicks_30d</code> - Click email ultimi 30gg
            </p>
            <p>
              • <code className="text-xs">sf_email_engagement_score</code> - Score engagement email (0-100)
            </p>
            <p>
              • <code className="text-xs">sf_is_subscribed</code> - Stato iscrizione
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Polling Automatico</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Per abilitare il polling automatico, configura un cron job esterno (es.{" "}
              <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="underline">
                cron-job.org
              </a>
              ) che chiama l'endpoint ogni 5-15 minuti:
            </p>
            <code className="block text-xs bg-background p-2 mt-2 rounded font-mono break-all">
              POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/poll-klaviyo-events
            </code>
          </div>
        </div>
      </div>
    </section>
  );
}
