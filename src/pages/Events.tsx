import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, RefreshCw, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEvents, useEventsCount } from "@/hooks/useEvents";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";

const eventTypeColors: Record<string, string> = {
  purchase: "bg-green-500/20 text-green-600 border-green-500/30",
  add_to_cart: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  begin_checkout: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  view_item: "bg-muted text-muted-foreground border-border",
  page_view: "bg-muted text-muted-foreground border-border",
  custom: "bg-purple-500/20 text-purple-600 border-purple-500/30",
};

const PAGE_SIZE = 50;

const Events = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const { data: events, isLoading, refetch } = useEvents({ 
    limit: PAGE_SIZE, 
    page,
    search: debouncedSearch 
  });
  const { data: eventsCount } = useEventsCount(debouncedSearch);

  const totalPages = useMemo(() => {
    return Math.ceil((eventsCount?.total || 0) / PAGE_SIZE);
  }, [eventsCount?.total]);

  const handlePrevious = () => {
    if (page > 0) setPage(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages - 1) setPage(page + 1);
  };

  // Reset page when search changes
  useMemo(() => {
    setPage(0);
  }, [debouncedSearch]);

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
            <Button variant="outline" size="sm" onClick={() => refetch()}>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event name, type, or ID..."
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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : events && events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Event ID</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Type</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Source</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, index) => (
                    <tr 
                      key={event.id} 
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">{event.id.slice(0, 8)}...</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={eventTypeColors[event.event_type] || eventTypeColors.custom}>
                          {event.event_type.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {event.event_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          event.source === "webhook" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                        }`}>
                          {event.source}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded ${
                          event.status === "synced" 
                            ? "bg-green-500/20 text-green-600" 
                            : event.status === "processed"
                            ? "bg-blue-500/20 text-blue-600"
                            : "bg-yellow-500/20 text-yellow-600"
                        }`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {format(new Date(event.event_time), 'MMM d, HH:mm:ss')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-2">{searchQuery ? 'No events found matching your search' : 'No events captured yet'}</p>
              <p className="text-sm">{searchQuery ? 'Try a different search term.' : 'Events will appear here once you start tracking.'}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, eventsCount?.total || 0)} of {(eventsCount?.total || 0).toLocaleString()} events
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevious}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page + 1} of {totalPages || 1}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNext}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Events;
