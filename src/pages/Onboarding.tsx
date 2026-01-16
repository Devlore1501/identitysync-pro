import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Globe, 
  Code, 
  Zap, 
  Loader2,
  Copy,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Users,
  Target,
  TrendingUp,
  Mail,
  ShoppingCart,
  Eye,
  UserCheck,
  Send
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useUpdateWorkspace } from "@/hooks/useWorkspaceSettings";
import { toast } from "sonner";

const STEPS = [
  { id: "welcome", title: "Benvenuto", icon: Sparkles },
  { id: "how-it-works", title: "Come Funziona", icon: Target },
  { id: "workspace", title: "Workspace", icon: Globe },
  { id: "install", title: "Pixel", icon: Code },
  { id: "destination", title: "Destination", icon: Send },
  { id: "done", title: "Completato", icon: Zap },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { currentWorkspace, refetch } = useWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "checking" | "success" | "failed">("idle");
  
  // Form state
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || "");
  const [domain, setDomain] = useState(currentWorkspace?.domain || "");
  const [platform, setPlatform] = useState(currentWorkspace?.platform || "shopify");
  const [destinationType, setDestinationType] = useState<"klaviyo" | "skip">("klaviyo");

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const pixelSnippet = `<!-- IdentitySync Pixel -->
<script>
  (function(w,d,s,id){
    w.isq=w.isq||[];
    var js,fjs=d.getElementsByTagName(s)[0];
    if(d.getElementById(id))return;
    js=d.createElement(s);js.id=id;
    js.src='https://cdn.identitysync.dev/pixel.js';
    js.async=true;
    fjs.parentNode.insertBefore(js,fjs);
    w.isq.push(['init','${currentWorkspace?.id || 'YOUR_WORKSPACE_ID'}']);
  })(window,document,'script','is-pixel');
</script>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(pixelSnippet);
    setCopied(true);
    toast.success("Snippet copiato!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error("Inserisci un nome per il workspace");
      return;
    }
    
    setIsLoading(true);
    try {
      await updateWorkspace.mutateAsync({
        name: workspaceName,
        domain: domain || null,
        platform: platform || null,
      });
      await refetch();
      setCurrentStep(3);
    } catch (error) {
      toast.error("Errore nel salvataggio");
    }
    setIsLoading(false);
  };

  const handleComplete = () => {
    toast.success("Onboarding completato! 🎉");
    navigate("/dashboard");
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-10">
        <div className="container px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">IdentitySync</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            Salta per ora
          </Button>
        </div>
      </header>

      <main className="container px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 overflow-x-auto pb-2">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-2 flex-shrink-0 ${
                      isActive ? "text-primary" : isCompleted ? "text-green-500" : "text-muted-foreground"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isActive ? "bg-primary text-primary-foreground scale-110" : 
                      isCompleted ? "bg-green-500 text-white" : "bg-muted"
                    }`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-medium hidden lg:block">{step.title}</span>
                    {index < STEPS.length - 1 && (
                      <div className={`w-8 h-0.5 mx-1 hidden sm:block ${
                        isCompleted ? "bg-green-500" : "bg-muted"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Step {currentStep + 1} di {STEPS.length}
            </p>
          </div>

          {/* Step Content */}
          <Card className="animate-fade-in border-border/50 shadow-xl">
            
            {/* Step 0: Welcome */}
            {currentStep === 0 && (
              <>
                <CardHeader className="text-center pb-2">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Sparkles className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl">Benvenuto in IdentitySync! 🎉</CardTitle>
                  <CardDescription className="text-base mt-2">
                    Trasforma visitatori anonimi in clienti identificati e aumenta le tue conversioni.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="font-semibold">Identifica Visitatori Anonimi</div>
                        <div className="text-sm text-muted-foreground">
                          Riconosci gli utenti che ritornano, anche senza login, unificando cookie, email e device.
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <Target className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <div className="font-semibold">Scoring Comportamentale</div>
                        <div className="text-sm text-muted-foreground">
                          Calcola l'intent score basato su page view, add to cart e checkout per prioritizzare i contatti.
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <div className="font-semibold">Sync Automatico con Klaviyo</div>
                        <div className="text-sm text-muted-foreground">
                          I profili high-intent vengono sincronizzati automaticamente per trigger email personalizzate.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-sm text-center">
                      <span className="font-medium">In soli 5 minuti</span> configurerai tutto il necessario per iniziare a recuperare vendite perse.
                    </p>
                  </div>
                  
                  <Button onClick={nextStep} className="w-full" size="lg">
                    Iniziamo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </>
            )}

            {/* Step 1: How It Works */}
            {currentStep === 1 && (
              <>
                <CardHeader className="text-center pb-2">
                  <Badge variant="outline" className="w-fit mx-auto mb-2">Come Funziona</Badge>
                  <CardTitle className="text-xl md:text-2xl">Il Flusso di IdentitySync</CardTitle>
                  <CardDescription>
                    Ecco come trasformiamo i visitatori anonimi in vendite.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Visual Funnel */}
                  <div className="relative">
                    {/* Step 1 */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Eye className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">1</Badge>
                          <span className="font-semibold">Visitatore naviga</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Il pixel traccia page view, prodotti visti, tempo sulla pagina
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-muted-foreground/50">→</div>
                    </div>
                    
                    <div className="w-0.5 h-4 bg-border mx-auto" />
                    
                    {/* Step 2 */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
                      <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="w-6 h-6 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">2</Badge>
                          <span className="font-semibold">Aggiunge al carrello</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          L'intent score sale, il profilo diventa "warm"
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-muted-foreground/50">→</div>
                    </div>
                    
                    <div className="w-0.5 h-4 bg-border mx-auto" />
                    
                    {/* Step 3 */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
                      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <UserCheck className="w-6 h-6 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">3</Badge>
                          <span className="font-semibold">Identità unificata</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Cookie + email + phone → profilo unico
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-muted-foreground/50">→</div>
                    </div>
                    
                    <div className="w-0.5 h-4 bg-border mx-auto" />
                    
                    {/* Step 4 */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-6 h-6 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-green-500">4</Badge>
                          <span className="font-semibold text-green-600 dark:text-green-400">Sync → Email automatica</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Klaviyo riceve i dati e invia email di recupero personalizzata
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-green-500">💰</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                    <div className="text-2xl font-bold text-primary mb-1">+15-25%</div>
                    <p className="text-sm text-muted-foreground">
                      Recupero medio carrelli abbandonati con IdentitySync
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={prevStep}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <Button onClick={nextStep} className="flex-1">
                      Configuriamo il Workspace
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 2: Workspace Setup */}
            {currentStep === 2 && (
              <>
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2">Configurazione</Badge>
                  <CardTitle>Configura il tuo Workspace</CardTitle>
                  <CardDescription>
                    Inserisci le informazioni del tuo sito per iniziare a raccogliere dati.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nome Workspace</label>
                    <Input
                      placeholder="Il Mio E-commerce"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Usalo per distinguere diversi progetti o brand
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Dominio Sito</label>
                    <Input
                      placeholder="www.miosito.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Piattaforma</label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona piattaforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shopify">Shopify</SelectItem>
                        <SelectItem value="woocommerce">WooCommerce</SelectItem>
                        <SelectItem value="magento">Magento</SelectItem>
                        <SelectItem value="prestashop">PrestaShop</SelectItem>
                        <SelectItem value="custom">Altro / Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={prevStep}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <Button onClick={handleSaveWorkspace} className="flex-1" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Salva e Continua
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 3: Install Pixel */}
            {currentStep === 3 && (
              <>
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2">Installazione</Badge>
                  <CardTitle>Installa il Pixel</CardTitle>
                  <CardDescription>
                    Aggiungi questo codice al tuo sito, prima del tag &lt;/head&gt;.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="relative">
                    <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto border">
                      <code>{pixelSnippet}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleCopySnippet}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  {platform === "shopify" && (
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <img src="https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-primary-logo-456baa801ee66a0a435671082365958316831c9960c480451dd0330bcdae304f.svg" alt="Shopify" className="h-4" />
                        Istruzioni per Shopify:
                      </h4>
                      <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                        <li>Vai su <strong>Online Store → Themes</strong></li>
                        <li>Clicca <strong>⋮ → Edit code</strong></li>
                        <li>Apri <strong>theme.liquid</strong></li>
                        <li>Incolla lo snippet prima di <code className="bg-muted px-1 rounded">&lt;/head&gt;</code></li>
                        <li>Clicca <strong>Save</strong></li>
                      </ol>
                    </div>
                  )}

                  {platform === "woocommerce" && (
                    <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <h4 className="font-medium mb-2">🟣 Istruzioni per WooCommerce:</h4>
                      <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                        <li>Vai su <strong>Aspetto → Editor del tema</strong></li>
                        <li>Seleziona <strong>header.php</strong></li>
                        <li>Incolla lo snippet prima di <code className="bg-muted px-1 rounded">&lt;/head&gt;</code></li>
                        <li>Oppure usa un plugin come <strong>Insert Headers and Footers</strong></li>
                      </ol>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={prevStep}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <Button className="flex-1" onClick={nextStep}>
                      Ho installato il pixel
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 4: Destination */}
            {currentStep === 4 && (
              <>
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2">Integrazione</Badge>
                  <CardTitle>Collega una Destination</CardTitle>
                  <CardDescription>
                    Dove vuoi sincronizzare i profili identificati?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <button
                      type="button"
                      onClick={() => setDestinationType("klaviyo")}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        destinationType === "klaviyo" 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#111] flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">K</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold flex items-center gap-2">
                          Klaviyo
                          <Badge variant="secondary" className="text-xs">Consigliato</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Sincronizza profili con intent score, eventi comportamentali e trigger automatici.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">Browse Abandonment</Badge>
                          <Badge variant="outline" className="text-xs">Cart Abandonment</Badge>
                          <Badge variant="outline" className="text-xs">Checkout Abandonment</Badge>
                        </div>
                      </div>
                      {destinationType === "klaviyo" && (
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDestinationType("skip")}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        destinationType === "skip" 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <ArrowRight className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Configura dopo</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Vai alla dashboard e configura le destination in seguito dalle impostazioni.
                        </p>
                      </div>
                      {destinationType === "skip" && (
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  </div>

                  {destinationType === "klaviyo" && (
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <p className="text-sm text-muted-foreground">
                        👉 Potrai configurare la tua API Key di Klaviyo dalle <strong>Impostazioni → Destinations</strong> dopo aver completato l'onboarding.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={prevStep}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <Button className="flex-1" onClick={nextStep}>
                      Continua
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 5: Done */}
            {currentStep === 5 && (
              <>
                <CardHeader className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <CardTitle className="text-2xl">Sei pronto! 🚀</CardTitle>
                  <CardDescription>
                    Il tuo workspace è configurato e pronto per raccogliere dati.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <Check className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="font-medium">Workspace:</span>{" "}
                        <span className="text-muted-foreground">{workspaceName || currentWorkspace?.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <Check className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="font-medium">Pixel:</span>{" "}
                        <span className="text-muted-foreground">Pronto per l'installazione</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <Check className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="font-medium">Destination:</span>{" "}
                        <span className="text-muted-foreground">
                          {destinationType === "klaviyo" ? "Klaviyo (da configurare)" : "Da configurare"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Prossimi passi nella Dashboard:
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
                        <span>Verifica che il pixel stia ricevendo eventi in <strong>Events</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
                        <span>Collega Klaviyo in <strong>Destinations</strong> con la tua Private API Key</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
                        <span>Crea i Flow di recupero su Klaviyo usando le proprietà <code className="bg-muted px-1 rounded text-xs">sf_*</code></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-medium">4</span>
                        <span>Monitora i risultati nel <strong>Value Metric</strong> sulla dashboard</span>
                      </li>
                    </ul>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleComplete}>
                    <Zap className="w-4 h-4 mr-2" />
                    Vai alla Dashboard
                  </Button>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default OnboardingPage;