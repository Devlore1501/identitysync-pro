import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, CreditCard, Lock, Loader2, Shield } from "lucide-react";
import { PLANS, getPlanById, OVERAGE_PRICE } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CheckoutPage = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const plan = getPlanById(planId || "starter") || PLANS[0];
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingInfo, setBillingInfo] = useState({
    companyName: "",
    vatNumber: "",
    address: "",
    city: "",
    postalCode: "",
    country: "IT",
  });
  
  // Mock card info (UI only)
  const [cardInfo, setCardInfo] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      navigate(`/auth?redirect=/checkout/${planId}`);
      return;
    }
    
    setIsProcessing(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In production, this would create a Stripe checkout session
    toast.success("Piano attivato con successo!", {
      description: "Il tuo account è stato aggiornato al piano " + plan.name,
    });
    
    setIsProcessing(false);
    navigate("/dashboard/settings?tab=billing");
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container px-4 py-4 flex items-center justify-between">
          <Link to="/pricing" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Torna ai piani
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            Pagamento sicuro
          </div>
        </div>
      </header>

      <main className="container px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8">
            {/* Order Summary */}
            <div className="md:col-span-2 order-2 md:order-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Riepilogo Ordine
                    {plan.popular && (
                      <Badge variant="default">Più Popolare</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-2xl font-bold">{plan.name}</div>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Eventi inclusi</span>
                      <span>{plan.eventsLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Siti inclusi</span>
                      <span>{plan.workspacesLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Retention dati</span>
                      <span>{plan.retentionDays} giorni</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Totale mensile</span>
                      <span className="font-bold">€{plan.price}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Overage: €{OVERAGE_PRICE}/100K eventi extra
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      14 giorni di trial gratuito
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Non ti verrà addebitato nulla oggi
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Checkout Form */}
            <div className="md:col-span-3 order-1 md:order-2">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Account Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>
                      {user ? `Loggato come ${profile?.email || user.email}` : "Crea un account o accedi"}
                    </CardDescription>
                  </CardHeader>
                  {!user && (
                    <CardContent>
                      <Button variant="outline" asChild className="w-full">
                        <Link to={`/auth?redirect=/checkout/${planId}`}>
                          Accedi o Registrati
                        </Link>
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Billing Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Dati di Fatturazione</CardTitle>
                    <CardDescription>Per la fattura elettronica</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Ragione Sociale</label>
                        <Input
                          placeholder="La Tua Azienda Srl"
                          value={billingInfo.companyName}
                          onChange={(e) => setBillingInfo({ ...billingInfo, companyName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Partita IVA</label>
                        <Input
                          placeholder="IT12345678901"
                          value={billingInfo.vatNumber}
                          onChange={(e) => setBillingInfo({ ...billingInfo, vatNumber: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Indirizzo</label>
                      <Input
                        placeholder="Via Roma 1"
                        value={billingInfo.address}
                        onChange={(e) => setBillingInfo({ ...billingInfo, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Città</label>
                        <Input
                          placeholder="Milano"
                          value={billingInfo.city}
                          onChange={(e) => setBillingInfo({ ...billingInfo, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">CAP</label>
                        <Input
                          placeholder="20100"
                          value={billingInfo.postalCode}
                          onChange={(e) => setBillingInfo({ ...billingInfo, postalCode: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Paese</label>
                        <Input
                          value="Italia"
                          disabled
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment (Mock UI) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Metodo di Pagamento
                    </CardTitle>
                    <CardDescription>I dati sono protetti con crittografia SSL</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Numero Carta</label>
                      <Input
                        placeholder="4242 4242 4242 4242"
                        value={cardInfo.number}
                        onChange={(e) => setCardInfo({ ...cardInfo, number: formatCardNumber(e.target.value) })}
                        maxLength={19}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Scadenza</label>
                        <Input
                          placeholder="MM/YY"
                          value={cardInfo.expiry}
                          onChange={(e) => setCardInfo({ ...cardInfo, expiry: formatExpiry(e.target.value) })}
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">CVC</label>
                        <Input
                          placeholder="123"
                          value={cardInfo.cvc}
                          onChange={(e) => setCardInfo({ ...cardInfo, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                          maxLength={4}
                          type="password"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Nome sulla Carta</label>
                      <Input
                        placeholder="Mario Rossi"
                        value={cardInfo.name}
                        onChange={(e) => setCardInfo({ ...cardInfo, name: e.target.value })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Submit */}
                <div className="space-y-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isProcessing || !user}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Elaborazione...
                      </>
                    ) : (
                      <>
                        Inizia Trial Gratuito di 14 Giorni
                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      SSL Sicuro
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      PCI Compliant
                    </div>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Cliccando "Inizia Trial" accetti i{" "}
                    <Link to="/terms" className="underline">Termini di Servizio</Link>
                    {" "}e l'
                    <Link to="/privacy" className="underline">Informativa Privacy</Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutPage;
