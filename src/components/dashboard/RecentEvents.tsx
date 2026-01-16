import { Badge } from "@/components/ui/badge";
import { useEvents } from "@/hooks/useEvents";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

const eventTypeColors: Record<string, string> = {
  purchase: "bg-green-500/20 text-green-600 border-green-500/30",
  add_to_cart: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  begin_checkout: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  view_item: "bg-muted text-muted-foreground border-border",
  page_view: "bg-muted text-muted-foreground border-border",
  custom: "bg-purple-500/20 text-purple-600 border-purple-500/30",
};

export const RecentEvents = () => {
  const { data: events, isLoading } = useEvents({ limit: 5 });

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Recent Events</h3>
          <p className="text-sm text-muted-foreground">Live event stream</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div 
              key={event.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center gap-3">
                <Badge 
                  variant="outline" 
                  className={eventTypeColors[event.event_type] || eventTypeColors.custom}
                >
                  {event.event_type.replace("_", " ")}
                </Badge>
                <span className="text-sm truncate max-w-[150px]">
                  {event.event_name}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.event_time), { addSuffix: true })}
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  event.status === "synced" ? "bg-green-500" : 
                  event.status === "processed" ? "bg-blue-500" : "bg-yellow-500"
                }`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No events yet</p>
          <p className="text-xs mt-1">Events will appear here as they come in</p>
        </div>
      )}
    </div>
  );
};
