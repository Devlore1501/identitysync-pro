import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Server, 
  Copy, 
  Check, 
  Shield,
  Zap,
  CheckCircle2,
  Circle,
  ArrowRight,
  ExternalLink,
  Info
} from 'lucide-react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

interface Step {
  number: number;
  title: string;
  description: string;
  status: 'done' | 'current' | 'pending';
  required: boolean;
}

export function ServerTrackingSnippet() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('steps');
  const { apiKeys } = useApiKeys();
  const { currentWorkspace } = useWorkspace();
  
  const apiKey = apiKeys?.[0]?.key_prefix ? `${apiKeys[0].key_prefix}...` : 'YOUR_API_KEY';
  const projectId = 'zkgvvuyubalbymhfxrex';
  const workspaceId = currentWorkspace?.id || 'YOUR_WORKSPACE_ID';

  // Simulated step status - in production, check via API
  const steps: Step[] = [
    {
      number: 1,
      title: 'Pixel JS Installato',
      description: 'Se vedi eventi nella dashboard, questo step è completato',
      status: 'done', // Could check if events exist
      required: true,
    },
    {
      number: 2,
      title: 'Identity Bridge',
      description: 'Collega sessioni anonime a utenti identificati al checkout',
      status: 'current',
      required: true,
    },
    {
      number: 3,
      title: 'Server-Side API',
      description: 'Tracking avanzato che bypassa AdBlock (opzionale)',
      status: 'pending',
      required: false,
    },
  ];

  const identityBridgeScript = `<!-- SignalForge Identity Bridge -->
<!-- DOVE: Shopify → Settings → Checkout → Order status page → Additional scripts -->
<script>
(function(){
  // Legge l'ID anonimo salvato dal pixel
  var sfAid = localStorage.getItem('sf_aid');
  if(!sfAid) {
    var cookies = document.cookie.split(';');
    for(var i=0; i<cookies.length; i++) {
      var c = cookies[i].trim();
      if(c.indexOf('sf_aid=') === 0) {
        sfAid = c.substring(7);
        break;
      }
    }
  }

  // Dati checkout da Shopify
  var email = Shopify.checkout ? Shopify.checkout.email : null;
  var customerId = Shopify.checkout ? Shopify.checkout.customer_id : null;
  
  // Invia identity bridge se abbiamo entrambi
  if(sfAid && email) {
    var data = JSON.stringify({
      workspace_id: '${workspaceId}',
      anonymous_id: sfAid,
      email: email,
      customer_id: customerId ? String(customerId) : null
    });
    
    // sendBeacon per affidabilità (funziona anche se la pagina si chiude)
    if(navigator.sendBeacon) {
      navigator.sendBeacon(
        'https://${projectId}.supabase.co/functions/v1/identity-bridge',
        new Blob([data], {type: 'application/json'})
      );
    } else {
      fetch('https://${projectId}.supabase.co/functions/v1/identity-bridge', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: data,
        keepalive: true
      });
    }
  }
})();
</script>`;

  const serverApiExample = `// Esempio Node.js - Server-Side Tracking
// Usa quando vuoi garantire che l'evento arrivi (bypassa AdBlock)

const SIGNALFORGE_API = 'https://${projectId}.supabase.co/functions/v1/server-track';
const API_KEY = '${apiKey}'; // Ottieni da Dashboard → API Keys

async function trackServerEvent(event) {
  const response = await fetch(SIGNALFORGE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      event_type: event.type,        // 'checkout', 'purchase', etc.
      event_name: event.name,        // 'Checkout Started', etc.
      email: event.userEmail,        // Per identity stitching
      customer_id: event.userId,     // ID cliente se disponibile
      properties: event.properties,  // Dati custom
      
      // Info server (bypassa AdBlock)
      client_ip: req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent']
    })
  });
  
  return response.json();
}

// Esempio: traccia checkout lato server
await trackServerEvent({
  type: 'checkout',
  name: 'Checkout Started',
  userEmail: customer.email,
  userId: customer.id,
  properties: {
    cart_value: cart.total,
    items: cart.items.length,
    currency: 'EUR'
  }
});`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copiato negli appunti');
    setTimeout(() => setCopied(null), 2000);
  };

  const StepIndicator = ({ step }: { step: Step }) => {
    const Icon = step.status === 'done' ? CheckCircle2 : Circle;
    const colorClass = step.status === 'done' 
      ? 'text-green-500' 
      : step.status === 'current' 
        ? 'text-primary' 
        : 'text-muted-foreground';
    
    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg ${
        step.status === 'current' ? 'bg-primary/5 border border-primary/20' : ''
      }`}>
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{step.title}</span>
            {!step.required && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Opzionale
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
        </div>
        {step.status === 'current' && (
          <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <CardTitle className="text-sm md:text-base font-semibold">Setup Tracking</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Shield className="w-3 h-3 mr-1" />
            Identity Stitching
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Guida passo-passo per integrare il tracking completo
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="steps" className="text-xs">Checklist</TabsTrigger>
            <TabsTrigger value="identity" className="text-xs">Identity Bridge</TabsTrigger>
            <TabsTrigger value="server" className="text-xs">Server API</TabsTrigger>
          </TabsList>
          
          {/* STEP 1: Checklist */}
          <TabsContent value="steps" className="mt-3 space-y-2">
            {steps.map((step) => (
              <StepIndicator key={step.number} step={step} />
            ))}
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <strong>Perché Identity Bridge?</strong>
                  <p className="mt-1">
                    Collega le sessioni anonime (prima del login) all'email dell'utente quando completa il checkout. 
                    Questo permette di inviare email di recupero carrello anche a chi non era loggato.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* STEP 2: Identity Bridge */}
          <TabsContent value="identity" className="mt-3 space-y-3">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Come installare su Shopify
              </h4>
              <ol className="mt-2 space-y-2 text-xs text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 rounded">1</span>
                  <span>Vai su <strong>Shopify Admin</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 rounded">2</span>
                  <span>Apri <strong>Settings → Checkout</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 rounded">3</span>
                  <span>Scorri fino a <strong>"Order status page"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 rounded">4</span>
                  <span>Nel campo <strong>"Additional scripts"</strong> incolla il codice qui sotto</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 rounded">5</span>
                  <span>Clicca <strong>Save</strong></span>
                </li>
              </ol>
            </div>

            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                <code>{identityBridgeScript}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 h-7"
                onClick={() => copyToClipboard(identityBridgeScript, 'identity')}
              >
                {copied === 'identity' ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Copiato
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copia
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3" />
              <a 
                href="https://help.shopify.com/en/manual/orders/status-tracking/customize-order-status" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Guida Shopify: Additional Scripts
              </a>
            </div>
          </TabsContent>
          
          {/* STEP 3: Server API */}
          <TabsContent value="server" className="mt-3 space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                Tracking Server-Side (Avanzato)
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa questo endpoint per eventi critici che devono arrivare al 100% (bypassando AdBlock). 
                Richiede sviluppo custom sul tuo backend.
              </p>
            </div>

            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                <code>{serverApiExample}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 h-7"
                onClick={() => copyToClipboard(serverApiExample, 'server')}
              >
                {copied === 'server' ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Copiato
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copia
                  </>
                )}
              </Button>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">
                <strong>Quando usare Server-Side?</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>Eventi di acquisto (Order Completed)</li>
                  <li>Checkout da app mobile</li>
                  <li>Webhook da sistemi terzi</li>
                  <li>Quando AdBlock blocca il tracking client-side</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
