import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  Clock,
  Shield,
  FileCheck,
  Link2,
  RefreshCw,
  CircleDot,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useSubscription,
  usePlanConfig,
  useCheckout,
  usePortal,
  useDemoActivate,
  useStartTrial,
  useConnectStatus,
  useConnectSync,
  useConnectCreateAccount,
  useConnectOnboarding,
  type PlanConfigInfo,
  type ConnectStatusInfo,
} from "@/hooks/use-stripe-billing";
import { DEMO_MODE } from "@/hooks/use-demo";
import { useAuth } from "@/hooks/use-auth";

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

function formatCents(cents: number) {
  if (cents === 0) return "Custom";
  return `$${(cents / 100).toLocaleString()}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    TRIAL: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    TRIAL_EXPIRED: "bg-red-500/15 text-red-400 border-red-500/30",
    PAST_DUE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    CANCELED: "bg-red-500/15 text-red-400 border-red-500/30",
    INCOMPLETE: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    INACTIVE: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };

  const labels: Record<string, string> = {
    ACTIVE: "Active",
    TRIAL: "Trial",
    TRIAL_EXPIRED: "Trial Expired",
    PAST_DUE: "Past Due",
    CANCELED: "Canceled",
    INCOMPLETE: "Incomplete",
    INACTIVE: "Inactive",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[status] || colors.INACTIVE}`}>
      {status === "ACTIVE" && <CheckCircle2 className="w-3 h-3 mr-1" />}
      {status === "PAST_DUE" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {status === "TRIAL" && <Clock className="w-3 h-3 mr-1" />}
      {status === "TRIAL_EXPIRED" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {labels[status] || status}
    </span>
  );
}

function DeploymentFeeBadge({ status }: { status: string }) {
  if (status === "NOT_REQUIRED") return null;
  const colors: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[status] || ""}`}>
      {status === "PAID" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <FileCheck className="w-3 h-3 mr-1" />}
      Deployment: {status}
    </span>
  );
}

function UsageBar({ used, limit, label, warningLevel }: { used: number; limit: number; label: string; warningLevel?: string | null }) {
  const isUnlimited = limit >= 9999;
  const percent = isUnlimited ? 0 : (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0);
  const barColor = warningLevel === "LIMIT_REACHED" ? "bg-red-500"
    : warningLevel === "CRITICAL_USAGE" ? "bg-amber-500"
    : warningLevel === "HIGH_USAGE" ? "bg-amber-400"
    : "bg-primary";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="text-[12px] font-medium text-foreground">
          {used.toLocaleString()} / {isUnlimited ? "Unlimited" : limit.toLocaleString()}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-card-border rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}
      {warningLevel === "LIMIT_REACHED" && (
        <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Limit reached — upgrade your plan for more capacity
        </p>
      )}
      {warningLevel === "CRITICAL_USAGE" && (
        <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {percent}% used — approaching limit
        </p>
      )}
      {warningLevel === "HIGH_USAGE" && (
        <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {percent}% used — consider upgrading
        </p>
      )}
    </div>
  );
}

function ConnectStatusIndicator({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <CircleDot className={`w-3.5 h-3.5 ${enabled ? "text-emerald-400" : "text-zinc-500"}`} />
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-medium ${enabled ? "text-emerald-400" : "text-zinc-500"}`}>
        {enabled ? "Enabled" : "Not ready"}
      </span>
    </div>
  );
}

function ConnectSection({
  connectData,
  onCreateAccount,
  onStartOnboarding,
  onSync,
  isCreating,
  isOnboarding,
  isSyncing,
  userRole,
  connectError,
}: {
  connectData: ConnectStatusInfo | null;
  onCreateAccount: () => void;
  onStartOnboarding: () => void;
  onSync: () => void;
  isCreating: boolean;
  isOnboarding: boolean;
  isSyncing: boolean;
  userRole: string | undefined;
  connectError: string | null;
}) {
  const isAdmin = userRole === "ADMIN";
  const hasAccount = !!connectData?.stripeConnectAccountId;
  const isComplete = connectData?.connectOnboardingCompleted;
  const chargesEnabled = connectData?.connectChargesEnabled;
  const payoutsEnabled = connectData?.connectPayoutsEnabled;
  const fullyConnected = chargesEnabled && payoutsEnabled;

  const connectState = !hasAccount
    ? "NOT_CONNECTED"
    : fullyConnected
      ? "CONNECTED"
      : isComplete
        ? "PENDING_VERIFICATION"
        : "ONBOARDING_IN_PROGRESS";

  const stateConfig: Record<string, { color: string; bg: string; border: string; label: string; icon: any }> = {
    NOT_CONNECTED: { color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30", label: "Not Connected", icon: Link2 },
    ONBOARDING_IN_PROGRESS: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Onboarding In Progress", icon: Clock },
    PENDING_VERIFICATION: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Pending Verification", icon: Clock },
    CONNECTED: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "Connected", icon: CheckCircle2 },
  };

  const state = stateConfig[connectState];
  const StateIcon = state.icon;

  const requirements = connectData?.requirements;
  const hasMissingRequirements = requirements && (
    (requirements.currentlyDue?.length ?? 0) > 0 ||
    (requirements.pastDue?.length ?? 0) > 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-xl bg-card border border-card-border overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Stripe Connect</h3>
              <p className="text-[12px] text-muted-foreground">
                Receive payments and manage payouts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAccount && (
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="p-2 rounded-lg bg-card-border/50 text-muted-foreground hover:text-foreground hover:bg-card-border transition-colors"
                title="Refresh status from Stripe"
              >
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            )}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${state.bg} ${state.color} ${state.border}`}>
              <StateIcon className="w-3 h-3" />
              {state.label}
            </span>
          </div>
        </div>

        {hasAccount && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <ConnectStatusIndicator label="Charges" enabled={!!chargesEnabled} />
            <ConnectStatusIndicator label="Payouts" enabled={!!payoutsEnabled} />
          </div>
        )}

        {hasAccount && connectData?.stripeConnectAccountId && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-card-border/30 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted-foreground">Account ID: </span>
              <span className="text-[11px] font-mono text-foreground">{connectData.stripeConnectAccountId}</span>
            </div>
            {connectData.connectLastSyncAt && (
              <span className="text-[10px] text-muted-foreground">
                Last synced {new Date(connectData.connectLastSyncAt).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {hasMissingRequirements && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[12px] font-medium text-amber-400">Missing Requirements</span>
            </div>
            {requirements!.pastDue && requirements!.pastDue.length > 0 && (
              <p className="text-[11px] text-amber-400/70 mb-1">
                Past due: {requirements!.pastDue.join(", ")}
              </p>
            )}
            {requirements!.currentlyDue && requirements!.currentlyDue.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Currently due: {requirements!.currentlyDue.join(", ")}
              </p>
            )}
            {requirements!.disabledReason && (
              <p className="text-[11px] text-red-400 mt-1">
                Disabled: {requirements!.disabledReason}
              </p>
            )}
          </div>
        )}

        {connectError && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-[#E05252]/5 border border-[#E05252]/15">
            <div className="flex items-start gap-2">
              <XCircle className="w-3.5 h-3.5 text-[#E05252] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#E05252]/80">{connectError}</p>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-3">
            {!hasAccount && (
              <button
                onClick={onCreateAccount}
                disabled={isCreating}
                className="px-4 py-2 rounded-lg bg-primary text-black text-[12px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Set Up Stripe Connect
              </button>
            )}
            {hasAccount && !fullyConnected && (
              <button
                onClick={onStartOnboarding}
                disabled={isOnboarding}
                className="px-4 py-2 rounded-lg bg-primary text-black text-[12px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isOnboarding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                {connectData?.connectOnboardingStarted ? "Continue Onboarding" : "Start Onboarding"}
              </button>
            )}
            {fullyConnected && (
              <div className="flex items-center gap-2 text-[12px] text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">Fully connected and ready to receive payments</span>
              </div>
            )}
          </div>
        )}

        {!isAdmin && !hasAccount && (
          <p className="text-[12px] text-muted-foreground">
            Contact your workspace admin to set up Stripe Connect.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function PlanCard({
  config,
  isCurrentPlan,
  onSelect,
  onTrial,
  isLoading,
  demoMode,
  onDemoActivate,
}: {
  config: PlanConfigInfo;
  isCurrentPlan: boolean;
  onSelect: (planType: string) => void;
  onTrial: (planType: string) => void;
  isLoading: boolean;
  demoMode: boolean;
  onDemoActivate: (planType: string) => void;
}) {
  const Icon = PLAN_ICONS[config.planType] || Zap;
  const color = PLAN_COLORS[config.planType] || "#00BFA6";
  const isEnterprise = config.planType === "ENTERPRISE";
  const displayPrice = isEnterprise ? "Custom" : formatCents(config.monthlyPrice);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-xl border p-5 transition-all flex flex-col ${
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
        <h3 className="text-[14px] font-semibold text-foreground">{config.name}</h3>
      </div>

      <p className="text-[12px] text-muted-foreground mb-4 min-h-[32px]">{config.description}</p>

      <div className="mb-4">
        <span className="text-2xl font-bold text-foreground">{displayPrice}</span>
        {!isEnterprise && <span className="text-[12px] text-muted-foreground ml-1">/mo</span>}
      </div>

      {config.deploymentFeeCents > 0 && (
        <p className="text-[11px] text-muted-foreground mb-3">
          + {formatCents(config.deploymentFeeCents)} deployment fee
          {config.deploymentFeeRequirement === "REQUIRED" && " (required)"}
          {config.deploymentFeeRequirement === "RECOMMENDED" && " (recommended)"}
        </p>
      )}

      <ul className="space-y-2 mb-5 flex-1">
        {config.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {isCurrentPlan ? (
        <div className="w-full py-2 rounded-lg bg-primary/10 text-primary text-[13px] font-medium text-center">
          Active
        </div>
      ) : demoMode ? (
        <button
          onClick={() => onDemoActivate(config.planType)}
          disabled={isLoading}
          className="w-full py-2 rounded-lg bg-primary text-black text-[13px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Activate<ArrowRight className="w-3.5 h-3.5" /></>}
        </button>
      ) : isEnterprise ? (
        <button
          className="w-full py-2 rounded-lg bg-card-border text-foreground text-[13px] font-medium text-center"
          disabled
        >
          Contact Sales
        </button>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => onSelect(config.planType)}
            disabled={isLoading}
            className="w-full py-2 rounded-lg bg-primary text-black text-[13px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Subscribe<ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
          <button
            onClick={() => onTrial(config.planType)}
            disabled={isLoading}
            className="w-full py-1.5 rounded-lg bg-transparent border border-primary/30 text-primary text-[12px] font-medium hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            Start {config.trialDays}-day trial
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function SubscriptionBilling() {
  const { data: sub, isLoading: subLoading, refetch } = useSubscription();
  const { configs, isLoading: configsLoading } = usePlanConfig();
  const { startCheckout, isLoading: checkoutLoading } = useCheckout();
  const { openPortal, isLoading: portalLoading } = usePortal();
  const { activate, isLoading: activateLoading } = useDemoActivate();
  const { startTrial, isLoading: trialLoading } = useStartTrial();
  const { data: connectData, refetch: refetchConnect } = useConnectStatus();
  const { sync: syncConnect, isLoading: syncLoading } = useConnectSync();
  const { createAccount, isLoading: createAccountLoading } = useConnectCreateAccount();
  const { startOnboarding, isLoading: onboardingLoading } = useConnectOnboarding();
  const { user } = useAuth();
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout") || params.get("deployment");
    const connectStatus = params.get("connect");
    if (status) {
      setCheckoutStatus(status);
      setTimeout(() => refetch(), 2000);
    }
    if (connectStatus === "return" || connectStatus === "refresh") {
      handleConnectSync();
    }
    if (status || connectStatus) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("deployment");
      url.searchParams.delete("connect");
      window.history.replaceState({}, "", url.toString());
    }
  }, [refetch]);

  const handleSelectPlan = (planType: string) => {
    startCheckout(planType);
  };

  const handleTrial = async (planType: string) => {
    await startTrial(planType);
    refetch();
  };

  const handleDemoActivate = async (planType: string) => {
    await activate(planType);
    refetch();
  };

  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnectCreate = async () => {
    setConnectError(null);
    const result = await createAccount();
    if (result?.error) {
      const msg = result.code === "CONNECT_NOT_ENABLED"
        ? "Stripe Connect is not enabled on this Stripe account. Contact support."
        : result.error || "Unable to create connected account. Try again.";
      setConnectError(msg);
    } else {
      refetchConnect();
    }
  };

  const handleConnectSync = async () => {
    setConnectError(null);
    const result = await syncConnect();
    if (!result) return;
    if ("error" in result && result.error) {
      setConnectError(result.error);
    } else {
      refetchConnect();
    }
  };

  const isLoading = subLoading || configsLoading;
  const isActionLoading = checkoutLoading || activateLoading || trialLoading;

  const trialDaysRemaining = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

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
              <p className="text-[13px] font-medium text-emerald-400">Payment successful!</p>
              <p className="text-[12px] text-emerald-400/70">Your billing update is being processed.</p>
            </div>
          </motion.div>
        )}

        {sub?.billingStatus === "PAST_DUE" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-[13px] font-medium text-amber-400">Payment past due</p>
              <p className="text-[12px] text-amber-400/70">Your last payment failed. Please update your payment method to avoid service interruption.</p>
            </div>
          </motion.div>
        )}

        {sub?.billingStatus === "TRIAL_EXPIRED" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-[13px] font-medium text-red-400">Trial expired</p>
              <p className="text-[12px] text-red-400/70">Subscribe to a plan below to continue using Dynasties.</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-xl bg-card border border-card-border"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] text-muted-foreground">Plan & Status</span>
                    <StatusBadge status={sub.billingStatus} />
                  </div>
                  <div className="text-lg font-semibold text-foreground">
                    {sub.planType || "No Plan"}
                  </div>
                  {sub.monthlyPrice ? (
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {formatCents(sub.monthlyPrice)}/mo
                    </p>
                  ) : null}
                  {sub.currentPeriodEnd && sub.billingStatus === "ACTIVE" && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                  {sub.billingStatus === "TRIAL" && trialDaysRemaining !== null && (
                    <p className="text-[11px] text-blue-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {trialDaysRemaining} days remaining
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
                    warningLevel={sub.shipmentWarning}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="p-5 rounded-xl bg-card border border-card-border"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground">Deployment & Onboarding</span>
                  </div>
                  <DeploymentFeeBadge status={sub.deploymentFeeStatus} />
                  {sub.deploymentFeeStatus === "NOT_REQUIRED" && (
                    <p className="text-[12px] text-muted-foreground mt-2">No deployment fee required</p>
                  )}
                  {sub.deploymentFeeStatus === "PENDING" && sub.deploymentFeeCents && (
                    <p className="text-[12px] text-amber-400 mt-2">
                      {formatCents(sub.deploymentFeeCents)} deployment fee pending
                    </p>
                  )}
                  {sub.onboardingCompletedAt && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Completed {new Date(sub.onboardingCompletedAt).toLocaleDateString()}
                    </p>
                  )}
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

            <ConnectSection
              connectData={connectData}
              onCreateAccount={handleConnectCreate}
              onStartOnboarding={startOnboarding}
              onSync={handleConnectSync}
              isCreating={createAccountLoading}
              isOnboarding={onboardingLoading}
              isSyncing={syncLoading}
              userRole={user?.role}
              connectError={connectError}
            />

            {DEMO_MODE && sub?.billingStatus === "INACTIVE" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-5 rounded-xl bg-primary/5 border border-primary/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-[14px] font-semibold text-foreground">Demo Mode</h3>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Select a plan below to instantly activate in demo mode.
                </p>
              </motion.div>
            )}

            <div className="mb-6">
              <h2 className="text-[15px] font-semibold text-foreground mb-4">Available Plans</h2>

              {configs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {configs.map((config) => (
                    <PlanCard
                      key={config.planType}
                      config={config}
                      isCurrentPlan={sub?.planType === config.planType}
                      onSelect={handleSelectPlan}
                      onTrial={handleTrial}
                      isLoading={isActionLoading}
                      demoMode={DEMO_MODE}
                      onDemoActivate={handleDemoActivate}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
