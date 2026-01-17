import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, RefreshCw, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEvents, useEventsCount } from "@/hooks/useEvents";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";

const eventTypeColors: Record<string, string> = {
  purchase: "bg-green-500/20 text-green-600 border-green-500/30",
  add_to_cart: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  begin_checkout: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  view_item: "bg-muted text-muted-foreground border-border",
  page_view: "bg-muted text-muted-foreground border-border",
  page: "bg-muted text-muted-foreground border-border",
  product: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  cart: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  checkout: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  order: "bg-green-500/20 text-green-600 border-green-500/30",
  identify: "bg-indigo-500/20 text-indigo-600 border-indigo-500/30",
  custom: "bg-purple-500/20 text-purple-600 border-purple-500/30",
};

const EVENT_TYPES = [
  { value: "page", label: "Page View" },
  { value: "product", label: "Product" },
  { value: "cart", label: "Cart" },
  { value: "checkout", label: "Checkout" },
  { value: "order", label: "Order" },
  { value: "identify", label: "Identify" },
];

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "processed", label: "Processed" },
  { value: "synced", label: "Synced" },
  { value: "failed", label: "Failed" },
];

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const PAGE_SIZE = 50;

interface Filters {
  eventTypes: string[];
  status: 'pending' | 'processed' | 'failed' | 'synced' | null;
  source: string | null;
  dateRange: string;
}

const Events = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    eventTypes: [],
    status: null,
    source: null,
    dateRange: "all",
  });
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Calculate date range
  const dateFrom = useMemo(() => {
    switch (filters.dateRange) {
      case "today":
        return startOfDay(new Date());
      case "7d":
        return startOfDay(subDays(new Date(), 7));
      case "30d":
        return startOfDay(subDays(new Date(), 30));
      default:
        return undefined;
    }
  }, [filters.dateRange]);

  const dateTo = useMemo(() => {
    if (filters.dateRange === "all") return undefined;
    return endOfDay(new Date());
  }, [filters.dateRange]);
  
  const { data: events, isLoading, refetch } = useEvents({ 
    limit: PAGE_SIZE, 
    page,
    search: debouncedSearch,
    eventTypes: filters.eventTypes.length > 0 ? filters.eventTypes : undefined,
    status: filters.status || undefined,
    source: filters.source || undefined,
    dateFrom,
    dateTo,
  });
  const { data: eventsCount } = useEventsCount(debouncedSearch);

  const totalPages = useMemo(() => {
    return Math.ceil((eventsCount?.total || 0) / PAGE_SIZE);
  }, [eventsCount?.total]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.eventTypes.length > 0) count++;
    if (filters.status) count++;
    if (filters.source) count++;
    if (filters.dateRange !== "all") count++;
    return count;
  }, [filters]);

  const handlePrevious = () => {
    if (page > 0) setPage(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages - 1) setPage(page + 1);
  };

  const handleEventTypeToggle = (eventType: string) => {
    setFilters(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter(t => t !== eventType)
        : [...prev.eventTypes, eventType]
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      eventTypes: [],
      status: null,
      source: null,
      dateRange: "all",
    });
  };

  // Reset page when search or filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filters]);

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
          
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 bg-popover border border-border shadow-lg z-50" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3 mr-1" />
                      Clear all
                    </Button>
                  )}
                </div>

                {/* Event Types */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {EVENT_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type.value}`}
                          checked={filters.eventTypes.includes(type.value)}
                          onCheckedChange={() => handleEventTypeToggle(type.value)}
                        />
                        <Label htmlFor={`type-${type.value}`} className="text-sm cursor-pointer">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                  <Select
                    value={filters.status || "all"}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "all" ? null : value as Filters['status'] }))}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-50">
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</Label>
                  <Select
                    value={filters.source || "all"}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, source: value === "all" ? null : value }))}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-50">
                      <SelectItem value="all">All sources</SelectItem>
                      <SelectItem value="pixel">Pixel</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="shopify">Shopify</SelectItem>
                      <SelectItem value="klaviyo">Klaviyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Range</Label>
                  <Select
                    value={filters.dateRange}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-50">
                      {DATE_RANGES.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active filters display */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.eventTypes.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1 cursor-pointer" onClick={() => handleEventTypeToggle(type)}>
                {EVENT_TYPES.find(t => t.value === type)?.label || type}
                <X className="w-3 h-3" />
              </Badge>
            ))}
            {filters.status && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, status: null }))}>
                Status: {filters.status}
                <X className="w-3 h-3" />
              </Badge>
            )}
            {filters.source && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, source: null }))}>
                Source: {filters.source}
                <X className="w-3 h-3" />
              </Badge>
            )}
            {filters.dateRange !== "all" && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, dateRange: "all" }))}>
                {DATE_RANGES.find(r => r.value === filters.dateRange)?.label}
                <X className="w-3 h-3" />
              </Badge>
            )}
          </div>
        )}

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
                          event.source === "webhook" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent-foreground"
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
                            : event.status === "failed"
                            ? "bg-red-500/20 text-red-600"
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
              <p className="mb-2">{searchQuery || activeFiltersCount > 0 ? 'No events found matching your criteria' : 'No events captured yet'}</p>
              <p className="text-sm">{searchQuery || activeFiltersCount > 0 ? 'Try adjusting your search or filters.' : 'Events will appear here once you start tracking.'}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {events && events.length > 0 ? page * PAGE_SIZE + 1 : 0}-{Math.min((page + 1) * PAGE_SIZE, eventsCount?.total || 0)} of {(eventsCount?.total || 0).toLocaleString()} events
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
