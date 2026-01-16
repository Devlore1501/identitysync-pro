import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { HighIntentWidget } from "@/components/dashboard/HighIntentWidget";
import { FunnelWidget } from "@/components/dashboard/FunnelWidget";
import { BehavioralInsights } from "@/components/dashboard/BehavioralInsights";
import { SegmentsWidget } from "@/components/dashboard/SegmentsWidget";
import { SyncIntelligenceWidget } from "@/components/dashboard/SyncIntelligenceWidget";
import { SyncControl } from "@/components/dashboard/SyncControl";
import { 
  Target, 
  Users, 
  Mail, 
  Brain,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Zap,
  Loader2
} from "lucide-react";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { useDestinations } from "@/hooks/useDestinations";
import { useApiKeys } from "@/hooks/useApiKeys";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: health, isLoading, refetch } = useSystemHealth();
  const { destinations } = useDestinations();
  const { apiKeys } = useApiKeys();
  const [isRecomputing, setIsRecomputing] = useState(false);

  const hasApiKey = apiKeys.length > 0;
  const klaviyoConnected = destinations.some(d => d.type === 'klaviyo' && d.enabled);

  const handleRecomputeSignals = async () => {
    setIsRecomputing(true);
    try {
      const { data, error } = await supabase.functions.invoke('background-processor', {
        body: { limit: 100, force_recompute: true }
      });

      if (error) throw error;

      toast.success(`Segnali ricalcolati per ${data?.signalsRecomputed || 0} utenti`);
      refetch();
    } catch (err) {
      console.error('Recompute error:', err);
      toast.error('Errore nel ricalcolo dei segnali');
    } finally {
      setIsRecomputing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header - Behavior Intelligence */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold">Behavior Intelligence</h1>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Segnali comportamentali che rendono Klaviyo più intelligente
            </p>
            {/* Mobile-only last event badge */}
            {health?.lastEventAt && (
              <Badge variant="outline" className="text-xs mt-2 md:hidden">
                Ultimo: {formatDistanceToNow(new Date(health.lastEventAt), { addSuffix: true, locale: it })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop-only last event badge */}
            {health?.lastEventAt && (
              <Badge variant="outline" className="text-xs hidden md:inline-flex">
                Ultimo evento: {formatDistanceToNow(new Date(health.lastEventAt), { addSuffix: true, locale: it })}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''} md:mr-2`} />
              <span className="hidden md:inline">Aggiorna</span>
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleRecomputeSignals} 
              disabled={isRecomputing}
            >
              {isRecomputing ? (
                <Loader2 className="w-4 h-4 animate-spin md:mr-2" />
              ) : (
                <Brain className="w-4 h-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Ricalcola</span>
            </Button>
          </div>
        </div>

        {/* Core Behavioral Metrics - Responsive grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            title="Profili Totali"
            value={health?.totalUsers?.toLocaleString() || "0"}
            change={0}
            icon={<Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />}
          />
          <MetricCard
            title="Identificati"
            value={health?.usersWithEmail?.toLocaleString() || "0"}
            change={health?.emailCaptureRate || 0}
            icon={<Mail className="w-4 h-4 md:w-5 md:h-5 text-green-500" />}
          />
          <MetricCard
            title="Email Rate"
            value={`${health?.emailCaptureRate || 0}%`}
            change={0}
            icon={<Target className="w-4 h-4 md:w-5 md:h-5 text-accent" />}
          />
          <MetricCard
            title="Sync Pendenti"
            value={health?.pendingSyncs?.toString() || "0"}
            change={0}
            icon={<Zap className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />}
          />
        </div>

        {/* Behavioral Intelligence Section */}
        <BehavioralInsights />

        {/* Segments + High Intent Users */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <SegmentsWidget />
          <HighIntentWidget />
        </div>

        {/* Funnel + Sync Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <FunnelWidget />
          <SyncIntelligenceWidget />
        </div>

        {/* Sync Control */}
        <SyncControl />

        {/* Quick Setup - Collapsed */}
        <details className="metric-card">
          <summary className="cursor-pointer text-base md:text-lg font-semibold flex items-center gap-2">
            <span>Setup Checklist</span>
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
                  <p className="text-xs text-muted-foreground">Per catturare eventi dal browser</p>
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
                  <p className="text-xs text-muted-foreground">Per sincronizzare i segnali</p>
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
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;