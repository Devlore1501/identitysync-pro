import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Send, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Events", icon: Activity, href: "/dashboard/events" },
  { label: "Identities", icon: Users, href: "/dashboard/identities" },
  { label: "Destinations", icon: Send, href: "/dashboard/destinations" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            {!collapsed && <span className="font-semibold">SignalForge</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
              
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5 flex-shrink-0",
                      isActive && "text-primary"
                    )} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}>
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">
              {navItems.find(item => 
                location.pathname === item.href || 
                (item.href !== "/dashboard" && location.pathname.startsWith(item.href))
              )?.label || "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <HelpCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center ml-2">
              <span className="text-sm font-medium text-primary">U</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
