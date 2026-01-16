import { usePixelStatus } from "@/hooks/useFunnelStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Clock, Code, Webhook, Loader2, Send, ShoppingCart, Mail, User, Eye, CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TestResult {
  success: boolean;
  email?: string;
  unified_user_id?: string;
  order_id?: string;
  message?: string;
  event_name?: string;
  product_name?: string;
}

export function PixelStatus() {
  const { data: status, isLoading } = usePixelStatus();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingOrder, setIsTestingOrder] = useState(false);
  const [isTestingCart, setIsTestingCart] = useState(false);
  const [isTestingCheckout, setIsTestingCheckout] = useState(false);
  const [isTestingProduct, setIsTestingProduct] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTestWebhook = async () => {
    if (!currentWorkspace?.id) {
      toast({
        title: "Errore",
        description: "Workspace non trovato",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: { workspace_id: currentWorkspace.id, test_type: 'simple' }
      });

      if (error) throw error;

      toast({
        title: "Test completato!",
        description: "Evento webhook di test ricevuto correttamente",
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['pixel-status'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    } catch (error: any) {
      console.error('Test webhook error:', error);
      toast({
        title: "Errore nel test",
        description: error.message || "Impossibile inviare il test webhook",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestOrder = async () => {
    if (!currentWorkspace?.id) {
      toast({
        title: "Errore",
        description: "Workspace non trovato",
        variant: "destructive"
      });
      return;
    }

    setIsTestingOrder(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: { 
          workspace_id: currentWorkspace.id, 
          test_type: 'order',
          test_email: testEmail || undefined
        }
      });

      if (error) throw error;

      setTestResult({
        success: true,
        email: data.email,
        unified_user_id: data.unified_user_id,
        order_id: data.order_id,
        message: data.message
      });

      toast({
        title: "Ordine test creato!",
        description: `Email ${data.email} salvata nel profilo`,
      });

      // Refresh all relevant queries
      queryClient.invalidateQueries({ queryKey: ['pixel-status'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['identities-count'] });
    } catch (error: any) {
      console.error('Test order error:', error);
      setTestResult({
        success: false,
        message: error.message || "Impossibile creare l'ordine test"
      });
      toast({
        title: "Errore nel test",
        description: error.message || "Impossibile creare l'ordine test",
        variant: "destructive"
      });
    } finally {
      setIsTestingOrder(false);
    }
  };

  const handleTestEvent = async (testType: 'add_to_cart' | 'checkout' | 'product_view') => {
    if (!currentWorkspace?.id) {
      toast({ title: "Errore", description: "Workspace non trovato", variant: "destructive" });
      return;
    }

    const setLoading = testType === 'add_to_cart' ? setIsTestingCart : 
                       testType === 'checkout' ? setIsTestingCheckout : setIsTestingProduct;
    
    setLoading(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: { 
          workspace_id: currentWorkspace.id, 
          test_type: testType,
          test_email: testType === 'checkout' ? testEmail || undefined : undefined
        }
      });

      if (error) throw error;

      setTestResult({
        success: true,
        event_name: data.event_name,
        product_name: data.product_name,
        unified_user_id: data.unified_user_id,
        email: data.email,
        message: data.message
      });

      toast({
        title: `${data.event_name} creato!`,
        description: data.message,
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['pixel-status'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['behavioral-stats'] });
    } catch (error: any) {
      toast({
        title: "Errore nel test",
        description: error.message || "Impossibile creare l'evento test",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  const jsActive = status?.jsPixel?.lastEvent != null;
  const webhooksActive = status?.webhooks?.lastEvent != null;

  return (
    <div className="space-y-4">
      <h4 className="font-medium flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Stato Installazione
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* JS Pixel Status */}
        <div className={`p-4 rounded-lg border ${jsActive ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4" />
            <span className="font-medium">JS Pixel</span>
            {jsActive ? (
              <Badge variant="default" className="ml-auto bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Attivo
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto">
                <XCircle className="w-3 h-3 mr-1" />
                Non rilevato
              </Badge>
            )}
          </div>
          
          {jsActive && status?.jsPixel?.lastEvent ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Ultimo evento: <span className="font-mono text-xs">{status.jsPixel.lastEvent.event_name}</span>
              </div>
              <div>
                {formatDistanceToNow(new Date(status.jsPixel.lastEvent.event_time), { addSuffix: true, locale: it })}
              </div>
              <div className="text-xs">
                {status.jsPixel.countLast24h} eventi nelle ultime 24h
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Installa lo snippet JS per iniziare a tracciare eventi dal browser
            </p>
          )}
        </div>

        {/* Webhooks Status */}
        <div className={`p-4 rounded-lg border ${webhooksActive ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Webhook className="w-4 h-4" />
            <span className="font-medium">Shopify Webhooks</span>
            {webhooksActive ? (
              <Badge variant="default" className="ml-auto bg-green-500">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Attivo
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto">
                <XCircle className="w-3 h-3 mr-1" />
                Non rilevato
              </Badge>
            )}
          </div>
          
          {webhooksActive && status?.webhooks?.lastEvent ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Ultimo evento: <span className="font-mono text-xs">{status.webhooks.lastEvent.event_name}</span>
              </div>
              <div>
                {formatDistanceToNow(new Date(status.webhooks.lastEvent.event_time), { addSuffix: true, locale: it })}
              </div>
              <div className="text-xs">
                {status.webhooks.countLast24h} eventi nelle ultime 24h
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configura i webhooks Shopify per ricevere ordini e checkout
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestWebhook}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Invia Test Webhook
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Funnel Event Tests */}
      <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4" />
          <span className="font-medium">Simula Eventi Funnel</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            Test Comportamentali
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3">
          Testa gli eventi del funnel per verificare il calcolo dei segnali comportamentali.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => handleTestEvent('product_view')}
            disabled={isTestingProduct}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isTestingProduct ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1" />
                Product View
              </>
            )}
          </Button>

          <Button
            onClick={() => handleTestEvent('add_to_cart')}
            disabled={isTestingCart}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isTestingCart ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-1" />
                Add to Cart
              </>
            )}
          </Button>

          <Button
            onClick={() => handleTestEvent('checkout')}
            disabled={isTestingCheckout}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isTestingCheckout ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-1" />
                Checkout
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Test Order with Email */}
      <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4" />
          <span className="font-medium">Simula Ordine con Email</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            Test
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3">
          Crea un ordine di test completo con email per verificare la cattura delle identità.
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Email test (opzionale)"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="pl-10 text-sm"
                type="email"
              />
            </div>
          </div>
          
          <Button
            onClick={handleTestOrder}
            disabled={isTestingOrder}
            className="w-full"
            variant="default"
          >
            {isTestingOrder ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creazione ordine...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Simula Ordine Shopify
              </>
            )}
          </Button>

          {testResult && (
            <div className={`p-3 rounded-lg text-sm ${
              testResult.success 
                ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {testResult.success ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">{testResult.event_name || 'Evento creato!'}</span>
                  </div>
                  {testResult.email && (
                    <div className="text-xs ml-6 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email: <span className="font-mono">{testResult.email}</span>
                    </div>
                  )}
                  {testResult.product_name && (
                    <div className="text-xs ml-6">
                      Prodotto: <span className="font-mono">{testResult.product_name}</span>
                    </div>
                  )}
                  <div className="text-xs ml-6 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Profile: <span className="font-mono">{testResult.unified_user_id?.slice(0, 8)}...</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
