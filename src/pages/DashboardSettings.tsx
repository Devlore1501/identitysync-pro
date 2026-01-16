import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Trash2, Plus, Shield, Database, Bell, CreditCard, Loader2, Check } from "lucide-react";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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

const DashboardSettings = () => {
  const { currentWorkspace } = useWorkspace();
  const { apiKeys, isLoading, createApiKey, revokeApiKey } = useApiKeys();
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
    } catch (error) {
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

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-8">
        {/* Workspace */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Workspace</h2>
          <div className="metric-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-muted-foreground">Workspace Name</label>
                <div className="font-medium">{currentWorkspace?.name || "Loading..."}</div>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
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
                <Button variant="outline" size="sm">Change</Button>
              </div>
            </div>
          </div>
        </section>

        {/* API Keys */}
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
            Billing
          </h2>
          <div className="metric-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-2xl font-bold">Free Plan</div>
                <div className="text-muted-foreground">10K events/month included</div>
              </div>
              <Button variant="outline">Upgrade</Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default DashboardSettings;
