import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, ShoppingCart, MousePointer, FormInput, Megaphone, TrendingUp, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CaptureStats {
  total_identified: number;
  total_anonymous: number;
  capture_sources: {
    source: string;
    count: number;
  }[];
  conversion_rate: number;
  recent_captures: {
    email_preview: string;
    source: string;
    captured_at: string;
  }[];
}

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  checkout_realtime: { label: 'Checkout', icon: ShoppingCart, color: 'bg-green-500' },
  checkout_form: { label: 'Checkout Form', icon: ShoppingCart, color: 'bg-green-500' },
  shopify_account: { label: 'Shopify Account', icon: Users, color: 'bg-blue-500' },
  shopify_session: { label: 'Shopify Session', icon: Users, color: 'bg-blue-400' },
  form_submit: { label: 'Form Submit', icon: FormInput, color: 'bg-purple-500' },
  newsletter_form: { label: 'Newsletter', icon: Megaphone, color: 'bg-orange-500' },
  contact_form: { label: 'Contact Form', icon: Mail, color: 'bg-indigo-500' },
  klaviyo_popup: { label: 'Klaviyo Popup', icon: Megaphone, color: 'bg-pink-500' },
  klaviyo_form: { label: 'Klaviyo Form', icon: Megaphone, color: 'bg-pink-400' },
  privy_popup: { label: 'Privy Popup', icon: Megaphone, color: 'bg-teal-500' },
  justuno_popup: { label: 'Justuno Popup', icon: Megaphone, color: 'bg-cyan-500' },
  purchase_complete: { label: 'Purchase', icon: ShoppingCart, color: 'bg-emerald-500' },
  identify_api: { label: 'API', icon: MousePointer, color: 'bg-gray-500' },
  unknown: { label: 'Other', icon: MousePointer, color: 'bg-gray-400' },
};

export function LeadCaptureWidget() {
  const { currentWorkspace } = useWorkspace();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['lead-capture-stats', currentWorkspace?.id],
    queryFn: async (): Promise<CaptureStats> => {
      if (!currentWorkspace?.id) throw new Error('No workspace');

      // Get total identified users (with email)
      const { count: identifiedCount } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .not('primary_email', 'is', null);

      // Get total anonymous users (without email)
      const { count: anonymousCount } = await supabase
        .from('users_unified')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .is('primary_email', null);

      // Get capture sources from identities table
      const { data: identities } = await supabase
        .from('identities')
        .select('capture_source')
        .eq('workspace_id', currentWorkspace.id)
        .eq('identity_type', 'email')
        .order('created_at', { ascending: false })
        .limit(1000);

      // Count by source
      const sourceCounts: Record<string, number> = {};
      (identities || []).forEach((i) => {
        const source = i.capture_source || 'unknown';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });

      const capture_sources = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      // Get recent captures
      const { data: recentIdentities } = await supabase
        .from('identities')
        .select('identity_value, capture_source, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .eq('identity_type', 'email')
        .order('created_at', { ascending: false })
        .limit(5);

      const recent_captures = (recentIdentities || []).map((i) => ({
        email_preview: i.identity_value.split('@')[0].substring(0, 3) + '***@' + i.identity_value.split('@')[1],
        source: i.capture_source || 'unknown',
        captured_at: i.created_at,
      }));

      const total = (identifiedCount || 0) + (anonymousCount || 0);
      const conversion_rate = total > 0 ? ((identifiedCount || 0) / total) * 100 : 0;

      return {
        total_identified: identifiedCount || 0,
        total_anonymous: anonymousCount || 0,
        capture_sources,
        conversion_rate,
        recent_captures,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Lead Capture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalSources = stats?.capture_sources.reduce((acc, s) => acc + s.count, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Lead Capture
          </span>
          <Badge variant="outline" className="text-xs">
            {stats?.conversion_rate.toFixed(1)}% tasso di cattura
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <div className="text-3xl font-bold text-primary">{stats?.total_identified.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Email Catturate</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="text-3xl font-bold text-muted-foreground">{stats?.total_anonymous.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Ancora Anonimi</div>
          </div>
        </div>

        {/* Conversion Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Tasso di Identificazione</span>
            <span className="font-medium">{stats?.conversion_rate.toFixed(1)}%</span>
          </div>
          <Progress value={stats?.conversion_rate || 0} className="h-2" />
        </div>

        {/* Capture Sources Breakdown */}
        {stats?.capture_sources && stats.capture_sources.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Fonti di Cattura
            </h4>
            <div className="space-y-2">
              {stats.capture_sources.slice(0, 5).map(({ source, count }) => {
                const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.unknown;
                const Icon = config.icon;
                const percentage = totalSources > 0 ? (count / totalSources) * 100 : 0;

                return (
                  <div key={source} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${config.color}`} />
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{config.label}</span>
                    <span className="text-sm font-medium">{count}</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Captures */}
        {stats?.recent_captures && stats.recent_captures.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Ultime Catture</h4>
            <div className="space-y-2">
              {stats.recent_captures.map((capture, idx) => {
                const config = SOURCE_CONFIG[capture.source] || SOURCE_CONFIG.unknown;
                const Icon = config.icon;
                const timeAgo = new Date(capture.captured_at).toLocaleString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={idx} className="flex items-center gap-3 text-sm">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                      {capture.email_preview}
                    </code>
                    <Badge variant="secondary" className="text-xs">
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!stats?.capture_sources || stats.capture_sources.length === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessuna email catturata ancora</p>
            <p className="text-xs mt-1">Installa il Pixel JS per iniziare</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
