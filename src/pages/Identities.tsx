import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Users, Mail, Phone, Cookie, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useIdentities, useIdentitiesCount } from "@/hooks/useIdentities";
import { formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const PAGE_SIZE = 50;

interface Filters {
  hasEmail: boolean;
  hasPhone: boolean;
  anonymousOnly: boolean;
  dateRange: string;
}

const Identities = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    hasEmail: false,
    hasPhone: false,
    anonymousOnly: false,
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
  
  const { data: profiles, isLoading } = useIdentities({ 
    limit: PAGE_SIZE, 
    page,
    search: debouncedSearch,
    hasEmail: filters.hasEmail || undefined,
    hasPhone: filters.hasPhone || undefined,
    anonymousOnly: filters.anonymousOnly || undefined,
    dateFrom,
    dateTo,
  });
  const profilesCount = useIdentitiesCount(debouncedSearch);

  const totalPages = useMemo(() => {
    return Math.ceil((profilesCount.data || 0) / PAGE_SIZE);
  }, [profilesCount.data]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.hasEmail) count++;
    if (filters.hasPhone) count++;
    if (filters.anonymousOnly) count++;
    if (filters.dateRange !== "all") count++;
    return count;
  }, [filters]);

  const handlePrevious = () => {
    if (page > 0) setPage(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages - 1) setPage(page + 1);
  };

  const handleClearFilters = () => {
    setFilters({
      hasEmail: false,
      hasPhone: false,
      anonymousOnly: false,
      dateRange: "all",
    });
  };

  // Reset page when search or filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filters]);

  // Calculate stats from current page data
  const stats = useMemo(() => {
    if (!profiles) return { withEmail: 0, withPhone: 0, anonymousOnly: 0 };
    return {
      withEmail: profiles.filter(p => p.primary_email).length,
      withPhone: profiles.filter(p => p.phone).length,
      anonymousOnly: profiles.filter(p => !p.primary_email && !p.phone).length,
    };
  }, [profiles]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Identities</h2>
            <p className="text-muted-foreground">Unified customer profiles from identity resolution</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{profilesCount.data?.toLocaleString() || 0}</div>
                <div className="text-xs text-muted-foreground">Total Profiles</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.withEmail}</div>
                <div className="text-xs text-muted-foreground">With Email (this page)</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.withPhone}</div>
                <div className="text-xs text-muted-foreground">With Phone (this page)</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.anonymousOnly}</div>
                <div className="text-xs text-muted-foreground">Anonymous Only (this page)</div>
              </div>
            </div>
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
              placeholder="Search by email, phone, or profile ID..."
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
            <PopoverContent className="w-72 p-4 bg-popover border border-border shadow-lg z-50" align="end">
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

                {/* Identity Type */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Identity Type</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-email"
                        checked={filters.hasEmail}
                        onCheckedChange={(checked) => setFilters(prev => ({ 
                          ...prev, 
                          hasEmail: !!checked,
                          anonymousOnly: checked ? false : prev.anonymousOnly 
                        }))}
                      />
                      <Label htmlFor="has-email" className="text-sm cursor-pointer">Has Email</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-phone"
                        checked={filters.hasPhone}
                        onCheckedChange={(checked) => setFilters(prev => ({ 
                          ...prev, 
                          hasPhone: !!checked,
                          anonymousOnly: checked ? false : prev.anonymousOnly 
                        }))}
                      />
                      <Label htmlFor="has-phone" className="text-sm cursor-pointer">Has Phone</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="anonymous-only"
                        checked={filters.anonymousOnly}
                        onCheckedChange={(checked) => setFilters(prev => ({ 
                          ...prev, 
                          anonymousOnly: !!checked,
                          hasEmail: checked ? false : prev.hasEmail,
                          hasPhone: checked ? false : prev.hasPhone 
                        }))}
                      />
                      <Label htmlFor="anonymous-only" className="text-sm cursor-pointer">Anonymous Only</Label>
                    </div>
                  </div>
                </div>

                {/* Last Seen */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Seen</Label>
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
            {filters.hasEmail && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, hasEmail: false }))}>
                Has Email
                <X className="w-3 h-3" />
              </Badge>
            )}
            {filters.hasPhone && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, hasPhone: false }))}>
                Has Phone
                <X className="w-3 h-3" />
              </Badge>
            )}
            {filters.anonymousOnly && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, anonymousOnly: false }))}>
                Anonymous Only
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

        {/* Profiles list */}
        {isLoading ? (
          <div className="metric-card flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : profiles && profiles.length > 0 ? (
          <div className="space-y-4">
            {profiles.map((profile, index) => (
              <div 
                key={profile.id}
                className="metric-card hover:border-primary/30 transition-colors cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => navigate(`/dashboard/identities/${profile.id}`)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        {profile.primary_email ? profile.primary_email[0].toUpperCase() : "?"}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {profile.primary_email || <span className="text-muted-foreground italic">Anonymous User</span>}
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">{profile.id.slice(0, 8)}...</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{profile.emails?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">Emails</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{profile.anonymous_ids?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">Anonymous IDs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">{profile.customer_ids?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">Customer IDs</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="metric-card text-center py-12 text-muted-foreground">
            <p className="mb-2">{searchQuery || activeFiltersCount > 0 ? 'No profiles found matching your criteria' : 'No profiles resolved yet'}</p>
            <p className="text-sm">{searchQuery || activeFiltersCount > 0 ? 'Try adjusting your search or filters.' : 'Profiles will appear here once you start tracking and identifying users.'}</p>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {profiles && profiles.length > 0 ? page * PAGE_SIZE + 1 : 0}-{Math.min((page + 1) * PAGE_SIZE, profilesCount.data || 0)} of {(profilesCount.data || 0).toLocaleString()} profiles
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

export default Identities;
