import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, Trash2, Plus, Shield, Database, Bell, CreditCard } from "lucide-react";

const apiKeys = [
  { id: "key_1", name: "Production", key: "sf_live_***...abc", scopes: ["collect", "admin"], created: "Jan 10, 2024" },
  { id: "key_2", name: "Development", key: "sf_test_***...xyz", scopes: ["collect"], created: "Jan 8, 2024" },
];

const DashboardSettings = () => {
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
                <div className="font-medium">My Store</div>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-muted-foreground">Shop Domain</label>
                  <div className="font-medium">mystore.myshopify.com</div>
                </div>
                <Badge variant="outline">Shopify</Badge>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-muted-foreground">Timezone</label>
                  <div className="font-medium">Europe/Rome (UTC+1)</div>
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
            <Button variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Key
            </Button>
          </div>
          <div className="metric-card p-0">
            <div className="divide-y divide-border">
              {apiKeys.map(apiKey => (
                <div key={apiKey.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{apiKey.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{apiKey.key}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                      {apiKey.scopes.map(scope => (
                        <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div>
                <div className="font-medium">Identity Profiles</div>
                <div className="text-sm text-muted-foreground">Unified customer profiles</div>
              </div>
              <Badge variant="outline">Permanent</Badge>
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
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div>
                <div className="font-medium">High Drop Rate</div>
                <div className="text-sm text-muted-foreground">Alert when event drop rate exceeds 5%</div>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded accent-primary" />
            </div>
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div>
                <div className="font-medium">Usage Limits</div>
                <div className="text-sm text-muted-foreground">Alert when approaching plan limits</div>
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
                <div className="text-2xl font-bold">Growth Plan</div>
                <div className="text-muted-foreground">€249/month • 1M events included</div>
              </div>
              <Button variant="outline">Upgrade</Button>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Events this month</span>
                <span className="font-medium">847,293 / 1,000,000</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: '84.7%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Resets on Feb 1, 2024 • Overage: €5 per 100K events
              </p>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-destructive">Danger Zone</h2>
          <div className="metric-card border-destructive/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Delete Workspace</div>
                <div className="text-sm text-muted-foreground">
                  Permanently delete this workspace and all its data
                </div>
              </div>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default DashboardSettings;
