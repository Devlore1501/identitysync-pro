import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EventsChart } from "@/components/dashboard/EventsChart";
import { RecentEvents } from "@/components/dashboard/RecentEvents";
import { IdentityGraph } from "@/components/dashboard/IdentityGraph";
import { FunnelWidget } from "@/components/dashboard/FunnelWidget";
import { BehavioralInsights } from "@/components/dashboard/BehavioralInsights";
import { SyncControl } from "@/components/dashboard/SyncControl";
import { Activity, Users, Send, Clock, CheckCircle, AlertCircle, Code, Mail, MailX, RefreshCw } from "lucide-react";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { useDestinations } from "@/hooks/useDestinations";
import { useApiKeys } from "@/hooks/useApiKeys";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: health, isLoading, refetch } = useSystemHealth();
  const { destinations } = useDestinations();
  const { apiKeys } = useApiKeys();

  const hasApiKey = apiKeys.length > 0;
  const klaviyoConnected = destinations.some(d => d.type === 'klaviyo' && d.enabled);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {health?.lastEventAt && (
              <p className="text-sm text-muted-foreground">
                Ultimo evento: {formatDistanceToNow(new Date(health.lastEventAt), { addSuffix: true, locale: it })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Eventi Oggi"
            value={health?.eventsToday?.toLocaleString() || "0"}
            change={health?.eventsThisWeek ? Math.round((health.eventsToday / health.eventsThisWeek) * 100) : 0}
            icon={<Activity className="w-5 h-5 text-primary" />}
          />
          <MetricCard
            title="Profili Totali"
            value={health?.totalUsers?.toLocaleString() || "0"}
            change={0}
            icon={<Users className="w-5 h-5 text-accent" />}
          />
          <MetricCard
            title="Con Email"
            value={health?.usersWithEmail?.toLocaleString() || "0"}
            change={health?.emailCaptureRate || 0}
            icon={<Mail className="w-5 h-5 text-green-500" />}
          />
          <MetricCard
            title="Sync Pendenti"
            value={health?.pendingSyncs?.toString() || "0"}
            change={0}
            icon={<Clock className="w-5 h-5 text-blue-500" />}
          />
        </div>

        {/* Email Capture Rate Alert */}
        {health && health.totalUsers > 0 && health.emailCaptureRate < 50 && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <MailX className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-700">Basso tasso di acquisizione email</h3>
                <p className="text-sm text-yellow-600 mt-1">
                  Solo {health.emailCaptureRate}% dei tuoi utenti ha un'email. 
                  {health.usersWithoutEmail} profili non possono essere sincronizzati con Klaviyo.
                </p>
                <div className="mt-3">
                  <Progress value={health.emailCaptureRate} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{health.usersWithEmail} con email</span>
                    <span>{health.usersWithoutEmail} senza email</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sync Status Summary */}
        {health && (health.completedSyncs > 0 || health.failedSyncs > 0 || health.skippedSyncs > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Completati</span>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-1">{health.completedSyncs}</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium">Pendenti</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{health.pendingSyncs}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
              <div className="flex items-center gap-2">
                <MailX className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">Skippati (no email)</span>
              </div>
              <p className="text-2xl font-bold text-gray-600 mt-1">{health.skippedSyncs}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium">Falliti</span>
              </div>
              <p className="text-2xl font-bold text-red-600 mt-1">{health.failedSyncs}</p>
            </div>
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EventsChart />
          <RecentEvents />
        </div>

        {/* Funnel & Identity section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FunnelWidget />
          <IdentityGraph />
        </div>

        {/* Behavioral Intelligence + Sync Control */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BehavioralInsights />
          </div>
          <SyncControl />
        </div>

        {/* Setup checklist */}
        <div className="metric-card">
          <h3 className="text-lg font-semibold mb-4">Setup Checklist</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {hasApiKey ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="font-medium">Crea API Key</span>
                </div>
                {hasApiKey ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">Fatto</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/settings')}>
                    Crea
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Genera un'API key per autenticare il tracking degli eventi.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {health && health.eventsToday > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Code className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">Installa JS Snippet</span>
                </div>
                {health && health.eventsToday > 0 ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">Attivo</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/settings')}>
                    Installa
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Aggiungi lo snippet di tracking per catturare eventi dal browser.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {klaviyoConnected ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="font-medium">Connetti Klaviyo</span>
                </div>
                {klaviyoConnected ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">Connesso</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/destinations')}>
                    Connetti
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Sincronizza profili ed eventi con il tuo account Klaviyo.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {health && health.emailCaptureRate >= 20 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="font-medium">Acquisisci Email</span>
                </div>
                {health && health.emailCaptureRate >= 20 ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">{health.emailCaptureRate}%</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-600">{health?.emailCaptureRate || 0}%</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Usa newsletter, checkout o login per collegare email ai profili anonimi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
