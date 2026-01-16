import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, RefreshCw } from "lucide-react";

const events = [
  { id: "evt_a1b2c3", type: "purchase", email: "john@example.com", value: 129.00, source: "webhook", status: "synced", time: "2024-01-15 14:23:45" },
  { id: "evt_d4e5f6", type: "add_to_cart", email: "sarah@example.com", value: 45.00, source: "browser", status: "synced", time: "2024-01-15 14:22:12" },
  { id: "evt_g7h8i9", type: "view_item", email: null, value: null, source: "browser", status: "pending", time: "2024-01-15 14:21:58" },
  { id: "evt_j0k1l2", type: "checkout_started", email: "mike@example.com", value: 89.00, source: "browser", status: "synced", time: "2024-01-15 14:20:33" },
  { id: "evt_m3n4o5", type: "view_item", email: "lisa@example.com", value: null, source: "browser", status: "synced", time: "2024-01-15 14:19:47" },
  { id: "evt_p6q7r8", type: "purchase", email: "david@example.com", value: 245.00, source: "webhook", status: "synced", time: "2024-01-15 14:18:22" },
  { id: "evt_s9t0u1", type: "add_to_cart", email: null, value: 67.00, source: "browser", status: "pending", time: "2024-01-15 14:17:01" },
  { id: "evt_v2w3x4", type: "checkout_started", email: "emma@example.com", value: 156.00, source: "browser", status: "synced", time: "2024-01-15 14:15:55" },
];

const eventTypeColors: Record<string, string> = {
  purchase: "bg-success/20 text-success border-success/30",
  add_to_cart: "bg-warning/20 text-warning border-warning/30",
  checkout_started: "bg-info/20 text-info border-info/30",
  view_item: "bg-muted text-muted-foreground border-border",
};

const Events = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Events</h2>
            <p className="text-muted-foreground">View and analyze all captured events</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by email, event ID, or type..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Events table */}
        <div className="metric-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Event ID</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Value</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Source</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr 
                    key={event.id} 
                    className="border-b border-border/50 data-row animate-fade-in"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm">{event.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={eventTypeColors[event.type]}>
                        {event.type.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {event.email || <span className="text-muted-foreground italic">anonymous</span>}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      {event.value ? `$${event.value.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        event.source === "webhook" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                      }`}>
                        {event.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={event.status === "synced" ? "status-success" : "status-warning"}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {event.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-8 of 24,847 events
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm">Next</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Events;
