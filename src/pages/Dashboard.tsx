import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EventsChart } from "@/components/dashboard/EventsChart";
import { RecentEvents } from "@/components/dashboard/RecentEvents";
import { IdentityGraph } from "@/components/dashboard/IdentityGraph";
import { FunnelWidget } from "@/components/dashboard/FunnelWidget";
import { BehavioralInsights } from "@/components/dashboard/BehavioralInsights";
import { Activity, Users, Send, Clock, CheckCircle, AlertCircle, Code } from "lucide-react";
import { useEventsCount } from "@/hooks/useEvents";
import { useIdentitiesCount } from "@/hooks/useIdentities";
import { useSyncStats, useDestinations } from "@/hooks/useDestinations";
import { useApiKeys } from "@/hooks/useApiKeys";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: eventsCount } = useEventsCount();
  const { data: identitiesCount } = useIdentitiesCount();
  const { data: syncStats } = useSyncStats();
  const { destinations } = useDestinations();
  const { apiKeys } = useApiKeys();

  const hasApiKey = apiKeys.length > 0;
  const hasDestination = destinations.length > 0;
  const klaviyoConnected = destinations.some(d => d.type === 'klaviyo' && d.enabled);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Metrics row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Events Today"
            value={eventsCount?.today?.toLocaleString() || "0"}
            change={eventsCount?.today && eventsCount?.today > 0 ? 12.5 : 0}
            icon={<Activity className="w-5 h-5 text-primary" />}
          />
          <MetricCard
            title="Profiles Resolved"
            value={identitiesCount?.toLocaleString() || "0"}
            change={identitiesCount && identitiesCount > 0 ? 8.2 : 0}
            icon={<Users className="w-5 h-5 text-accent" />}
          />
          <MetricCard
            title="Sync Success"
            value={`${syncStats?.successRate || 100}%`}
            change={0.3}
            icon={<Send className="w-5 h-5 text-green-500" />}
          />
          <MetricCard
            title="Pending Syncs"
            value={syncStats?.pending?.toString() || "0"}
            change={0}
            icon={<Clock className="w-5 h-5 text-blue-500" />}
          />
        </div>

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

        {/* Behavioral Intelligence */}
        <BehavioralInsights />

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
                  <span className="font-medium">Create API Key</span>
                </div>
                {hasApiKey ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">Done</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/settings')}>
                    Create
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Generate an API key to authenticate event tracking.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Install JS Snippet</span>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-600">Pending</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Add our tracking snippet to start capturing browser events.
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
                  <span className="font-medium">Connect Klaviyo</span>
                </div>
                {klaviyoConnected ? (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">Connected</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/destinations')}>
                    Connect
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Sync profiles and events to your Klaviyo account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
