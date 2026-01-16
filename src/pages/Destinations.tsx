import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Plus, Settings, ExternalLink, Check, AlertCircle } from "lucide-react";

const destinations = [
  {
    id: "dest_klaviyo",
    name: "Klaviyo",
    type: "ESP",
    status: "connected",
    lastSync: "2 min ago",
    eventsToday: 24847,
    profilesToday: 1247,
    logo: "K",
    config: {
      listId: "ABC123",
      apiKey: "pk_***...xyz",
    },
  },
  {
    id: "dest_meta",
    name: "Meta CAPI",
    type: "Ads",
    status: "available",
    lastSync: null,
    eventsToday: 0,
    profilesToday: 0,
    logo: "M",
    config: null,
  },
  {
    id: "dest_ga4",
    name: "Google Analytics 4",
    type: "Analytics",
    status: "available",
    lastSync: null,
    eventsToday: 0,
    profilesToday: 0,
    logo: "G",
    config: null,
  },
  {
    id: "dest_bigquery",
    name: "BigQuery",
    type: "Data Warehouse",
    status: "available",
    lastSync: null,
    eventsToday: 0,
    profilesToday: 0,
    logo: "B",
    config: null,
  },
];

const Destinations = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Destinations</h2>
            <p className="text-muted-foreground">Connect your marketing and analytics tools</p>
          </div>
          <Button variant="default">
            <Plus className="w-4 h-4 mr-2" />
            Add Destination
          </Button>
        </div>

        {/* Connected destination detail */}
        {destinations.filter(d => d.status === "connected").map(destination => (
          <div key={destination.id} className="metric-card border-primary/30">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">{destination.logo}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{destination.name}</h3>
                    <span className="status-success">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{destination.type} • Last sync: {destination.lastSync}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-gradient">{destination.eventsToday.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Events Synced Today</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-gradient">{destination.profilesToday.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Profiles Updated</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-success">99.2%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold">42ms</div>
                <div className="text-sm text-muted-foreground">Avg. Latency</div>
              </div>
            </div>
          </div>
        ))}

        {/* Available destinations */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Available Destinations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {destinations.filter(d => d.status === "available").map((destination, index) => (
              <div 
                key={destination.id}
                className="metric-card hover:border-primary/30 transition-colors cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <span className="text-xl font-bold text-muted-foreground">{destination.logo}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">{destination.name}</h4>
                    <p className="text-sm text-muted-foreground">{destination.type}</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Coming soon */}
        <div className="metric-card border-dashed">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <h4 className="font-medium">More destinations coming soon</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            We're working on adding Snowflake, Braze, Attentive, and more. 
            Let us know which integrations you need!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Destinations;
