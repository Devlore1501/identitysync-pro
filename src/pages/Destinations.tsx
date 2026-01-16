import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Settings, Check, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { useDestinations, useSyncStats } from "@/hooks/useDestinations";
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
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";

const availableDestinations = [
  { id: "klaviyo", name: "Klaviyo", type: "ESP", logo: "K" },
  { id: "meta", name: "Meta (Facebook)", type: "Ads", logo: "M" },
  { id: "ga4", name: "Google Analytics 4", type: "Analytics", logo: "G" },
  { id: "webhook", name: "Custom Webhook", type: "Integration", logo: "W" },
];

const Destinations = () => {
  const { destinations, isLoading, createDestination, updateDestination, deleteDestination } = useDestinations();
  const { data: syncStats } = useSyncStats();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'klaviyo' | 'webhook' | 'ga4' | 'meta'>('klaviyo');
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (selectedType === 'klaviyo' && !apiKey.trim()) {
      toast.error("Please enter your Klaviyo API key");
      return;
    }
    if (selectedType === 'meta') {
      if (!pixelId.trim()) {
        toast.error("Please enter your Meta Pixel ID");
        return;
      }
      if (!apiKey.trim()) {
        toast.error("Please enter your Conversions API Access Token");
        return;
      }
    }

    setIsCreating(true);
    try {
      let config = {};
      if (selectedType === 'klaviyo') {
        config = { api_key: apiKey };
      } else if (selectedType === 'meta') {
        config = { 
          pixel_id: pixelId, 
          access_token: apiKey,
          ...(testEventCode && { test_event_code: testEventCode })
        };
      }

      await createDestination.mutateAsync({
        name,
        type: selectedType as 'klaviyo' | 'webhook' | 'ga4',
        config,
        enabled: true,
      });
      setDialogOpen(false);
      setName("");
      setApiKey("");
      setPixelId("");
      setTestEventCode("");
    } catch {
      // Error handled by hook
    }
    setIsCreating(false);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await updateDestination.mutateAsync({ id, enabled });
      toast.success(enabled ? "Destination enabled" : "Destination disabled");
    } catch {
      toast.error("Failed to update destination");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDestination.mutateAsync(id);
      toast.success("Destination removed");
    } catch {
      toast.error("Failed to delete destination");
    }
  };

  const connectedDestinations = destinations.filter(d => d.enabled);
  const configuredTypes = destinations.map(d => d.type);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Destinations</h2>
            <p className="text-muted-foreground">Connect your marketing and analytics tools</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <Plus className="w-4 h-4 mr-2" />
                Add Destination
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Destination</DialogTitle>
                <DialogDescription>
                  Connect a new destination to sync your events and profiles.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Destination Type</Label>
                  <Select value={selectedType} onValueChange={(v) => setSelectedType(v as typeof selectedType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="klaviyo">Klaviyo (ESP)</SelectItem>
                      <SelectItem value="meta">Meta / Facebook (Ads)</SelectItem>
                      <SelectItem value="ga4">Google Analytics 4</SelectItem>
                      <SelectItem value="webhook">Custom Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder={selectedType === 'meta' ? "e.g., Production Meta CAPI" : "e.g., Production Klaviyo"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                {selectedType === 'klaviyo' && (
                  <div className="space-y-2">
                    <Label>Klaviyo Private API Key</Label>
                    <Input
                      type="password"
                      placeholder="pk_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Find this in Klaviyo → Account → Settings → API Keys
                    </p>
                  </div>
                )}
                {selectedType === 'meta' && (
                  <>
                    <div className="space-y-2">
                      <Label>Meta Pixel ID</Label>
                      <Input
                        placeholder="123456789012345"
                        value={pixelId}
                        onChange={(e) => setPixelId(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Find this in Meta Events Manager → Data Sources → Your Pixel
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Conversions API Access Token</Label>
                      <Input
                        type="password"
                        placeholder="EAAGm0PX4ZCps..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Generate in Events Manager → Settings → Conversions API → Generate Access Token
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Test Event Code (optional)</Label>
                      <Input
                        placeholder="TEST12345"
                        value={testEventCode}
                        onChange={(e) => setTestEventCode(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use for testing - events will appear in Test Events tab
                      </p>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Connect
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="metric-card flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Connected destinations */}
        {connectedDestinations.map(destination => (
          <div key={destination.id} className="metric-card border-primary/30">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {destination.type === 'klaviyo' ? 'K' : destination.type === 'ga4' ? 'G' : 'W'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{destination.name}</h3>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-500/20 text-green-600">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {destination.type.toUpperCase()} • Last sync: {destination.last_sync_at 
                      ? formatDistanceToNow(new Date(destination.last_sync_at), { addSuffix: true })
                      : 'Never'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={destination.enabled} 
                  onCheckedChange={(checked) => handleToggle(destination.id, checked)}
                />
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive"
                  onClick={() => handleDelete(destination.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-primary">{syncStats?.completed || 0}</div>
                <div className="text-sm text-muted-foreground">Events Synced (7d)</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-primary">{syncStats?.pending || 0}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-green-500">{syncStats?.successRate || 100}%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-red-500">{syncStats?.failed || 0}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {destination.last_error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
                <strong>Last error:</strong> {destination.last_error}
              </div>
            )}
          </div>
        ))}

        {/* Available destinations */}
        {!isLoading && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Available Destinations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableDestinations
                .filter(d => !configuredTypes.includes(d.id as 'klaviyo' | 'webhook' | 'ga4' | 'meta'))
                .map((destination, index) => (
                <div 
                  key={destination.id}
                  className="metric-card hover:border-primary/30 transition-colors cursor-pointer animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => {
                    setSelectedType(destination.id as typeof selectedType);
                    setName(destination.name);
                    setDialogOpen(true);
                  }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <span className="text-xl font-bold text-muted-foreground">{destination.logo}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{destination.name}</h4>
                      <p className="text-sm text-muted-foreground">{destination.type}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full">
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && destinations.length === 0 && (
          <div className="metric-card border-dashed text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">No destinations connected</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Connect Klaviyo or other destinations to start syncing your events and profiles.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Destination
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Destinations;
