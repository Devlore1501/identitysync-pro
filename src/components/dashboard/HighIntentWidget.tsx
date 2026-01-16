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
      <div className="metric-card flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const highIntentUsers = users || [];

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">High Intent Users</h3>
          <p className="text-sm text-muted-foreground">Ready for Klaviyo campaigns</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-2 rounded-lg bg-muted/30">
          <div className="text-xl font-bold text-orange-400">{highIntentUsers.length}</div>
          <div className="text-xs text-muted-foreground">Hot Leads</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/30">
          <div className="text-xl font-bold text-red-400">
            {highIntentUsers.filter(u => u.dropOffStage === 'checkout').length}
          </div>
          <div className="text-xs text-muted-foreground">Checkout Drop</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-muted/30">
          <div className="text-xl font-bold text-yellow-400">
            {highIntentUsers.filter(u => u.dropOffStage === 'cart').length}
          </div>
          <div className="text-xs text-muted-foreground">Cart Drop</div>
        </div>
      </div>

      {/* User list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Top Leads</h4>
          {highIntentUsers.length > 5 && (
            <span className="text-xs text-muted-foreground">
              Showing 5 of {highIntentUsers.length}
            </span>
          )}
        </div>
        
        {highIntentUsers.length > 0 ? (
          <div className="space-y-2">
            {highIntentUsers.slice(0, 5).map((user, index) => {
              const StageIcon = stageIcons[user.dropOffStage] || Eye;
              return (
                <div
                  key={user.id}
                  className="p-3 rounded-lg bg-muted/20 border border-border hover:bg-muted/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Intent Score Badge */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                            user.intentScore >= 70 
                              ? 'bg-red-500/20 text-red-400' 
                              : user.intentScore >= 50 
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            <span className="text-sm font-bold">{user.intentScore}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Intent Score: {user.intentScore}/100</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* User Info */}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {user.email ? maskEmail(user.email) : 'Anonymous User'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{user.eventsCount} events</span>
                          <span>•</span>
                          <span>{user.lastSeenAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Drop-off Stage Badge */}
                    <Badge 
                      variant="outline" 
                      className={`shrink-0 text-xs ${stageColors[user.dropOffStage]}`}
                    >
                      <StageIcon className="w-3 h-3 mr-1" />
                      {stageLabels[user.dropOffStage]}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No high intent users yet</p>
            <p className="text-xs mt-1">Users with intent score &gt; 30 who haven't purchased will appear here</p>
          </div>
        )}
      </div>

      {/* Action button */}
      {highIntentUsers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full justify-between text-sm" 
            onClick={handleExportToKlaviyo}
            disabled={isExporting}
          >
            <span className="flex items-center gap-2">
              {exportResult ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {exportResult.exported} esportati
                </>
              ) : isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Esportazione...
                </>
              ) : (
                "Export to Klaviyo"
              )}
            </span>
            {!isExporting && !exportResult && <ArrowRight className="w-4 h-4" />}
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
