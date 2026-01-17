import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sparkles,
  Send,
  RefreshCw,
  Search,
  ShoppingCart,
  CreditCard,
  Eye,
  AlertTriangle,
  Target,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Filter,
  Play,
  Pause,
  ExternalLink,
  TrendingUp,
  Users,
  Mail
} from 'lucide-react';
import { usePredictiveSignals, usePredictiveSignalStats, useRunPredictiveEngine } from '@/hooks/usePredictiveSignals';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Flow configurations with their trigger signals
const FLOW_CONFIG: Record<string, {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  triggerSignals: string[];
}> = {
  high_intent_cart_flow: {
    name: 'Cart High Intent',
    description: 'Utenti con alto intent che hanno aggiunto al carrello ma non acquistato',
    icon: ShoppingCart,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    triggerSignals: ['high_intent_cart'],
  },
  checkout_urgency_flow: {
    name: 'Checkout Urgente',
    description: 'Utenti che hanno iniziato checkout ma non completato',
    icon: CreditCard,
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    triggerSignals: ['checkout_urgency'],
  },
  browse_abandonment_flow: {
    name: 'Browse Warming',
    description: 'Utenti che navigano molto ma non aggiungono al carrello',
    icon: Eye,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    triggerSignals: ['browse_warming'],
  },
  churn_prevention_flow: {
    name: 'Churn Prevention',
    description: 'Utenti a rischio abbandono da riattivare',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    triggerSignals: ['churn_risk'],
  },
  category_nurture_flow: {
    name: 'Category Nurture',
    description: 'Utenti interessati a categorie specifiche',
    icon: Target,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    triggerSignals: ['category_interest'],
  },
  purchase_ready_flow: {
    name: 'About to Purchase',
    description: 'Utenti pronti all\'acquisto da convertire',
    icon: Zap,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    triggerSignals: ['about_to_purchase'],
  },
};

const SIGNAL_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}> = {
  high_intent_cart: {
    icon: ShoppingCart,
    label: 'Cart High Intent',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
  },
  checkout_urgency: {
    icon: CreditCard,
    label: 'Checkout Urgente',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
  },
  browse_warming: {
    icon: Eye,
    label: 'Browse Warming',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
  },
  churn_risk: {
    icon: AlertTriangle,
    label: 'Churn Risk',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
  },
  category_interest: {
    icon: Target,
    label: 'Category Interest',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
  },
  about_to_purchase: {
    icon: Zap,
    label: 'About to Purchase',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
  },
};

function useSyncToKlaviyo() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.functions.invoke('sync-klaviyo', {
        body: { workspace_id: currentWorkspace.id }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['predictive-signals'] });
      queryClient.invalidateQueries({ queryKey: ['predictive-signal-stats'] });
      
      const synced = data?.profiles_updated || 0;
      const flowsTriggered = data?.flows_triggered || 0;
      toast.success(`Sincronizzati ${synced} profili, ${flowsTriggered} flow attivati`);
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast.error('Errore durante sincronizzazione Klaviyo');
    }
  });
}

export default function FlowsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSignalType, setSelectedSignalType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: signals, isLoading: signalsLoading } = usePredictiveSignals();
  const { data: stats, isLoading: statsLoading } = usePredictiveSignalStats();
  const runEngine = useRunPredictiveEngine();
  const syncKlaviyo = useSyncToKlaviyo();

  const isLoading = signalsLoading || statsLoading;

  // Filter signals
  const filteredSignals = (signals || []).filter(signal => {
    const matchesSearch = searchQuery === '' || 
      signal.signal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      signal.signal_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedSignalType || signal.signal_type === selectedSignalType;
    return matchesSearch && matchesType;
  });

  // Group signals by type for overview
  const signalsByType = (signals || []).reduce((acc, signal) => {
    if (!acc[signal.signal_type]) {
      acc[signal.signal_type] = { total: 0, synced: 0, pending: 0, triggered: 0 };
    }
    acc[signal.signal_type].total++;
    
    const syncedTo = signal.synced_to as Record<string, string | null>;
    if (syncedTo && Object.values(syncedTo).some(v => v !== null)) {
      acc[signal.signal_type].synced++;
    }
    if (signal.should_trigger_flow && !signal.flow_triggered_at) {
      acc[signal.signal_type].pending++;
    }
    if (signal.flow_triggered_at) {
      acc[signal.signal_type].triggered++;
    }
    return acc;
  }, {} as Record<string, { total: number; synced: number; pending: number; triggered: number }>);

  const handleRunEngine = async () => {
    try {
      await runEngine.mutateAsync();
    } catch (e) {
      // Error handled in hook
    }
  };

  const handleSync = async () => {
    try {
      await syncKlaviyo.mutateAsync();
    } catch (e) {
      // Error handled in hook
    }
  };

  const pendingSync = (stats?.total || 0) - (stats?.synced || 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Flow Klaviyo
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestisci i segnali predittivi e i flow che triggerano
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRunEngine}
              disabled={runEngine.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${runEngine.isPending ? 'animate-spin' : ''}`} />
              Ricalcola Segnali
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncKlaviyo.isPending || pendingSync === 0}
            >
              <Send className={`w-4 h-4 mr-2 ${syncKlaviyo.isPending ? 'animate-pulse' : ''}`} />
              Sincronizza Klaviyo
              {pendingSync > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingSync}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Segnali Totali</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Sincronizzati</span>
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">{stats?.synced || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-muted-foreground">Flow Pronti</span>
              </div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{stats?.pending_flows || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Flow Attivati</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {(signals || []).filter(s => s.flow_triggered_at).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Confidenza Media</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats?.avg_confidence || 0}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview Flow</TabsTrigger>
            <TabsTrigger value="signals">Tutti i Segnali</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4">
              {Object.entries(FLOW_CONFIG).map(([flowId, flow]) => {
                const signalType = flow.triggerSignals[0];
                const typeStats = signalsByType[signalType] || { total: 0, synced: 0, pending: 0, triggered: 0 };
                const Icon = flow.icon;
                const hasSignals = typeStats.total > 0;

                return (
                  <Card key={flowId} className={hasSignals ? '' : 'opacity-60'}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${flow.bgColor}`}>
                            <Icon className={`w-6 h-6 ${flow.color}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold flex items-center gap-2">
                              {flow.name}
                              {hasSignals && (
                                <Badge variant="secondary" className="text-xs">
                                  {typeStats.total} utenti
                                </Badge>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {flow.description}
                            </p>
                            <div className="flex items-center gap-4 mt-3 text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>{typeStats.synced} sincronizzati</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                <span>{typeStats.pending} pronti</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>{typeStats.triggered} triggerati</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {typeStats.pending > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedSignalType(signalType);
                                setActiveTab('signals');
                              }}
                            >
                              <ArrowUpRight className="w-4 h-4 mr-1" />
                              Vedi Segnali
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Klaviyo Integration Info */}
            <Card className="mt-6 border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Integrazione Klaviyo
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  I segnali predittivi vengono sincronizzati come <strong>proprietà profilo</strong> su Klaviyo:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><code className="text-xs bg-muted px-1 rounded">sf_predicted_action</code> - Tipo di segnale predittivo</li>
                  <li><code className="text-xs bg-muted px-1 rounded">sf_predicted_confidence</code> - Livello di confidenza 0-100</li>
                  <li><code className="text-xs bg-muted px-1 rounded">sf_is_high_intent_cart</code> - Flag per segmentazione</li>
                  <li><code className="text-xs bg-muted px-1 rounded">sf_predicted_at</code> - Timestamp del segnale</li>
                </ul>
                <p className="mt-3">
                  Quando un segnale ha <strong>should_trigger_flow = true</strong>, viene inviato un evento 
                  che può attivare un flow Klaviyo (es. <code className="text-xs bg-muted px-1 rounded">SignalForge: High Intent Cart</code>).
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals" className="mt-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca segnali..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={selectedSignalType === null ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSignalType(null)}
                >
                  Tutti
                </Button>
                {Object.entries(SIGNAL_CONFIG).map(([type, config]) => {
                  const count = signalsByType[type]?.total || 0;
                  if (count === 0) return null;
                  const Icon = config.icon;
                  return (
                    <Button
                      key={type}
                      variant={selectedSignalType === type ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedSignalType(type)}
                      className="gap-1.5"
                    >
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      {config.label}
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Signals Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredSignals.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nessun segnale trovato</p>
                    <p className="text-sm mt-1">Clicca "Ricalcola Segnali" per generare nuovi segnali predittivi</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo Segnale</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Confidenza</TableHead>
                        <TableHead>Flow</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Aggiornato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSignals.slice(0, 50).map((signal) => {
                        const config = SIGNAL_CONFIG[signal.signal_type] || {
                          icon: Target,
                          label: signal.signal_type,
                          color: 'text-muted-foreground',
                          bgColor: 'bg-muted',
                        };
                        const Icon = config.icon;
                        const syncedTo = signal.synced_to as Record<string, string | null>;
                        const isSynced = syncedTo && Object.values(syncedTo).some(v => v !== null);

                        return (
                          <TableRow key={signal.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded ${config.bgColor}`}>
                                  <Icon className={`w-4 h-4 ${config.color}`} />
                                </div>
                                <span className="text-sm font-medium">{config.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{signal.signal_name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${signal.confidence}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{signal.confidence}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {signal.flow_name ? (
                                <Badge variant="outline" className="text-xs">
                                  {signal.flow_name}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {signal.flow_triggered_at ? (
                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  <Mail className="w-3 h-3 mr-1" />
                                  Triggerato
                                </Badge>
                              ) : isSynced ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Sincronizzato
                                </Badge>
                              ) : signal.should_trigger_flow ? (
                                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pronto
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  In attesa
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(signal.updated_at), { addSuffix: true, locale: it })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {filteredSignals.length > 50 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Mostrati 50 di {filteredSignals.length} segnali
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
