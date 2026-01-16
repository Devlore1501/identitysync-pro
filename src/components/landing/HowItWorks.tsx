import { ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Install Snippet",
    description: "Add our lightweight JS snippet or configure Shopify webhooks. Takes 5 minutes.",
    color: "primary",
  },
  {
    number: "02", 
    title: "Capture Events",
    description: "Page views, product views, add-to-cart, checkouts, and purchases flow into your pipeline.",
    color: "accent",
  },
  {
    number: "03",
    title: "Stitch Identities",
    description: "Our identity graph links anonymous visitors to known customers across sessions and devices.",
    color: "success",
  },
  {
    number: "04",
    title: "Sync to Klaviyo",
    description: "Enriched profiles and events sync in real-time, powering precise segments and flows.",
    color: "info",
  },
];

export const HowItWorks = () => {
  return (
    <section className="py-24 bg-surface-raised">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How it <span className="text-gradient">works</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From raw events to actionable customer profiles in four simple steps.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border hidden md:block" />

            <div className="space-y-12">
              {steps.map((step, index) => (
                <div 
                  key={step.number}
                  className="relative flex items-start gap-6 animate-fade-in"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {/* Number badge */}
                  <div className="relative z-10 flex-shrink-0 w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
                    <span className="text-2xl font-bold text-gradient">{step.number}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-2">
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>

                  {/* Arrow for desktop */}
                  {index < steps.length - 1 && (
                    <ArrowRight className="hidden lg:block absolute -bottom-8 left-7 w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
