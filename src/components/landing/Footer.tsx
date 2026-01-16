import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="py-16 border-t border-border">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">S</span>
              </div>
              <span className="font-semibold text-lg">SignalForge</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Server-side tracking and identity resolution for modern eCommerce.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Integrations
                </a>
              </li>
              <li>
                <a href="#changelog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Changelog
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#api" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  API Reference
                </a>
              </li>
              <li>
                <a href="#guides" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Guides
                </a>
              </li>
              <li>
                <a href="#status" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Status
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </a>
              </li>
              <li>
                <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            © 2024 SignalForge. All rights reserved.
          </p>
          <div className="flex items-center gap-6 mt-4 md:mt-0">
            <a href="#twitter" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Twitter
            </a>
            <a href="#github" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="#discord" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Discord
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
