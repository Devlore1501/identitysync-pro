import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EventsChart } from "@/components/dashboard/EventsChart";
import { RecentEvents } from "@/components/dashboard/RecentEvents";
import { IdentityGraph } from "@/components/dashboard/IdentityGraph";
import { Activity, Users, Send, Clock } from "lucide-react";

const Dashboard = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Metrics row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Events Today"
            value="24,847"
            change={12.5}
            icon={<Activity className="w-5 h-5 text-primary" />}
          />
          <MetricCard
            title="Profiles Resolved"
            value="1,247"
            change={8.2}
            icon={<Users className="w-5 h-5 text-accent" />}
          />
          <MetricCard
            title="Sync Success"
            value="99.2%"
            change={0.3}
            icon={<Send className="w-5 h-5 text-success" />}
          />
          <MetricCard
            title="Avg. Latency"
            value="42ms"
            change={-5.1}
            icon={<Clock className="w-5 h-5 text-info" />}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EventsChart />
          <RecentEvents />
        </div>

        {/* Identity section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IdentityGraph />
          
          {/* Quick actions */}
          <div className="metric-card">
            <h3 className="text-lg font-semibold mb-4">Quick Setup</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Install JS Snippet</span>
                  <span className="status-warning">Pending</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add our tracking snippet to start capturing browser events.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Configure Shopify Webhooks</span>
                  <span className="status-warning">Pending</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your Shopify store for server-side events.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Connect Klaviyo</span>
                  <span className="status-success">Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sync profiles and events to your Klaviyo account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
