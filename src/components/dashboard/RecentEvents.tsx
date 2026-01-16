import { Badge } from "@/components/ui/badge";

const events = [
  {
    id: "evt_1",
    type: "purchase",
    email: "john@example.com",
    value: "$129.00",
    time: "2 min ago",
    status: "synced",
  },
  {
    id: "evt_2",
    type: "add_to_cart",
    email: "sarah@example.com",
    value: "$45.00",
    time: "5 min ago",
    status: "synced",
  },
  {
    id: "evt_3",
    type: "view_item",
    email: null,
    value: "-",
    time: "6 min ago",
    status: "pending",
  },
  {
    id: "evt_4",
    type: "checkout_started",
    email: "mike@example.com",
    value: "$89.00",
    time: "8 min ago",
    status: "synced",
  },
  {
    id: "evt_5",
    type: "view_item",
    email: "lisa@example.com",
    value: "-",
    time: "10 min ago",
    status: "synced",
  },
];

const eventTypeColors: Record<string, string> = {
  purchase: "bg-success/20 text-success border-success/30",
  add_to_cart: "bg-warning/20 text-warning border-warning/30",
  checkout_started: "bg-info/20 text-info border-info/30",
  view_item: "bg-muted text-muted-foreground border-border",
};

export const RecentEvents = () => {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Recent Events</h3>
          <p className="text-sm text-muted-foreground">Live event stream</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full pulse-live" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => (
          <div 
            key={event.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 data-row animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className={eventTypeColors[event.type]}
              >
                {event.type.replace("_", " ")}
              </Badge>
              <span className="text-sm">
                {event.email || <span className="text-muted-foreground italic">anonymous</span>}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{event.value}</span>
              <span className="text-xs text-muted-foreground w-16 text-right">{event.time}</span>
              <span className={`w-2 h-2 rounded-full ${
                event.status === "synced" ? "bg-success" : "bg-warning"
              }`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
