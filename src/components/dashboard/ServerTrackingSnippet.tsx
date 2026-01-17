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
  Zap
} from 'lucide-react';
import { useApiKeys } from '@/hooks/useApiKeys';
import { toast } from 'sonner';

export function ServerTrackingSnippet() {
  const [copied, setCopied] = useState<string | null>(null);
  const { apiKeys } = useApiKeys();
  
  const apiKey = apiKeys?.[0]?.key_prefix ? `${apiKeys[0].key_prefix}...` : 'YOUR_API_KEY';
  const projectId = 'zkgvvuyubalbymhfxrex';

  const shopifyCheckoutScript = `<!-- SignalForge Identity Bridge - Shopify Additional Scripts -->
<script>
(function(){
  // Read SignalForge anonymous ID from cookie/localStorage
  var sfAid = null;
  try {
    sfAid = localStorage.getItem('sf_aid');
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
  } catch(e){}

  var email = Shopify.checkout ? Shopify.checkout.email : null;
  var customerId = Shopify.checkout ? Shopify.checkout.customer_id : null;
  
  if(sfAid && email) {
    // Send identity bridge request
    var data = JSON.stringify({
      anonymous_id: sfAid,
      email: email,
      user_id: customerId ? String(customerId) : null
    });
    
    // Use sendBeacon for reliability
    if(navigator.sendBeacon) {
      var blob = new Blob([data], {type: 'application/json'});
      navigator.sendBeacon(
        'https://${projectId}.supabase.co/functions/v1/identify',
        blob
      );
    } else {
      fetch('https://${projectId}.supabase.co/functions/v1/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '${apiKey}'
        },
        body: data,
        keepalive: true
      });
    }
  }
})();
</script>`;

  const serverTrackExample = `// Server-side tracking example (Node.js)
const response = await fetch(
  'https://${projectId}.supabase.co/functions/v1/server-track',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '${apiKey}'
    },
    body: JSON.stringify({
      event_type: 'checkout',
      event_name: 'Checkout Started',
      email: customer.email,
      customer_id: customer.id,
      properties: {
        cart_value: cart.total,
        items_count: cart.items.length
      },
      // Server fingerprint (bypasses AdBlock)
      client_ip: req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent']
    })
  }
);`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copiato negli appunti');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-2 p-3 md:p-6 md:pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <CardTitle className="text-sm md:text-base font-semibold">Server-Side Tracking</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Shield className="w-3 h-3 mr-1" />
            AdBlock Proof
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Script per identity stitching e tracking server-side
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <Tabs defaultValue="shopify" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="shopify" className="text-xs">Shopify Checkout</TabsTrigger>
            <TabsTrigger value="server" className="text-xs">Server API</TabsTrigger>
          </TabsList>
          
          <TabsContent value="shopify" className="mt-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>Inserisci in Shopify → Settings → Checkout → Additional Scripts</span>
              </div>
              <div className="relative">
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                  <code>{shopifyCheckoutScript}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 h-7"
                  onClick={() => copyToClipboard(shopifyCheckoutScript, 'shopify')}
                >
                  {copied === 'shopify' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="server" className="mt-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3 h-3" />
                <span>Endpoint /server-track per tracking diretto da server</span>
              </div>
              <div className="relative">
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                  <code>{serverTrackExample}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 h-7"
                  onClick={() => copyToClipboard(serverTrackExample, 'server')}
                >
                  {copied === 'server' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
