import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    price: "€99",
    period: "/month",
    description: "For growing stores getting started with server-side tracking",
    events: "200K events/mo",
    features: [
      "Server-side event collection",
      "Basic identity stitching",
      "Klaviyo sync",
      "7-day event retention",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Growth",
    price: "€249",
    period: "/month",
    description: "For scaling stores that need full identity resolution",
    events: "1M events/mo",
    features: [
      "Everything in Starter",
      "Advanced identity graph",
      "Custom event enrichment",
      "30-day event retention",
      "Webhook integrations",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Pro",
    price: "€499",
    period: "/month",
    description: "For high-volume stores requiring enterprise features",
    events: "3M events/mo",
    features: [
      "Everything in Growth",
      "Real-time dashboards",
      "Custom destinations",
      "90-day event retention",
      "Backfill & replay",
      "Dedicated support",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export const Pricing = () => {
  return (
    <section className="py-24 relative">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, transparent <span className="text-gradient">pricing</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Pay only for what you use. Start free, scale as you grow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={plan.name}
              className={`relative rounded-2xl p-8 animate-fade-in ${
                plan.popular 
                  ? 'bg-gradient-to-b from-primary/10 to-transparent border-2 border-primary/50 scale-105' 
                  : 'bg-card border border-border'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-6 py-3 px-4 rounded-lg bg-muted/50 text-center">
                <span className="text-sm font-medium">{plan.events}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link to="/pricing">
                <Button 
                  variant={plan.popular ? "hero" : "outline"} 
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Need more? Overage is just €5 per 100K events.
        </p>
      </div>
    </section>
  );
};
