import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  ChevronDown, 
  ChevronUp,
  Mail,
  ShoppingCart,
  Eye,
  CheckCircle,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const flows = [
  {
    id: 'checkout-abandoned',
    title: 'Checkout Abandoned Flow',
    icon: ShoppingCart,
    color: 'text-orange-500',
    trigger: 'Profile Updated',
    filter: 'sf_checkout_abandoned_at is set in last 4 hours',
    safety: 'Placed Order = 0 since starting this flow',
    properties: ['sf_checkout_abandoned_at', 'sf_last_checkout_id', 'sf_intent_score'],
    description: 'Recupera utenti che hanno abbandonato il checkout. Usa Profile Updated invece di eventi per evitare duplicati.',
  },
  {
    id: 'cart-abandoned',
    title: 'Cart Abandoned Flow',
    icon: ShoppingCart,
    color: 'text-yellow-500',
    trigger: 'Profile Updated',
    filter: 'sf_cart_abandoned_at is set in last 4 hours',
    safety: 'sf_checkout_abandoned_at is not set',
    properties: ['sf_cart_abandoned_at', 'sf_last_cart_token', 'sf_intent_score'],
    description: 'Recupera utenti che hanno aggiunto al carrello ma non hanno iniziato checkout.',
  },
  {
    id: 'browse-abandonment',
    title: 'High Intent Browse Flow',
    icon: Eye,
    color: 'text-blue-500',
    trigger: 'Profile Updated',
    filter: 'sf_intent_score >= 60 AND sf_dropoff_stage = engaged',
    safety: 'sf_cart_abandoned_at is not set',
    properties: ['sf_intent_score', 'sf_dropoff_stage', 'sf_top_category', 'sf_last_product_viewed_at'],
    description: 'Recupera utenti con alto intent che hanno visualizzato prodotti ma non hanno aggiunto al carrello.',
  },
];

export function KlaviyoFlowGuide() {
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiato negli appunti!');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Klaviyo Flow Setup Guide
            </CardTitle>
            <CardDescription>
              Come configurare i flow con Profile Updated triggers
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-4">
          {/* Why Profile Updated */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
              <div className="text-sm">
                <strong>Perché Profile Updated?</strong>
                <p className="text-muted-foreground mt-1">
                  Usare "Profile Updated" invece di eventi evita che i flow ripartano più volte 
                  per lo stesso utente. Le properties sf_* vengono aggiornate una sola volta 
                  quando l'abandonment viene rilevato.
                </p>
              </div>
            </div>
          </div>

          {/* Flow Configs */}
          <Accordion type="single" collapsible className="w-full">
            {flows.map((flow) => (
              <AccordionItem key={flow.id} value={flow.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <flow.icon className={`w-4 h-4 ${flow.color}`} />
                    <span>{flow.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{flow.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Trigger:</span>
                        <span className="ml-2 font-medium">{flow.trigger}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.trigger)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Filter:</span>
                        <code className="ml-2 text-xs bg-muted px-1 rounded">{flow.filter}</code>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.filter)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Safety:</span>
                        <code className="ml-2 text-xs bg-muted px-1 rounded">{flow.safety}</code>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.safety)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {flow.properties.map((prop) => (
                      <Badge key={prop} variant="outline" className="text-xs font-mono">
                        {prop}
                      </Badge>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* All Properties */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-sm font-medium mb-2">Tutte le properties sf_* disponibili:</div>
            <div className="flex flex-wrap gap-1">
              {[
                'sf_intent_score',
                'sf_dropoff_stage',
                'sf_checkout_abandoned_at',
                'sf_cart_abandoned_at',
                'sf_last_action',
                'sf_last_action_at',
                'sf_last_checkout_id',
                'sf_last_cart_token',
                'sf_top_category',
                'sf_viewed_products_7d',
                'sf_session_count_30d',
                'sf_lifetime_value',
                'sf_orders_count',
              ].map((prop) => (
                <Badge 
                  key={prop} 
                  variant="secondary" 
                  className="text-xs font-mono cursor-pointer hover:bg-primary/20"
                  onClick={() => copyToClipboard(prop)}
                >
                  {prop}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
