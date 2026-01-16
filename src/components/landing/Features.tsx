import { 
  Workflow, 
  Users, 
  Sparkles, 
  Send, 
  BarChart3, 
  Lock 
} from "lucide-react";

const features = [
  {
    icon: Workflow,
    title: "Server-Side Pipeline",
    description: "Capture events directly from your server and Shopify webhooks. Bypass ad blockers, ITP, and consent restrictions.",
  },
  {
    icon: Users,
    title: "Identity Resolution",
    description: "Stitch anonymous sessions, emails, phones, and customer IDs into unified profiles. One customer, complete history.",
  },
  {
    icon: Sparkles,
    title: "Smart Enrichment",
    description: "Auto-enrich events with product categories, margin data, intent scores, and behavioral signals.",
  },
  {
    icon: Send,
    title: "Klaviyo Sync",
    description: "Real-time profile upserts and custom events. Enable flows like 'High Intent Browser' and 'Category Re-engagement'.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Monitor ingestion rates, sync success, event lag, and data quality in real-time.",
  },
  {
    icon: Lock,
    title: "Privacy First",
    description: "GDPR-ready with consent-aware processing, data minimization, and full DSAR support.",
  },
];

export const Features = () => {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-grid opacity-20" />
      
      <div className="container relative z-10 px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to{" "}
            <span className="text-gradient">own your data</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A complete toolkit for accurate tracking, identity stitching, and smart syncing to your marketing stack.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="metric-card group hover:border-primary/50 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
