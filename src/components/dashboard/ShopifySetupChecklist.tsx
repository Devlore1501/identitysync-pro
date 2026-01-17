import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useApiKeys } from "@/hooks/useApiKeys";
import { usePixelStatus } from "@/hooks/useFunnelStats";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, AlertCircle, Copy, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'complete' | 'pending' | 'error' | 'loading';
  action?: () => void;
  actionLabel?: string;
  details?: string;
}

export function ShopifySetupChecklist() {
  const { currentWorkspace } = useWorkspace();
  const { apiKeys, isLoading: apiKeysLoading } = useApiKeys();
  const { data: pixelStatus, isLoading: pixelLoading } = usePixelStatus();
  const [identityBridgeStatus, setIdentityBridgeStatus] = useState<'loading' | 'active' | 'inactive'>('loading');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Check identity bridge status
  useEffect(() => {
    const checkIdentityBridge = async () => {
      if (!currentWorkspace?.id) return;
      
      try {
        const { count } = await supabase
          .from('identities')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('identity_type', 'email')
          .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        
        setIdentityBridgeStatus(count && count > 0 ? 'active' : 'inactive');
      } catch (err) {
        setIdentityBridgeStatus('inactive');
      }
    };
    
    checkIdentityBridge();
  }, [currentWorkspace?.id]);

  const workspaceSettings = (currentWorkspace?.settings || {}) as Record<string, unknown>;
  const hasWebhookSecret = !!workspaceSettings.shopify_webhook_secret;
  const hasDomain = !!currentWorkspace?.domain;
  const hasApiKey = apiKeys && apiKeys.length > 0;
  const jsPixelActive = pixelStatus?.jsPixel?.lastEvent != null;
  const webhooksActive = pixelStatus?.webhooks?.lastEvent != null;
  const shopifyEventsActive = pixelStatus?.webhooks?.countLast24h && pixelStatus.webhooks.countLast24h > 0;

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const checklist: ChecklistItem[] = [
    {
      id: 'domain',
      title: 'Shop Domain',
      description: hasDomain 
        ? `Configurato: ${currentWorkspace?.domain}` 
        : 'Configura il dominio del tuo shop Shopify',
      status: hasDomain ? 'complete' : 'error',
      details: hasDomain ? undefined : 'Vai su Settings → General → Workspace e inserisci il dominio mystore.myshopify.com',
      action: hasDomain ? undefined : () => {
        window.location.href = '/dashboard/settings?tab=general';
      },
      actionLabel: 'Configura'
    },
    {
      id: 'api-key',
      title: 'API Key',
      description: hasApiKey 
        ? `${apiKeys.length} API key attiva` 
        : 'Crea una API key per il tracking',
      status: apiKeysLoading ? 'loading' : (hasApiKey ? 'complete' : 'error'),
      details: hasApiKey ? undefined : 'Vai su Settings → API Keys e crea una nuova chiave',
      action: hasApiKey ? undefined : () => {
        window.location.href = '/dashboard/settings?tab=api-keys';
      },
      actionLabel: 'Crea API Key'
    },
    {
      id: 'js-pixel',
      title: 'JS Pixel',
      description: jsPixelActive 
        ? `Attivo - ${pixelStatus?.jsPixel?.countLast24h || 0} eventi nelle ultime 24h`
        : 'Installa lo snippet JavaScript nel tema Shopify',
      status: pixelLoading ? 'loading' : (jsPixelActive ? 'complete' : 'pending'),
      details: jsPixelActive 
        ? undefined 
        : 'Copia lo snippet dalla tab Installation e incollalo in theme.liquid prima di </head>',
      action: jsPixelActive ? undefined : () => {
        window.location.href = '/dashboard/settings?tab=installation';
      },
      actionLabel: 'Vedi Snippet'
    },
    {
      id: 'webhooks',
      title: 'Shopify Webhooks',
      description: webhooksActive 
        ? `Attivo - ${pixelStatus?.webhooks?.countLast24h || 0} eventi server-side`
        : 'Configura i webhooks per ordini e checkout',
      status: pixelLoading ? 'loading' : (webhooksActive ? 'complete' : 'error'),
      details: webhooksActive 
        ? undefined 
        : `Nel pannello Shopify vai su Settings → Notifications → Webhooks. Aggiungi i webhook orders/create, checkouts/create con URL: ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhooks-shopify`
    },
    {
      id: 'webhook-secret',
      title: 'Webhook Secret',
      description: hasWebhookSecret 
        ? 'Secret configurato per verifica HMAC'
        : 'Opzionale: aggiungi il secret per verificare i webhook',
      status: hasWebhookSecret ? 'complete' : 'pending',
      details: hasWebhookSecret 
        ? undefined 
        : 'Copia il Webhook Signing Secret dalla pagina Notifications di Shopify e incollalo nelle impostazioni',
      action: hasWebhookSecret ? undefined : () => {
        window.location.href = '/dashboard/settings?tab=general';
      },
      actionLabel: 'Configura'
    },
    {
      id: 'identity-bridge',
      title: 'Identity Bridge',
      description: identityBridgeStatus === 'active'
        ? 'Utenti identificati negli ultimi 7 giorni'
        : identityBridgeStatus === 'loading' 
          ? 'Verifica in corso...'
          : 'Nessuna identità catturata recentemente',
      status: identityBridgeStatus === 'loading' ? 'loading' : (identityBridgeStatus === 'active' ? 'complete' : 'pending'),
      details: identityBridgeStatus === 'active' 
        ? undefined 
        : 'L\'Identity Bridge cattura automaticamente le email dal checkout. Verifica che il JS Pixel sia installato e che ci siano checkout attivi.'
    }
  ];

  const completedCount = checklist.filter(item => item.status === 'complete').length;
  const progressPercent = (completedCount / checklist.length) * 100;

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Completato</Badge>;
      case 'error':
        return <Badge variant="destructive">Da configurare</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Opzionale</Badge>;
      case 'loading':
        return <Badge variant="secondary">Verifica...</Badge>;
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhooks-shopify`);
    toast.success('URL copiato!');
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Setup Shopify</h3>
          <Badge variant={completedCount === checklist.length ? 'default' : 'secondary'}>
            {completedCount}/{checklist.length} completati
          </Badge>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {completedCount === checklist.length && (
          <p className="text-sm text-green-600">✨ Configurazione completata! Il tracking è attivo.</p>
        )}
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {checklist.map((item) => (
          <Collapsible 
            key={item.id} 
            open={expandedItems.includes(item.id)}
            onOpenChange={() => item.details && toggleExpanded(item.id)}
          >
            <div className={`rounded-lg border transition-colors ${
              item.status === 'complete' ? 'border-green-500/30 bg-green-500/5' :
              item.status === 'error' ? 'border-destructive/30 bg-destructive/5' :
              item.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/5' :
              'border-border bg-muted/30'
            }`}>
              <CollapsibleTrigger asChild>
                <div className={`p-4 flex items-center gap-3 ${item.details ? 'cursor-pointer hover:bg-muted/50' : ''}`}>
                  {getStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.action && (
                      <Button size="sm" variant="outline" onClick={(e) => {
                        e.stopPropagation();
                        item.action?.();
                      }}>
                        {item.actionLabel}
                      </Button>
                    )}
                    {item.details && (
                      expandedItems.includes(item.id) 
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              
              {item.details && (
                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-0">
                    <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      {item.details}
                      {item.id === 'webhooks' && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
                            <Copy className="w-3 h-3 mr-2" />
                            Copia URL Webhook
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              )}
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" asChild>
          <a href="https://help.shopify.com/en/manual/orders/notifications/webhooks" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3 h-3 mr-2" />
            Guida Webhooks Shopify
          </a>
        </Button>
      </div>
    </div>
  );
}
