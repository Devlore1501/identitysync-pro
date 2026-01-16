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
  CheckCircle2
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
  { id: "workspace", title: "Configura Workspace", icon: Globe },
  { id: "install", title: "Installa Pixel", icon: Code },
  { id: "verify", title: "Verifica", icon: Check },
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
      setCurrentStep(1);
    } catch (error) {
      toast.error("Errore nel salvataggio");
    }
    setIsLoading(false);
  };

  const handleVerify = async () => {
    setVerificationStatus("checking");
    
    // Simulate verification (in production this would check for real events)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // For demo, randomly succeed or fail
    const success = Math.random() > 0.3;
    setVerificationStatus(success ? "success" : "failed");
    
    if (success) {
      toast.success("Pixel verificato con successo!");
    } else {
      toast.error("Nessun evento rilevato. Verifica l'installazione.");
    }
  };

  const handleComplete = () => {
    toast.success("Onboarding completato! 🎉");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container px-4 py-4 flex items-center justify-between">
          <div className="font-bold text-xl">IdentitySync</div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            Salta per ora
          </Button>
        </div>
      </header>

      <main className="container px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-2 ${
                      isActive ? "text-primary" : isCompleted ? "text-green-500" : "text-muted-foreground"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? "bg-primary text-primary-foreground" : 
                      isCompleted ? "bg-green-500 text-white" : "bg-muted"
                    }`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium hidden sm:block">{step.title}</span>
                  </div>
                );
              })}
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Content */}
          <Card className="animate-fade-in">
            {/* Step 1: Workspace Setup */}
            {currentStep === 0 && (
              <>
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2">Step 1 di 4</Badge>
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
                  
                  <Button onClick={handleSaveWorkspace} className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Continua
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </>
            )}

            {/* Step 2: Install Pixel */}
            {currentStep === 1 && (
              <>
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2">Step 2 di 4</Badge>
                  <CardTitle>Installa il Pixel</CardTitle>
                  <CardDescription>
                    Aggiungi questo codice al tuo sito, prima del tag &lt;/head&gt;.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="relative">
                    <pre className="p-4 rounded-lg bg-muted text-sm overflow-x-auto">
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
                      <h4 className="font-medium mb-2">📋 Per Shopify:</h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Vai su Online Store → Themes → Edit code</li>
                        <li>Apri theme.liquid</li>
                        <li>Incolla lo snippet prima di &lt;/head&gt;</li>
                        <li>Salva</li>
                      </ol>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <Button className="flex-1" onClick={() => setCurrentStep(2)}>
                      Ho installato il pixel
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 3: Verify */}
            {currentStep === 2 && (
              <>
                <CardHeader>
                  <Badge variant="outline" className="w-fit mb-2">Step 3 di 4</Badge>
                  <CardTitle>Verifica Installazione</CardTitle>
                  <CardDescription>
                    Visita il tuo sito e verifica che il pixel stia raccogliendo eventi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center justify-center py-8">
                    {verificationStatus === "idle" && (
                      <>
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Globe className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-center text-muted-foreground mb-4">
                          Visita il tuo sito in una nuova scheda, poi clicca "Verifica".
                        </p>
                        {domain && (
                          <Button variant="outline" asChild className="mb-4">
                            <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">
                              Apri {domain}
                              <ExternalLink className="w-4 h-4 ml-2" />
                            </a>
                          </Button>
                        )}
                      </>
                    )}
                    
                    {verificationStatus === "checking" && (
                      <>
                        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                        <p className="text-center text-muted-foreground">
                          Verificando installazione...
                        </p>
                      </>
                    )}
                    
                    {verificationStatus === "success" && (
                      <>
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                          <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <p className="text-center font-medium text-green-500">
                          Pixel installato correttamente!
                        </p>
                      </>
                    )}
                    
                    {verificationStatus === "failed" && (
                      <>
                        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                          <Globe className="w-8 h-8 text-destructive" />
                        </div>
                        <p className="text-center text-destructive mb-2">
                          Nessun evento rilevato
                        </p>
                        <p className="text-center text-sm text-muted-foreground">
                          Verifica che lo snippet sia stato inserito correttamente.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    {verificationStatus === "success" ? (
                      <Button className="flex-1" onClick={() => setCurrentStep(3)}>
                        Continua
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <Button 
                        className="flex-1" 
                        onClick={handleVerify}
                        disabled={verificationStatus === "checking"}
                      >
                        {verificationStatus === "failed" ? "Riprova" : "Verifica"}
                      </Button>
                    )}
                  </div>
                  
                  {verificationStatus !== "success" && (
                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => setCurrentStep(3)}
                    >
                      Salta verifica
                    </Button>
                  )}
                </CardContent>
              </>
            )}

            {/* Step 4: Done */}
            {currentStep === 3 && (
              <>
                <CardHeader className="text-center">
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-10 h-10 text-green-500" />
                  </div>
                  <CardTitle className="text-2xl">Sei pronto! 🎉</CardTitle>
                  <CardDescription>
                    Il tuo workspace è configurato e pronto per raccogliere dati.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <Check className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Workspace configurato</div>
                        <div className="text-sm text-muted-foreground">{workspaceName}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <Check className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium">Pixel pronto</div>
                        <div className="text-sm text-muted-foreground">
                          {verificationStatus === "success" ? "Verificato e funzionante" : "In attesa di eventi"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <h4 className="font-medium mb-2">🚀 Prossimi passi:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Collega la tua prima destination (es. Klaviyo)</li>
                      <li>Configura il tracciamento eventi e-commerce</li>
                      <li>Esplora la dashboard analytics</li>
                    </ul>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleComplete}>
                    Vai alla Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
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
