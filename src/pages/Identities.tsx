import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Search, Filter, Users, Mail, Phone, Cookie, Tag } from "lucide-react";

const profiles = [
  {
    id: "uid_8a2b3c4d",
    primaryEmail: "john.doe@gmail.com",
    identities: 4,
    events: 156,
    lastSeen: "2 min ago",
    intentScore: 85,
    totalSpent: 1247.00,
  },
  {
    id: "uid_5e6f7g8h",
    primaryEmail: "sarah.miller@yahoo.com",
    identities: 2,
    events: 47,
    lastSeen: "15 min ago",
    intentScore: 62,
    totalSpent: 389.00,
  },
  {
    id: "uid_9i0j1k2l",
    primaryEmail: "mike.johnson@outlook.com",
    identities: 5,
    events: 234,
    lastSeen: "1 hour ago",
    intentScore: 91,
    totalSpent: 2156.00,
  },
  {
    id: "uid_3m4n5o6p",
    primaryEmail: "lisa.wang@gmail.com",
    identities: 3,
    events: 89,
    lastSeen: "2 hours ago",
    intentScore: 73,
    totalSpent: 567.00,
  },
  {
    id: "uid_7q8r9s0t",
    primaryEmail: null,
    identities: 1,
    events: 12,
    lastSeen: "3 hours ago",
    intentScore: 28,
    totalSpent: 0,
  },
];

const Identities = () => {
  const getIntentColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-muted-foreground";
  };

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
                <div className="text-2xl font-bold">12,847</div>
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
                <div className="text-2xl font-bold">9,234</div>
                <div className="text-xs text-muted-foreground">With Email</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">4,567</div>
                <div className="text-xs text-muted-foreground">With Phone</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold">3,613</div>
                <div className="text-xs text-muted-foreground">Anonymous Only</div>
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
        <div className="space-y-4">
          {profiles.map((profile, index) => (
            <div 
              key={profile.id}
              className="metric-card hover:border-primary/30 transition-colors cursor-pointer animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {profile.primaryEmail ? profile.primaryEmail[0].toUpperCase() : "?"}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">
                      {profile.primaryEmail || <span className="text-muted-foreground italic">Anonymous User</span>}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">{profile.id}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{profile.identities}</div>
                    <div className="text-xs text-muted-foreground">Identities</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{profile.events}</div>
                    <div className="text-xs text-muted-foreground">Events</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-semibold ${getIntentColor(profile.intentScore)}`}>
                      {profile.intentScore}
                    </div>
                    <div className="text-xs text-muted-foreground">Intent Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gradient">
                      ${profile.totalSpent.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Spent</div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {profile.lastSeen}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing 1-5 of 12,847 profiles
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

export default Identities;
