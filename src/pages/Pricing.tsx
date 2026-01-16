import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Globe, Zap, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { PLANS, OVERAGE_PRICE } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";

const PricingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSelectPlan = (planId: string) => {
    if (user) {
      navigate(`/checkout/${planId}`);
    } else {
      navigate(`/auth?redirect=/checkout/${planId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="py-24">
        <div className="container px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Prezzi Trasparenti
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Scegli il piano giusto per il tuo <span className="text-gradient">business</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Paga solo per quello che usi. Inizia con trial gratuito, scala quando cresci.
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
            {PLANS.map((plan, index) => (
              <div 
                key={plan.id}
                className={`relative rounded-2xl p-8 animate-fade-in ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-primary/10 to-transparent border-2 border-primary/50 scale-105 z-10' 
                    : 'bg-card border border-border'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1 bg-primary text-primary-foreground">
                      Più Popolare
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-bold">€{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Limits */}
                <div className="mb-6 space-y-2">
                  <div className="py-2 px-4 rounded-lg bg-muted/50 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{plan.eventsLabel}</span>
                  </div>
                  <div className="py-2 px-4 rounded-lg bg-muted/50 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{plan.workspacesLabel}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  variant={plan.popular ? "hero" : "outline"} 
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ))}
          </div>

          {/* Overage Info */}
          <div className="text-center mb-16">
            <p className="text-sm text-muted-foreground">
              Hai bisogno di più eventi? Overage a soli <strong>€{OVERAGE_PRICE} per 100K eventi</strong>.
            </p>
          </div>

          {/* FAQ / Trust Signals */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Domande Frequenti</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Posso cambiare piano?</h3>
                <p className="text-sm text-muted-foreground">
                  Sì, puoi fare upgrade o downgrade in qualsiasi momento. Le modifiche si applicano al prossimo ciclo di fatturazione.
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Come funziona il trial?</h3>
                <p className="text-sm text-muted-foreground">
                  14 giorni gratuiti con tutte le funzionalità. Nessuna carta richiesta per iniziare.
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Cosa succede se supero i limiti?</h3>
                <p className="text-sm text-muted-foreground">
                  Continui a raccogliere dati normalmente. Gli eventi extra vengono addebitati a €5/100K alla fine del mese.
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border">
                <h3 className="font-semibold mb-2">Posso disdire?</h3>
                <p className="text-sm text-muted-foreground">
                  Cancella in qualsiasi momento. I tuoi dati restano accessibili fino alla fine del periodo pagato.
                </p>
              </div>
            </div>
          </div>

          {/* Enterprise CTA */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm">
                Hai esigenze enterprise? <Link to="/contact" className="text-primary font-medium hover:underline">Contattaci</Link>
              </span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PricingPage;
