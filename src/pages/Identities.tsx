import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Search, Filter, Users, Mail, Phone, Cookie, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useIdentities, useIdentitiesCount } from "@/hooks/useIdentities";
import { formatDistanceToNow } from "date-fns";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE = 50;

const Identities = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const { data: profiles, isLoading } = useIdentities({ 
    limit: PAGE_SIZE, 
    page,
    search: debouncedSearch 
  });
  const profilesCount = useIdentitiesCount(debouncedSearch);

  const totalPages = useMemo(() => {
    return Math.ceil((profilesCount.data || 0) / PAGE_SIZE);
  }, [profilesCount.data]);

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
                <Mail className="w-5 h-5 text-accent" />
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
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

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
            <p className="mb-2">{searchQuery ? 'No profiles found matching your search' : 'No profiles resolved yet'}</p>
            <p className="text-sm">{searchQuery ? 'Try a different search term.' : 'Profiles will appear here once you start tracking and identifying users.'}</p>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, profilesCount.data || 0)} of {(profilesCount.data || 0).toLocaleString()} profiles
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
