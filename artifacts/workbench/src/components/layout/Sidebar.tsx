import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Command,
  Ship,
  Users,
  Brain,
  Settings,
  Zap,
  LogOut,
  ChevronRight,
  Radar,
  BarChart3,
  ClipboardList,
  Sparkles,
  Target,
  Settings2,
  FileText,
  Receipt,
  Upload,
  CreditCard,
  Calculator,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useListShipments } from "@workspace/api-client-react";
import { useAlertsSummary } from "@/hooks/use-exceptions";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const DEMO_HIDDEN = new Set([
  "/customers",
  "/intelligence",
  "/predictive",
  "/strategy",
  "/policy-studio",
  "/reports",
  "/analytics",
]);

const ALL_NAV_ITEMS = [
  { href: "/", icon: Command, label: "Command Center" },
  { href: "/quotes", icon: Calculator, label: "Quotes" },
  { href: "/shipments", icon: Ship, label: "Shipments" },
  { href: "/exceptions", icon: AlertTriangle, label: "Exceptions" },
  { href: "/control-tower", icon: Radar, label: "Control Tower" },
  { href: "/work-queue", icon: ClipboardList, label: "Work Queue" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/intelligence", icon: Brain, label: "Intelligence" },
  { href: "/predictive", icon: Sparkles, label: "Predictive" },
  { href: "/strategy", icon: Target, label: "Strategy" },
  { href: "/policy-studio", icon: Settings2, label: "Policy Studio" },
  { href: "/reports", icon: FileText, label: "Reports" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/billing", icon: Receipt, label: "Billing" },
  { href: "/onboarding/migration", icon: Upload, label: "Data Import" },
  { href: "/settings/billing", icon: CreditCard, label: "Subscription" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const NAV_ITEMS = DEMO_MODE
  ? ALL_NAV_ITEMS.filter((item) => !DEMO_HIDDEN.has(item.href))
  : ALL_NAV_ITEMS;

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: shipmentsRes } = useListShipments();
  const { data: alertsRes } = useAlertsSummary();
  const recentShipments = (shipmentsRes?.data || []).slice(0, 4);
  const alertCount = alertsRes?.data?.needsAttention ?? 0;

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <aside className="w-[240px] h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 sticky top-0">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="font-heading text-[16px] font-medium text-foreground" style={{ letterSpacing: '0.22em' }}>DYNASTIES</span>
            <div className="absolute -bottom-1 left-0 w-[1.3em] h-[2.5px] rounded-full bg-primary" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-none mt-2.5">
          {user?.companyName || "Trade Intelligence OS"}
        </p>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer relative ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
                {item.href === "/exceptions" && alertCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400 min-w-[18px] text-center">
                    {alertCount}
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}

        {!DEMO_MODE && (
          <Link href="/demo">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-sidebar-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors cursor-pointer mt-2">
              <Zap className="w-4 h-4 shrink-0" />
              Demo Pipeline
            </div>
          </Link>
        )}

        {recentShipments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-sidebar-border">
            <p className="px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Recent</p>
            {recentShipments.map((s: any) => (
              <Link key={s.id} href={`/shipments/${s.id}`}>
                <div className="flex items-center justify-between px-3 py-1.5 rounded-md text-[12px] text-sidebar-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors cursor-pointer group">
                  <span className="font-mono truncate">{s.reference}</span>
                  <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.role}</p>
          </div>
          <button onClick={logout} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
