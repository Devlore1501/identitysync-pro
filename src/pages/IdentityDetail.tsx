import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  Calendar,
  Activity,
  Target,
  Trash2,
  Copy,
  ShoppingCart,
  Eye,
  MousePointer,
  CreditCard,
  Loader2,
  Clock,
  Fingerprint,
  BarChart3,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  useIdentityDetail,
  useIdentityIdentities,
  useIdentityEvents,
  useDeleteIdentity,
} from "@/hooks/useIdentityDetail";
import { toast } from "sonner";

const eventIcons: Record<string, React.ReactNode> = {
  page_view: <Eye className="w-4 h-4" />,
  view_item: <Eye className="w-4 h-4" />,
  add_to_cart: <ShoppingCart className="w-4 h-4" />,
  begin_checkout: <CreditCard className="w-4 h-4" />,
  purchase: <CreditCard className="w-4 h-4" />,
  custom: <MousePointer className="w-4 h-4" />,
};

const eventColors: Record<string, string> = {
  page_view: "bg-blue-500/10 text-blue-500",
  view_item: "bg-purple-500/10 text-purple-500",
  add_to_cart: "bg-orange-500/10 text-orange-500",
  begin_checkout: "bg-yellow-500/10 text-yellow-500",
  purchase: "bg-green-500/10 text-green-500",
  custom: "bg-muted text-muted-foreground",
};

const identityTypeLabels: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  customer_id: "Customer ID",
  anonymous_id: "Anonymous ID",
  external_id: "External ID",
};

const IdentityDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useIdentityDetail(id);
  const { data: identities } = useIdentityIdentities(id);
  const { data: events } = useIdentityEvents(id);
  const deleteIdentity = useDeleteIdentity();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteIdentity.mutateAsync(id);
    navigate("/dashboard/identities");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button variant="outline" onClick={() => navigate("/dashboard/identities")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Identities
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const computed = profile.computed as Record<string, unknown>;
  const traits = profile.traits as Record<string, unknown>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/identities")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-semibold text-primary">
                {profile.primary_email ? profile.primary_email[0].toUpperCase() : "?"}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {profile.primary_email || "Anonymous User"}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{profile.id.slice(0, 12)}...</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(profile.id)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Profile (GDPR)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Profile?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action permanently deletes this user profile and all associated identities.
                  Events will be anonymized but retained for analytics. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteIdentity.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {computed?.intent_score != null ? Math.round(Number(computed.intent_score)) : 0}
                </div>
                <div className="text-xs text-muted-foreground">Intent Score</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  ${computed?.lifetime_value != null ? Number(computed.lifetime_value).toFixed(0) : 0}
                </div>
                <div className="text-xs text-muted-foreground">Lifetime Value</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{events?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Events</div>
              </div>
            </div>
          </div>
          <div className="metric-card py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{identities?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Identities</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="events">Events ({events?.length || 0})</TabsTrigger>
            <TabsTrigger value="identities">Identities ({identities?.length || 0})</TabsTrigger>
            <TabsTrigger value="traits">Traits</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Contact Info */}
            <div className="metric-card">
              <h3 className="font-semibold mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Primary Email</div>
                    <div className="font-medium">{profile.primary_email || "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Phone</div>
                    <div className="font-medium">{profile.phone || "—"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">First Seen</div>
                    <div className="font-medium">
                      {format(new Date(profile.first_seen_at), "PPp")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Last Seen</div>
                    <div className="font-medium">
                      {formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Computed Properties */}
            <div className="metric-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Computed Properties
              </h3>
              {Object.keys(computed).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(computed).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground capitalize">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="font-medium mt-1">
                        {typeof value === "number"
                          ? key.includes("value")
                            ? `$${value.toFixed(2)}`
                            : value.toFixed(1)
                          : String(value) || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No computed properties yet</p>
              )}
            </div>

            {/* Recent Events */}
            <div className="metric-card">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              {events && events.length > 0 ? (
                <div className="space-y-3">
                  {events.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            eventColors[event.event_type] || eventColors.custom
                          }`}
                        >
                          {eventIcons[event.event_type] || eventIcons.custom}
                        </div>
                        <div>
                          <div className="font-medium">{event.event_name}</div>
                          <div className="text-xs text-muted-foreground">{event.source}</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(event.event_time), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No events recorded</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {events && events.length > 0 ? (
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="metric-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            eventColors[event.event_type] || eventColors.custom
                          }`}
                        >
                          {eventIcons[event.event_type] || eventIcons.custom}
                        </div>
                        <div>
                          <div className="font-medium">{event.event_name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {event.event_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{event.source}</span>
                          </div>
                          {Object.keys(event.properties).length > 0 && (
                            <div className="mt-2 p-2 rounded bg-muted/50 text-xs font-mono overflow-x-auto max-w-md">
                              {JSON.stringify(event.properties, null, 2).slice(0, 200)}
                              {JSON.stringify(event.properties).length > 200 && "..."}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.event_time), "PPp")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="metric-card text-center py-12 text-muted-foreground">
                No events recorded for this profile
              </div>
            )}
          </TabsContent>

          <TabsContent value="identities" className="space-y-4">
            {identities && identities.length > 0 ? (
              <div className="space-y-2">
                {identities.map((identity) => (
                  <div key={identity.id} className="metric-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-mono text-sm">{identity.identity_value}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {identityTypeLabels[identity.identity_type] || identity.identity_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Confidence: {(identity.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{identity.source}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(identity.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="metric-card text-center py-12 text-muted-foreground">
                No identities linked to this profile
              </div>
            )}
          </TabsContent>

          <TabsContent value="traits" className="space-y-4">
            <div className="metric-card">
              <h3 className="font-semibold mb-4">User Traits</h3>
              {Object.keys(traits).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(traits).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground capitalize">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="font-medium mt-1 break-all">
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value) || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No traits set for this profile</p>
              )}
            </div>

            <div className="metric-card">
              <h3 className="font-semibold mb-4">All Emails</h3>
              {profile.emails.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.emails.map((email, i) => (
                    <Badge key={i} variant="secondary">
                      {email}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No emails collected</p>
              )}
            </div>

            <div className="metric-card">
              <h3 className="font-semibold mb-4">Anonymous IDs</h3>
              {profile.anonymous_ids.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.anonymous_ids.map((anonId, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      {anonId.slice(0, 12)}...
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No anonymous IDs</p>
              )}
            </div>

            <div className="metric-card">
              <h3 className="font-semibold mb-4">Customer IDs</h3>
              {profile.customer_ids.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.customer_ids.map((custId, i) => (
                    <Badge key={i} variant="secondary" className="font-mono">
                      {custId}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No customer IDs linked</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default IdentityDetail;
