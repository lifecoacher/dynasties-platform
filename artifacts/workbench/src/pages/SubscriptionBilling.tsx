import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  CreditCard,
  CheckCircle2,
  Crown,
  Zap,
  Rocket,
  Building2,
  Users,
  Ship,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useSubscription,
  usePlans,
  useCheckout,
  usePortal,
  useDemoActivate,
  type PlanInfo,
} from "@/hooks/use-stripe-billing";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const PLAN_ICONS: Record<string, any> = {
  STARTER: Zap,
  GROWTH: Rocket,
  SCALE: Crown,
  ENTERPRISE: Building2,
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: "#6366f1",
  GROWTH: "#00BFA6",
  SCALE: "#f59e0b",
  ENTERPRISE: "#8b5cf6",
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    TRIALING: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    PAST_DUE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    CANCELED: "bg-red-500/15 text-red-400 border-red-500/30",
    INACTIVE: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[status] || colors.INACTIVE}`}>
      {status === "ACTIVE" && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {status === "PAST_DUE" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {status}
    </span>
  );
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isWarning = percent >= 80;
  const barColor = isWarning ? "bg-amber-500" : "bg-primary";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="text-[12px] font-medium text-foreground">
          {used.toLocaleString()} / {limit >= 99999 ? "Unlimited" : limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-card-border rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      {isWarning && (
        <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {percent >= 100 ? "Limit reached" : `${percent}% used — consider upgrading`}
        </p>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  isCurrentPlan,
  billingInterval,
  onSelect,
  isLoading,
}: {
  plan: PlanInfo;
  isCurrentPlan: boolean;
  billingInterval: "month" | "year";
  onSelect: (priceId: string) => void;
  isLoading: boolean;
}) {
  const Icon = PLAN_ICONS[plan.planType] || Zap;
  const color = PLAN_COLORS[plan.planType] || "#00BFA6";
  const price = plan.prices.find((p) => p.interval === billingInterval);
  const monthlyPrice = plan.prices.find((p) => p.interval === "month");
  const yearlyPrice = plan.prices.find((p) => p.interval === "year");

  const displayPrice = price ? formatPrice(price.unitAmount) : "Custom";
  const yearlySavings =
    monthlyPrice && yearlyPrice
      ? Math.round(100 - (yearlyPrice.unitAmount / (monthlyPrice.unitAmount * 12)) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border p-5 transition-all ${
        isCurrentPlan
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-card-border bg-card hover:border-primary/40"
      }`}
    >
      {isCurrentPlan && (
        <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-[10px] font-semibold text-black">
          CURRENT PLAN
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h3 className="text-[14px] font-semibold text-foreground">{plan.name.replace("Dynasties ", "")}</h3>
      </div>

      <p className="text-[12px] text-muted-foreground mb-4 min-h-[32px]">{plan.description}</p>

      <div className="mb-4">
        <span className="text-2xl font-bold text-foreground">{displayPrice}</span>
        <span className="text-[12px] text-muted-foreground ml-1">
          /{billingInterval === "year" ? "year" : "mo"}
        </span>
        {billingInterval === "year" && yearlySavings > 0 && (
          <span className="ml-2 text-[11px] text-emerald-400 font-medium">Save {yearlySavings}%</span>
        )}
      </div>

      <ul className="space-y-2 mb-5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {!isCurrentPlan && price && (
        <button
          onClick={() => onSelect(price.id)}
          disabled={isLoading}
          className="w-full py-2 rounded-lg bg-primary text-black text-[13px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {isCurrentPlan ? "Current" : "Select Plan"}
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      )}

      {isCurrentPlan && (
        <div className="w-full py-2 rounded-lg bg-primary/10 text-primary text-[13px] font-medium text-center">
          Active
        </div>
      )}
    </motion.div>
  );
}

export default function SubscriptionBilling() {
  const { data: sub, isLoading: subLoading, refetch } = useSubscription();
  const { plans, isLoading: plansLoading } = usePlans();
  const { startCheckout, isLoading: checkoutLoading } = useCheckout();
  const { openPortal, isLoading: portalLoading } = usePortal();
  const { activate, isLoading: activateLoading } = useDemoActivate();
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [, navigate] = useLocation();
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (status) {
      setCheckoutStatus(status);
      setTimeout(() => refetch(), 2000);
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }
  }, [refetch]);

  const handleSelectPlan = async (priceId: string) => {
    if (DEMO_MODE) {
      const plan = plans.find((p) => p.prices.some((pr) => pr.id === priceId));
      if (plan?.planType) {
        await activate(plan.planType);
        refetch();
      }
      return;
    }
    startCheckout(priceId);
  };

  const handleDemoActivate = async (planType: string) => {
    await activate(planType);
    refetch();
  };

  const isLoading = subLoading || plansLoading;

  return (
    <AppLayout hideRightPanel>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <CreditCard className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Subscription & Billing</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-8">
            Manage your plan, track usage, and handle billing
          </p>
        </div>

        {checkoutStatus === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-[13px] font-medium text-emerald-400">Subscription activated!</p>
              <p className="text-[12px] text-emerald-400/70">Your plan is now active. You can start using all features.</p>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {sub && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-xl bg-card border border-card-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] text-muted-foreground">Status</span>
                    <StatusBadge status={sub.billingStatus} />
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {sub.planType || "No Plan"}
                  </div>
                  {sub.currentPeriodEnd && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="p-5 rounded-xl bg-card border border-card-border"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground">Team Members</span>
                  </div>
                  <UsageBar used={sub.seatsUsed} limit={sub.seatLimit} label="Seats" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-5 rounded-xl bg-card border border-card-border"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Ship className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground">Shipments This Cycle</span>
                  </div>
                  <UsageBar
                    used={sub.shipmentsUsedThisCycle}
                    limit={sub.shipmentLimitMonthly}
                    label="Shipments"
                  />
                </motion.div>
              </div>
            )}

            {sub?.stripeCustomerId && !DEMO_MODE && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-4 rounded-xl bg-card border border-card-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-[13px] font-medium text-foreground">Manage Subscription</p>
                    <p className="text-[11px] text-muted-foreground">Update payment method, view invoices, or cancel</p>
                  </div>
                </div>
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="px-4 py-2 rounded-lg bg-card-border text-foreground text-[12px] font-medium hover:bg-card-border/80 transition-colors flex items-center gap-2"
                >
                  {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Billing Portal
                </button>
              </motion.div>
            )}

            {DEMO_MODE && sub?.billingStatus === "INACTIVE" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-5 rounded-xl bg-primary/5 border border-primary/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-[14px] font-semibold text-foreground">Activate Demo Plan</h3>
                </div>
                <p className="text-[12px] text-muted-foreground mb-4">
                  In demo mode, you can instantly activate any plan without payment.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(["STARTER", "GROWTH", "SCALE", "ENTERPRISE"] as const).map((pt) => (
                    <button
                      key={pt}
                      onClick={() => handleDemoActivate(pt)}
                      disabled={activateLoading}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors"
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-foreground">Available Plans</h2>
                <div className="flex bg-card border border-card-border rounded-lg p-0.5">
                  <button
                    onClick={() => setBillingInterval("month")}
                    className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                      billingInterval === "month" ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingInterval("year")}
                    className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                      billingInterval === "year" ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              {plans.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrentPlan={sub?.planType === plan.planType}
                      billingInterval={billingInterval}
                      onSelect={handleSelectPlan}
                      isLoading={checkoutLoading || activateLoading}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(["STARTER", "GROWTH", "SCALE", "ENTERPRISE"] as const).map((pt) => {
                    const Icon = PLAN_ICONS[pt];
                    const color = PLAN_COLORS[pt];
                    const prices: Record<string, { month: number; year: number }> = {
                      STARTER: { month: 49, year: 470 },
                      GROWTH: { month: 149, year: 1430 },
                      SCALE: { month: 399, year: 3830 },
                      ENTERPRISE: { month: 999, year: 9590 },
                    };
                    const limits: Record<string, { seats: number; shipments: string }> = {
                      STARTER: { seats: 3, shipments: "50" },
                      GROWTH: { seats: 10, shipments: "250" },
                      SCALE: { seats: 25, shipments: "1,000" },
                      ENTERPRISE: { seats: 999, shipments: "Unlimited" },
                    };
                    const isActive = sub?.planType === pt;
                    return (
                      <motion.div
                        key={pt}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`relative rounded-xl border p-5 ${
                          isActive
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-card-border bg-card"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-[10px] font-semibold text-black">
                            CURRENT PLAN
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}20` }}>
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <h3 className="text-[14px] font-semibold text-foreground">{pt}</h3>
                        </div>
                        <div className="mb-4">
                          <span className="text-2xl font-bold text-foreground">
                            ${billingInterval === "year" ? prices[pt].year : prices[pt].month}
                          </span>
                          <span className="text-[12px] text-muted-foreground ml-1">
                            /{billingInterval === "year" ? "year" : "mo"}
                          </span>
                        </div>
                        <ul className="space-y-2 mb-5">
                          <li className="flex items-start gap-2 text-[12px] text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <span>{limits[pt].seats} team members</span>
                          </li>
                          <li className="flex items-start gap-2 text-[12px] text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <span>{limits[pt].shipments} shipments/month</span>
                          </li>
                        </ul>
                        {DEMO_MODE && !isActive ? (
                          <button
                            onClick={() => handleDemoActivate(pt)}
                            disabled={activateLoading}
                            className="w-full py-2 rounded-lg bg-primary text-black text-[13px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {activateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Activate<ArrowRight className="w-3.5 h-3.5" /></>}
                          </button>
                        ) : isActive ? (
                          <div className="w-full py-2 rounded-lg bg-primary/10 text-primary text-[13px] font-medium text-center">Active</div>
                        ) : null}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
