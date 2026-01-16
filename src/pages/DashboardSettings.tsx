import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Trash2, Plus, Shield, Database, Bell, CreditCard, Loader2, Check, Code, Settings, Globe, AlertTriangle } from "lucide-react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useUpdateWorkspace } from "@/hooks/useWorkspaceSettings";
import { useBillingUsage } from "@/hooks/useBillingUsage";
import { TrackingSnippet } from "@/components/dashboard/TrackingSnippet";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PLAN_LIMITS = {
  free: 10000,
  starter: 50000,
  growth: 250000,
  enterprise: 1000000,
};

const DashboardSettings = () => {
  const { currentWorkspace } = useWorkspace();
  const { apiKeys, isLoading, createApiKey, revokeApiKey } = useApiKeys();
  const updateWorkspace = useUpdateWorkspace();
  const { data: billingUsage } = useBillingUsage();
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Workspace edit state
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDomain, setWorkspaceDomain] = useState("");
  const [workspacePlatform, setWorkspacePlatform] = useState("");
  const [workspaceTimezone, setWorkspaceTimezone] = useState("");

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a key name");
      return;
    }
    setIsCreating(true);
    try {
      const result = await createApiKey.mutateAsync({
        name: newKeyName,
        scopes: ["collect", "identify"],
      });
      setCreatedKey(result.raw_key);
      setNewKeyName("");
      toast.success("API key created!");
    } catch {
      toast.error("Failed to create API key");
    }
    setIsCreating(false);
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await revokeApiKey.mutateAsync(keyId);
      toast.success("API key revoked");
    } catch {
      toast.error("Failed to revoke key");
    }
  };

  const handleEditWorkspace = () => {
    setWorkspaceName(currentWorkspace?.name || "");
    setWorkspaceDomain(currentWorkspace?.domain || "");
    setWorkspacePlatform(currentWorkspace?.platform || "custom");
    setWorkspaceTimezone(currentWorkspace?.timezone || "UTC");
    setEditingWorkspace(true);
  };

  const handleSaveWorkspace = async () => {
    try {
      await updateWorkspace.mutateAsync({
        name: workspaceName,
        domain: workspaceDomain || null,
        platform: workspacePlatform || null,
        timezone: workspaceTimezone,
      });
      setEditingWorkspace(false);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="installation" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Installation
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              API Keys
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-8">
            {/* Workspace */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Workspace
              </h2>
              <div className="metric-card space-y-4">
                {editingWorkspace ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">Workspace Name</label>
                      <Input 
                        value={workspaceName} 
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="My Store"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">Shop Domain</label>
                      <Input 
                        value={workspaceDomain} 
                        onChange={(e) => setWorkspaceDomain(e.target.value)}
                        placeholder="mystore.myshopify.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">Platform</label>
                      <Select value={workspacePlatform} onValueChange={setWorkspacePlatform}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shopify">Shopify</SelectItem>
                          <SelectItem value="woocommerce">WooCommerce</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">Timezone</label>
                      <Select value={workspaceTimezone} onValueChange={setWorkspaceTimezone}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">America/New_York</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                          <SelectItem value="Europe/London">Europe/London</SelectItem>
                          <SelectItem value="Europe/Rome">Europe/Rome</SelectItem>
                          <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                          <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                          <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                          <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSaveWorkspace} disabled={updateWorkspace.isPending}>
                        {updateWorkspace.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setEditingWorkspace(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm text-muted-foreground">Workspace Name</label>
                        <div className="font-medium">{currentWorkspace?.name || "Loading..."}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleEditWorkspace}>Edit</Button>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-muted-foreground">Shop Domain</label>
                          <div className="font-medium">{currentWorkspace?.domain || "Not configured"}</div>
                        </div>
                        <Badge variant="outline">{currentWorkspace?.platform || "Custom"}</Badge>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm text-muted-foreground">Timezone</label>
                          <div className="font-medium">{currentWorkspace?.timezone || "UTC"}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Retention
              </h2>
              <div className="metric-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Raw Events</div>
                    <div className="text-sm text-muted-foreground">Original event payloads</div>
                  </div>
                  <select className="px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                    <option>30 days</option>
                    <option>60 days</option>
                    <option>90 days</option>
                  </select>
                </div>
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div>
                    <div className="font-medium">Processed Events</div>
                    <div className="text-sm text-muted-foreground">Normalized and enriched data</div>
                  </div>
                  <select className="px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                    <option>6 months</option>
                    <option>12 months</option>
                    <option>24 months</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Notifications */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </h2>
              <div className="metric-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Sync Failures</div>
                    <div className="text-sm text-muted-foreground">Alert when destination sync fails</div>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded accent-primary" />
                </div>
              </div>
            </section>

            {/* Billing */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Billing & Usage
              </h2>
              <div className="metric-card space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">Free Plan</div>
                    <div className="text-muted-foreground">10K events/month included</div>
                  </div>
                  <Button variant="outline">Upgrade</Button>
                </div>

                {/* Usage Progress */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Events this month</span>
                    <span className="text-sm text-muted-foreground">
                      {(billingUsage?.events_count || 0).toLocaleString()} / {PLAN_LIMITS.free.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(((billingUsage?.events_count || 0) / PLAN_LIMITS.free) * 100, 100)} 
                    className="h-2"
                  />
                  {(billingUsage?.events_count || 0) > PLAN_LIMITS.free * 0.8 && (
                    <div className="flex items-center gap-2 mt-3 p-3 bg-warning/10 rounded-lg text-warning">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">
                        {(billingUsage?.events_count || 0) >= PLAN_LIMITS.free
                          ? "You've reached your plan limit. Upgrade to continue tracking events."
                          : "You're approaching your plan limit. Consider upgrading soon."}
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-sm text-muted-foreground">Profiles tracked</div>
                    <div className="text-lg font-semibold">{(billingUsage?.profiles_count || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Syncs this month</div>
                    <div className="text-lg font-semibold">{(billingUsage?.syncs_count || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* Installation Tab */}
          <TabsContent value="installation" className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">JavaScript Tracking Snippet</h2>
              <p className="text-muted-foreground mb-6">
                Add this snippet to your website to start tracking events. Place it in the {`<head>`} tag of your HTML.
              </p>
              
              {apiKeys.length === 0 ? (
                <div className="metric-card text-center py-8">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Create an API Key First</h3>
                  <p className="text-muted-foreground mb-4">
                    You need an API key to generate your tracking snippet.
                  </p>
                  <Button onClick={() => {
                    const tabsList = document.querySelector('[value="api-keys"]');
                    if (tabsList instanceof HTMLElement) tabsList.click();
                  }}>
                    Go to API Keys
                  </Button>
                </div>
              ) : (
                <TrackingSnippet />
              )}
            </section>

            {/* Platform-specific instructions */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Platform Instructions</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="metric-card">
                  <h3 className="font-semibold mb-2">Shopify</h3>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li>1. Go to Online Store → Themes</li>
                    <li>2. Click "Edit code" on your theme</li>
                    <li>3. Open theme.liquid</li>
                    <li>4. Paste the snippet before {`</head>`}</li>
                    <li>5. Save changes</li>
                  </ol>
                </div>
                <div className="metric-card">
                  <h3 className="font-semibold mb-2">WooCommerce</h3>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li>1. Go to Appearance → Theme Editor</li>
                    <li>2. Open header.php</li>
                    <li>3. Paste the snippet before {`</head>`}</li>
                    <li>4. Or use a plugin like "Insert Headers"</li>
                    <li>5. Save changes</li>
                  </ol>
                </div>
              </div>
            </section>

            {/* Shopify Webhooks */}
            {currentWorkspace?.platform === 'shopify' && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Shopify Webhooks</h2>
                <div className="metric-card">
                  <p className="text-muted-foreground mb-4">
                    Configure these webhooks in your Shopify admin to receive order and checkout events:
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Webhook URL</label>
                      <div className="flex gap-2 mt-1">
                        <Input 
                          readOnly 
                          value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhooks-shopify`} 
                          className="font-mono text-sm"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => {
                            navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhooks-shopify`);
                            toast.success("Webhook URL copied!");
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>Recommended topics:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>orders/create</li>
                        <li>orders/paid</li>
                        <li>checkouts/create</li>
                        <li>checkouts/update</li>
                        <li>customers/create</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">API Keys</h2>
                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setCreatedKey(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{createdKey ? "API Key Created" : "Create API Key"}</DialogTitle>
                      <DialogDescription>
                        {createdKey 
                          ? "Copy this key now. You won't be able to see it again!"
                          : "Give your API key a name to identify it later."
                        }
                      </DialogDescription>
                    </DialogHeader>
                    {createdKey ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                          {createdKey}
                        </div>
                        <Button onClick={() => handleCopyKey(createdKey)} className="w-full">
                          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                          {copied ? "Copied!" : "Copy to Clipboard"}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          placeholder="e.g., Production, Development"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                        />
                        <DialogFooter>
                          <Button onClick={handleCreateKey} disabled={isCreating}>
                            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Key
                          </Button>
                        </DialogFooter>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
              <div className="metric-card p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : apiKeys.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No API keys yet. Create one to start collecting events.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {apiKeys.map(apiKey => (
                      <div key={apiKey.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Shield className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">{apiKey.name}</div>
                            <div className="text-sm text-muted-foreground font-mono">{apiKey.key_prefix}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-1">
                            {apiKey.scopes.map(scope => (
                              <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRevoke(apiKey.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DashboardSettings;
