import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, LineChart } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div 
        className="absolute inset-0 opacity-60"
        style={{ background: 'var(--gradient-glow)' }}
      />
      
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

      <div className="container relative z-10 px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-fade-in">
            <span className="w-2 h-2 bg-success rounded-full pulse-live" />
            <span className="text-sm text-muted-foreground">
              Server-side tracking for modern eCommerce
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Stop losing{" "}
            <span className="text-gradient">40% of your data</span>
            {" "}to ad blockers
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            SignalForge captures every event, stitches customer identities across devices, 
            and syncs enriched data to Klaviyo in real-time. No more blind spots.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Link to="/dashboard">
              <Button variant="hero" size="xl">
                Start Free Trial
                <ArrowRight className="ml-1" />
              </Button>
            </Link>
            <Button variant="glass" size="lg">
              View Demo
            </Button>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm">Server-side Events</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
              <LineChart className="w-4 h-4 text-accent" />
              <span className="text-sm">Identity Resolution</span>
            </div>
          </div>
        </div>

        {/* Stats section */}
        <div className="max-w-5xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="metric-card text-center">
            <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">98%</div>
            <div className="text-muted-foreground">Event Capture Rate</div>
          </div>
          <div className="metric-card text-center">
            <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">3.2x</div>
            <div className="text-muted-foreground">More Attributed Revenue</div>
          </div>
          <div className="metric-card text-center">
            <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">&lt;50ms</div>
            <div className="text-muted-foreground">Sync Latency</div>
          </div>
        </div>
      </div>
    </section>
  );
};
