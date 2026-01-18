import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  ChevronDown, 
  ChevronUp,
  ShoppingCart,
  Eye,
  Copy,
  AlertCircle,
  Users,
  Zap,
  ListPlus,
  Target,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FlowConfig {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  description: string;
  segmentApproach: {
    segmentName: string;
    definition: string;
    flowFilter: string;
    useCase: string;
  };
  metricApproach: {
    eventName: string;
    flowFilter: string;
    useCase: string;
  };
  properties: string[];
}

const flows: FlowConfig[] = [
  {
    id: 'checkout-abandoned',
    title: 'Checkout Abandoned Flow',
    icon: ShoppingCart,
    color: 'text-orange-500',
    description: 'Recupera utenti che hanno abbandonato il checkout.',
    segmentApproach: {
      segmentName: 'SF Checkout Abandoned',
      definition: 'sf_checkout_abandoned_at is set AND sf_checkout_abandoned_at in the last 4 hours',
      flowFilter: 'Placed Order = 0 since starting this flow',
      useCase: 'Flow one-time: utente entra UNA volta quando abbandona checkout',
    },
    metricApproach: {
      eventName: 'SF Checkout Abandoned',
      flowFilter: 'Placed Order = 0 since starting this flow',
      useCase: 'Flow ripetibile: utente può entrare ogni volta che abbandona checkout',
    },
    properties: ['sf_checkout_abandoned_at', 'sf_intent_score', 'sf_dropoff_stage'],
  },
  {
    id: 'cart-abandoned',
    title: 'Cart Abandoned Flow',
    icon: ShoppingCart,
    color: 'text-yellow-500',
    description: 'Recupera utenti che hanno aggiunto al carrello ma non hanno iniziato checkout.',
    segmentApproach: {
      segmentName: 'SF Cart Abandoned',
      definition: 'sf_cart_abandoned_at is set AND sf_cart_abandoned_at in the last 4 hours AND sf_checkout_abandoned_at is not set',
      flowFilter: 'Placed Order = 0 since starting this flow',
      useCase: 'Flow one-time: utente entra UNA volta quando abbandona carrello',
    },
    metricApproach: {
      eventName: 'SF Cart Abandoned',
      flowFilter: 'sf_checkout_abandoned_at is not set AND Placed Order = 0 since starting this flow',
      useCase: 'Flow ripetibile: utente può entrare ogni volta che abbandona carrello',
    },
    properties: ['sf_cart_abandoned_at', 'sf_intent_score', 'sf_dropoff_stage'],
  },
  {
    id: 'browse-abandonment',
    title: 'High Intent Browse Flow',
    icon: Eye,
    color: 'text-blue-500',
    description: 'Recupera utenti con alto intent che hanno visualizzato prodotti ma non hanno aggiunto al carrello.',
    segmentApproach: {
      segmentName: 'SF High Intent Browsers',
      definition: 'sf_intent_score >= 60 AND sf_dropoff_stage = "engaged" AND sf_cart_abandoned_at is not set',
      flowFilter: 'Added to Cart = 0 since starting this flow',
      useCase: 'Flow one-time: utente entra quando raggiunge alto intent senza aggiungere al carrello',
    },
    metricApproach: {
      eventName: 'SF High Intent Browse',
      flowFilter: 'sf_cart_abandoned_at is not set AND Added to Cart = 0 since starting this flow',
      useCase: 'Flow ripetibile: (sconsigliato per browse - meglio segment)',
    },
    properties: ['sf_intent_score', 'sf_dropoff_stage', 'sf_top_category', 'sf_last_product_viewed_at'],
  },
];

const allProperties = [
  'sf_intent_score',
  'sf_dropoff_stage',
  'sf_checkout_abandoned_at',
  'sf_cart_abandoned_at',
  'sf_last_product_viewed_at',
  'sf_last_cart_at',
  'sf_top_category',
  'sf_viewed_products_7d',
  'sf_session_count_30d',
  'sf_lifetime_value',
  'sf_orders_count',
  'sf_frequency_score',
  'sf_depth_score',
  'sf_recency_days',
  'sf_email_engagement_score',
  'sf_is_subscribed',
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
              Come configurare i flow con i trigger corretti di Klaviyo
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
          {/* Important Notice */}
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              <strong>Nota importante:</strong> Klaviyo non ha un trigger "Profile Updated". 
              Usa invece <strong>Segment Trigger</strong> o <strong>Metric Trigger</strong>.
            </AlertDescription>
          </Alert>

          {/* Trigger Types Explanation */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <strong className="text-sm">Segment Trigger</strong>
                <Badge variant="outline" className="text-xs">Consigliato</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Il flow parte quando l'utente <strong>entra in un segmento</strong>. 
                L'utente può entrare solo una volta (ideale per evitare spam).
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-secondary-foreground" />
                <strong className="text-sm">Metric Trigger</strong>
              </div>
              <p className="text-xs text-muted-foreground">
                Il flow parte quando viene tracciato un <strong>evento specifico</strong>. 
                L'utente può entrare ogni volta (flow ripetibili).
              </p>
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
                  
                  <Tabs defaultValue="segment" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="segment" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        Segment Trigger
                      </TabsTrigger>
                      <TabsTrigger value="metric" className="text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        Metric Trigger
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="segment" className="space-y-3 mt-3">
                      <div className="p-2 rounded bg-muted/30 text-xs text-muted-foreground">
                        {flow.segmentApproach.useCase}
                      </div>
                      
                      {/* Step by Step for Segment */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium flex items-center gap-1">
                          <ListPlus className="w-3 h-3" />
                          Step 1: Crea Segmento
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <div className="text-xs">
                            <span className="text-muted-foreground">Nome:</span>
                            <code className="ml-2 bg-muted px-1 rounded">{flow.segmentApproach.segmentName}</code>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.segmentApproach.segmentName)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-start justify-between p-2 rounded bg-muted/30">
                          <div className="text-xs flex-1">
                            <span className="text-muted-foreground">Definition:</span>
                            <code className="ml-2 bg-muted px-1 rounded text-[10px] break-all">{flow.segmentApproach.definition}</code>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.segmentApproach.definition)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="text-xs font-medium flex items-center gap-1 mt-3">
                          <Target className="w-3 h-3" />
                          Step 2: Crea Flow
                        </div>
                        <div className="p-2 rounded bg-muted/30 text-xs space-y-1">
                          <div><span className="text-muted-foreground">Trigger:</span> <strong>Added to Segment</strong></div>
                          <div><span className="text-muted-foreground">Segment:</span> <strong>{flow.segmentApproach.segmentName}</strong></div>
                        </div>
                        
                        <div className="text-xs font-medium flex items-center gap-1 mt-3">
                          <HelpCircle className="w-3 h-3" />
                          Step 3: Aggiungi Flow Filter
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <code className="text-xs bg-muted px-1 rounded">{flow.segmentApproach.flowFilter}</code>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.segmentApproach.flowFilter)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="metric" className="space-y-3 mt-3">
                      <div className="p-2 rounded bg-muted/30 text-xs text-muted-foreground">
                        {flow.metricApproach.useCase}
                      </div>
                      
                      {/* Metric Approach */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Crea Flow con Metric Trigger
                        </div>
                        <div className="p-2 rounded bg-muted/30 text-xs space-y-1">
                          <div><span className="text-muted-foreground">Trigger:</span> <strong>Metric</strong></div>
                          <div className="flex items-center justify-between">
                            <div><span className="text-muted-foreground">Event:</span> <code className="bg-muted px-1 rounded">{flow.metricApproach.eventName}</code></div>
                            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.metricApproach.eventName)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="text-xs font-medium flex items-center gap-1 mt-3">
                          <HelpCircle className="w-3 h-3" />
                          Aggiungi Flow Filter
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <code className="text-xs bg-muted px-1 rounded">{flow.metricApproach.flowFilter}</code>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(flow.metricApproach.flowFilter)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <Alert className="mt-3 border-blue-500/30 bg-blue-500/5">
                          <AlertCircle className="h-3 w-3 text-blue-500" />
                          <AlertDescription className="text-xs">
                            Gli eventi <code>{flow.metricApproach.eventName}</code> vengono inviati automaticamente 
                            quando Signal Stitcher rileva l'abandonment.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex flex-wrap gap-1 pt-2 border-t">
                    <span className="text-xs text-muted-foreground mr-2">Properties disponibili:</span>
                    {flow.properties.map((prop) => (
                      <Badge 
                        key={prop} 
                        variant="outline" 
                        className="text-xs font-mono cursor-pointer hover:bg-primary/10"
                        onClick={() => copyToClipboard(prop)}
                      >
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
              {allProperties.map((prop) => (
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

          {/* How to Create Segment in Klaviyo */}
          <div className="p-3 rounded-lg bg-muted/20 border border-border space-y-2">
            <div className="text-sm font-medium">Come creare un segmento in Klaviyo:</div>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Vai in <strong>Audience → Lists & Segments</strong></li>
              <li>Click <strong>Create Segment</strong></li>
              <li>In Definition, seleziona <strong>Properties about someone</strong></li>
              <li>Cerca la property (es. <code>sf_checkout_abandoned_at</code>)</li>
              <li>Imposta la condizione (es. <code>is set</code> e <code>in the last 4 hours</code>)</li>
              <li>Salva il segmento</li>
            </ol>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
