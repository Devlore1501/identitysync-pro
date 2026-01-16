import { Flame, ShoppingCart, CreditCard, Eye, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { useHighIntentUsers } from "@/hooks/useHighIntentUsers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const stageIcons: Record<string, React.ElementType> = {
  checkout: CreditCard,
  cart: ShoppingCart,
  engaged: Eye,
  browsing: Eye,
};

const stageColors: Record<string, string> = {
  checkout: "bg-red-500/20 text-red-400 border-red-500/30",
  cart: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  engaged: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  browsing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const stageLabels: Record<string, string> = {
  checkout: "Checkout Abandoned",
  cart: "Cart Abandoned",
  engaged: "High Engagement",
  browsing: "Active Browser",
};

const stageLabelsShort: Record<string, string> = {
  checkout: "Checkout",
  cart: "Cart",
  engaged: "Engaged",
  browsing: "Browse",
};

export const HighIntentWidget = () => {
  const { data: users, isLoading } = useHighIntentUsers();
  const { currentWorkspace } = useWorkspace();
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ exported: number } | null>(null);

  const handleExportToKlaviyo = async () => {
    if (!currentWorkspace) {
      toast.error("Nessun workspace selezionato");
      return;
    }

    setIsExporting(true);
    setExportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('export-high-intent', {
        body: { 
          workspace_id: currentWorkspace.id,
          min_intent_score: 30,
          limit: 100 
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setExportResult({ exported: data.exported });
      toast.success(`${data.exported} profili esportati su Klaviyo`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error("Errore nell'export verso Klaviyo");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="metric-card flex items-center justify-center py-8 md:py-12">
        <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const highIntentUsers = users || [];

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg font-semibold">High Intent Users</h3>
          <p className="text-xs md:text-sm text-muted-foreground">Pronti per Klaviyo</p>
        </div>
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Flame className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6">
        <div className="text-center p-1.5 md:p-2 rounded-lg bg-muted/30">
          <div className="text-lg md:text-xl font-bold text-orange-400">{highIntentUsers.length}</div>
          <div className="text-xs text-muted-foreground">Tot</div>
        </div>
        <div className="text-center p-1.5 md:p-2 rounded-lg bg-muted/30">
          <div className="text-lg md:text-xl font-bold text-red-400">
            {highIntentUsers.filter(u => u.dropOffStage === 'checkout').length}
          </div>
          <div className="text-xs text-muted-foreground">Checkout</div>
        </div>
        <div className="text-center p-1.5 md:p-2 rounded-lg bg-muted/30">
          <div className="text-lg md:text-xl font-bold text-yellow-400">
            {highIntentUsers.filter(u => u.dropOffStage === 'cart').length}
          </div>
          <div className="text-xs text-muted-foreground">Cart</div>
        </div>
      </div>

      {/* User list - Compact */}
      {highIntentUsers.length > 0 ? (
        <div className="space-y-1.5 md:space-y-2">
          {highIntentUsers.slice(0, 5).map((user, index) => {
            const StageIcon = stageIcons[user.dropOffStage] || Eye;
            return (
              <div
                key={user.id}
                className="p-2 md:p-3 rounded-lg bg-muted/20 border border-border"
              >
                <div className="flex items-center justify-between gap-2 md:gap-3">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full shrink-0 ${
                          user.intentScore >= 70 
                            ? 'bg-red-500/20 text-red-400' 
                            : user.intentScore >= 50 
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          <span className="text-xs md:text-sm font-bold">{user.intentScore}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Intent Score: {user.intentScore}/100</p>
                      </TooltipContent>
                    </Tooltip>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs md:text-sm font-medium truncate">
                        {user.email ? maskEmail(user.email) : 'Anonymous'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.eventsCount} eventi
                      </div>
                    </div>
                  </div>

                  <Badge 
                    variant="outline" 
                    className={`shrink-0 text-xs px-1.5 md:px-2 ${stageColors[user.dropOffStage]}`}
                  >
                    <StageIcon className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                    <span className="hidden sm:inline">{stageLabels[user.dropOffStage]}</span>
                    <span className="sm:hidden">{stageLabelsShort[user.dropOffStage]}</span>
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 md:py-8 text-muted-foreground">
          <Flame className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs md:text-sm">Nessun utente ad alto intento</p>
          <p className="text-xs mt-1">Appariranno con più dati</p>
        </div>
      )}

      {/* Export button - Only if there are users */}
      {highIntentUsers.length > 0 && (
        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-border">
          <Button 
            variant="outline" 
            className="w-full justify-between text-xs md:text-sm" 
            onClick={handleExportToKlaviyo}
            disabled={isExporting}
          >
            <span className="flex items-center gap-1.5 md:gap-2">
              {exportResult ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />
                  {exportResult.exported} esportati
                </>
              ) : isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                  <span>Esportazione...</span>
                </>
              ) : (
                <span>Export su Klaviyo</span>
              )}
            </span>
            {!isExporting && !exportResult && <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local && domain) {
    const maskedLocal = local.length > 3 ? local.slice(0, 3) + '***' : local + '***';
    return `${maskedLocal}@${domain}`;
  }
  return email.slice(0, 5) + '***';
}
