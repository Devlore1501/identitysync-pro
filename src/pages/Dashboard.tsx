import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ValueMetricHero } from "@/components/dashboard/ValueMetricHero";
import { ValueProof } from "@/components/dashboard/ValueProof";
import { SegmentsWidget } from "@/components/dashboard/SegmentsWidget";
import { SyncStatusCompact } from "@/components/dashboard/SyncStatusCompact";
import { SyncHealth } from "@/components/dashboard/SyncHealth";
import { DuplicatePrevention } from "@/components/dashboard/DuplicatePrevention";
import { KlaviyoFlowGuide } from "@/components/dashboard/KlaviyoFlowGuide";
import { PredictiveRegistry } from "@/components/dashboard/PredictiveRegistry";
import { IdentityStitchingStatus } from "@/components/dashboard/IdentityStitchingStatus";
import { 
  Brain,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { useDestinations } from "@/hooks/useDestinations";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Building2 } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { data: health, isLoading, refetch } = useSystemHealth();
  const { destinations } = useDestinations();
  const { apiKeys } = useApiKeys();

  const hasApiKey = apiKeys.length > 0;
  const klaviyoConnected = destinations.some(d => d.type === 'klaviyo' && d.enabled);

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header - Minimal */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold">IdentitySync</h1>
              {currentWorkspace && (
                <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                  <Building2 className="w-3 h-3 mr-1" />
                  {currentWorkspace.name}
                </Badge>
              )}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Behavior & Identity Layer per Klaviyo
            </p>
          </div>
          <div className="flex items-center gap-2">
            {health?.lastEventAt && (
              <Badge variant="outline" className="text-xs">
                Ultimo: {formatDistanceToNow(new Date(health.lastEventAt), { addSuffix: true, locale: it })}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || workspaceLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading || workspaceLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* VALUE PROOF - A/B/C Comparison */}
        <ValueProof />

        {/* MAIN VALUE METRIC - Extended Funnel */}
        <ValueMetricHero />

        {/* Sync Health + Duplicate Prevention */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <SyncHealth />
          <DuplicatePrevention />
        </div>

        {/* Identity Stitching + Predictive Registry */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <IdentityStitchingStatus />
          <PredictiveRegistry />
        </div>

        {/* Klaviyo Flow Guide */}
        <KlaviyoFlowGuide />

        {/* Segments */}
        <SegmentsWidget />

        {/* Sync Status - Compact version */}
        <SyncStatusCompact />

        {/* Setup Checklist - Only show if incomplete */}
        {(!hasApiKey || !klaviyoConnected || !(health && health.eventsToday > 0)) && (
          <details className="metric-card">
            <summary className="cursor-pointer text-base md:text-lg font-semibold flex items-center gap-2">
              <span>Setup</span>
              <Badge variant="secondary" className="text-xs">
                {[hasApiKey, klaviyoConnected, health?.eventsToday > 0].filter(Boolean).length}/3
              </Badge>
            </summary>
            <div className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  {hasApiKey ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium text-sm">API Key</span>
                    <p className="text-xs text-muted-foreground">Per autenticare il tracking</p>
                  </div>
                </div>
                {!hasApiKey && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/settings')} className="self-end sm:self-auto">
                    Crea
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  {health && health.eventsToday > 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium text-sm">JS Snippet</span>
                    <p className="text-xs text-muted-foreground">Per catturare eventi</p>
                  </div>
                </div>
                {!(health && health.eventsToday > 0) && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/settings')} className="self-end sm:self-auto">
                    Installa
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  {klaviyoConnected ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium text-sm">Klaviyo</span>
                    <p className="text-xs text-muted-foreground">Per sincronizzare segnali</p>
                  </div>
                </div>
                {!klaviyoConnected && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/destinations')} className="self-end sm:self-auto">
                    Connetti
                  </Button>
                )}
              </div>
            </div>
          </details>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
