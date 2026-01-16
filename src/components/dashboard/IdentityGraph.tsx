import { Users, Mail, Phone, Cookie, Tag } from "lucide-react";

const identityData = {
  totalProfiles: 12847,
  resolvedToday: 342,
  averageIdentities: 2.4,
  recentResolutions: [
    {
      id: "uid_1",
      identities: [
        { type: "email", value: "john.d***@gmail.com" },
        { type: "phone", value: "+1 ***-***-4567" },
        { type: "customer_id", value: "cust_8a2b3c" },
      ],
      events: 47,
      lastSeen: "2 min ago",
    },
    {
      id: "uid_2",
      identities: [
        { type: "email", value: "sarah.m***@yahoo.com" },
        { type: "anonymous_id", value: "anon_7f8e9d" },
      ],
      events: 12,
      lastSeen: "15 min ago",
    },
    {
      id: "uid_3",
      identities: [
        { type: "email", value: "mike.j***@outlook.com" },
        { type: "phone", value: "+44 ***-***-8901" },
        { type: "customer_id", value: "cust_2d4e6f" },
        { type: "anonymous_id", value: "anon_1a2b3c" },
      ],
      events: 89,
      lastSeen: "1 hour ago",
    },
  ],
};

const identityIcons: Record<string, React.ElementType> = {
  email: Mail,
  phone: Phone,
  customer_id: Tag,
  anonymous_id: Cookie,
};

export const IdentityGraph = () => {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Identity Resolution</h3>
          <p className="text-sm text-muted-foreground">Unified customer profiles</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-accent" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <div className="text-2xl font-bold text-gradient">{identityData.totalProfiles.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Profiles</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <div className="text-2xl font-bold text-gradient">+{identityData.resolvedToday}</div>
          <div className="text-xs text-muted-foreground">Resolved Today</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/30">
          <div className="text-2xl font-bold text-gradient">{identityData.averageIdentities}</div>
          <div className="text-xs text-muted-foreground">Avg. Identities</div>
        </div>
      </div>

      {/* Recent resolutions */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Recent Resolutions</h4>
        {identityData.recentResolutions.map((profile, index) => (
          <div 
            key={profile.id}
            className="p-4 rounded-lg bg-muted/20 border border-border animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-muted-foreground">{profile.id}</span>
              <span className="text-xs text-muted-foreground">{profile.lastSeen}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {profile.identities.map((identity, i) => {
                const Icon = identityIcons[identity.type] || Tag;
                return (
                  <div 
                    key={i}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card text-xs"
                  >
                    <Icon className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground">{identity.value}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              {profile.events} events tracked
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
