import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn } from "@clerk/clerk-react";
import { Component, type ErrorInfo, type ReactNode, Suspense, lazy } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { useIsDemo } from "./hooks/use-demo";
import { toast } from "./hooks/use-toast";

const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const ShipmentsPage = lazy(() => import("./pages/ShipmentsPage"));
const ShipmentDetail = lazy(() => import("./pages/ShipmentDetail"));
const IntelligencePage = lazy(() => import("./pages/IntelligencePage"));
const DecisionTrace = lazy(() => import("./pages/DecisionTrace"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ControlTower = lazy(() => import("./pages/ControlTower"));
const DemoControls = lazy(() => import("./pages/DemoControls"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
const LaneDossier = lazy(() => import("./pages/LaneDossier"));
const PortDossier = lazy(() => import("./pages/PortDossier"));
const CarrierDossier = lazy(() => import("./pages/CarrierDossier"));
const EntityDossier = lazy(() => import("./pages/EntityDossier"));
const WorkQueue = lazy(() => import("./pages/WorkQueue"));
const PredictiveIntelligence = lazy(() => import("./pages/PredictiveIntelligence"));
const StrategyIntelligence = lazy(() => import("./pages/StrategyIntelligence"));
const PolicyStudio = lazy(() => import("./pages/PolicyStudio"));
const ReportsPage = lazy(() => import("./pages/Reports"));
const BillingOverview = lazy(() => import("./pages/BillingOverview"));
const BillingInvoices = lazy(() => import("./pages/BillingInvoices"));
const BillingInvoiceDetail = lazy(() => import("./pages/BillingInvoiceDetail"));
const BillingCustomers = lazy(() => import("./pages/BillingCustomers"));
const BillingSettings = lazy(() => import("./pages/BillingSettings"));
const MigrationWorkspace = lazy(() => import("./pages/MigrationWorkspace"));
const SubscriptionBilling = lazy(() => import("./pages/SubscriptionBilling"));
const QuotesPage = lazy(() => import("./pages/QuotesPage"));
const QuoteDetail = lazy(() => import("./pages/QuoteDetail"));
const ExceptionsPage = lazy(() => import("./pages/ExceptionsPage"));
const AccountingIntegration = lazy(() => import("./pages/AccountingIntegration"));
const SystemHealthPage = lazy(() => import("./pages/SystemHealthPage"));

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md text-center p-8">
            <div className="relative inline-block mb-4">
              <span className="font-heading text-[24px] font-medium text-foreground" style={{ letterSpacing: '0.22em' }}>DYNASTIES</span>
              <div className="absolute -bottom-1.5 left-0 w-[1.3em] h-[2.5px] rounded-full bg-primary" />
            </div>
            <p className="text-[15px] font-medium text-foreground mt-4">Something went wrong</p>
            <p className="text-[13px] text-muted-foreground mt-2">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

class RouteErrorBoundary extends Component<
  { children: ReactNode; routeName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; routeName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RouteErrorBoundary:${this.props.routeName}]`, error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <p className="text-[15px] font-medium text-foreground">This section encountered an error</p>
            <p className="text-[13px] text-muted-foreground mt-2">
              The {this.props.routeName} page ran into a problem. You can try again or navigate elsewhere.
            </p>
            <div className="flex gap-3 justify-center mt-5">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 rounded-lg border border-border text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => { window.location.href = import.meta.env.BASE_URL.replace(/\/$/, "") || "/"; }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error || parsed?.message) return parsed.error || parsed.message;
    } catch { /* not JSON */ }
    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      return "Network error — please check your connection";
    }
    if (error.message.length > 120) return error.message.slice(0, 117) + "...";
    return error.message;
  }
  return "An unexpected error occurred";
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      toast({
        variant: "destructive",
        title: "Action failed",
        description: extractErrorMessage(error),
      });
    },
  }),
});

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkEnabled = !!(CLERK_PUBLISHABLE_KEY && CLERK_PUBLISHABLE_KEY.startsWith("pk_"));

function ClerkLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <span className="font-heading text-[24px] font-medium text-foreground" style={{ letterSpacing: '0.22em' }}>DYNASTIES</span>
            <div className="absolute -bottom-1.5 left-0 w-[1.3em] h-[2.5px] rounded-full bg-primary" />
          </div>
          <p className="text-[14px] text-muted-foreground mt-1">The intelligence layer for global trade</p>
        </div>
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card border border-card-border shadow-none",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
              formFieldInput: "bg-background border-card-border text-foreground",
              formFieldLabel: "text-muted-foreground",
              footerActionLink: "text-primary hover:text-primary/80",
              identityPreviewEditButton: "text-primary",
              socialButtonsBlockButton: "border border-card-border bg-background hover:bg-card transition-colors min-h-[44px] px-4",
              socialButtonsBlockButtonText: "text-foreground font-medium text-[15px]",
              socialButtonsProviderIcon: "w-5 h-5",
              dividerLine: "bg-card-border",
              dividerText: "text-muted-foreground",
            },
          }}
        />
      </div>
    </div>
  );
}

function AuthenticatedRouter() {
  const { user, isLoading, isClerkMode, syncError } = useAuth();
  const isDemo = useIsDemo();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <span className="font-heading text-[24px] font-medium text-foreground" style={{ letterSpacing: '0.22em' }}>DYNASTIES</span>
            <div className="absolute -bottom-1.5 left-0 w-[1.3em] h-[2.5px] rounded-full bg-primary" />
          </div>
          <p className="text-[14px] text-muted-foreground mt-1 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }
  if (syncError && isClerkMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-sm text-center p-8">
          <div className="relative inline-block mb-4">
            <span className="font-heading text-[24px] font-medium text-foreground" style={{ letterSpacing: '0.22em' }}>DYNASTIES</span>
            <div className="absolute -bottom-1.5 left-0 w-[1.3em] h-[2.5px] rounded-full bg-primary" />
          </div>
          <p className="text-[15px] font-medium text-foreground mt-4">Account sync failed</p>
          <p className="text-[13px] text-muted-foreground mt-2">{syncError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  if (!user) {
    if (isClerkMode) return <ClerkLoginPage />;
    return (
      <Suspense fallback={<PageSkeleton />}>
        <LoginPage />
      </Suspense>
    );
  }

  const DemoRedirect = () => { window.location.replace(import.meta.env.BASE_URL.replace(/\/$/, "") || "/"); return null; };

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        <Route path="/">{() => <RouteErrorBoundary routeName="Command Center"><CommandCenter /></RouteErrorBoundary>}</Route>
        <Route path="/quotes/:id" component={QuoteDetail} />
        <Route path="/quotes" component={QuotesPage} />
        <Route path="/exceptions" component={ExceptionsPage} />
        <Route path="/shipments" component={ShipmentsPage} />
        <Route path="/shipments/:id/trace" component={DecisionTrace} />
        <Route path="/shipments/:id" component={ShipmentDetail} />
        <Route path="/control-tower">{() => <RouteErrorBoundary routeName="Control Tower"><ControlTower /></RouteErrorBoundary>}</Route>
        <Route path="/work-queue" component={WorkQueue} />
        <Route path="/lanes/:origin/:destination" component={LaneDossier} />
        <Route path="/ports/:portCode" component={PortDossier} />
        <Route path="/carriers/:carrierId" component={CarrierDossier} />
        <Route path="/entities/:entityId" component={EntityDossier} />
        <Route path="/billing" component={BillingOverview} />
        <Route path="/billing/invoices/:id" component={BillingInvoiceDetail} />
        <Route path="/billing/invoices" component={BillingInvoices} />
        <Route path="/billing/customers/:id" component={BillingCustomers} />
        <Route path="/billing/customers" component={BillingCustomers} />
        <Route path="/billing/settings" component={BillingSettings} />
        <Route path="/onboarding/migration" component={MigrationWorkspace} />
        <Route path="/settings/billing" component={SubscriptionBilling} />
        <Route path="/settings/accounting" component={AccountingIntegration} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/system-health">
          {() =>
            user.role === "ADMIN" ? (
              <RouteErrorBoundary routeName="System Health"><SystemHealthPage /></RouteErrorBoundary>
            ) : (
              <NotFound />
            )
          }
        </Route>
        {!isDemo && <Route path="/intelligence" component={IntelligencePage} />}
        {!isDemo && <Route path="/customers" component={CustomersPage} />}
        {!isDemo && <Route path="/predictive" component={PredictiveIntelligence} />}
        {!isDemo && <Route path="/strategy" component={StrategyIntelligence} />}
        {!isDemo && <Route path="/policy-studio" component={PolicyStudio} />}
        {!isDemo && <Route path="/reports" component={ReportsPage} />}
        {!isDemo && <Route path="/analytics" component={AnalyticsPage} />}
        {!isDemo && <Route path="/demo" component={DemoControls} />}
        {isDemo && <Route path="/intelligence" component={DemoRedirect} />}
        {isDemo && <Route path="/customers" component={DemoRedirect} />}
        {isDemo && <Route path="/predictive" component={DemoRedirect} />}
        {isDemo && <Route path="/strategy" component={DemoRedirect} />}
        {isDemo && <Route path="/policy-studio" component={DemoRedirect} />}
        {isDemo && <Route path="/reports" component={DemoRedirect} />}
        {isDemo && <Route path="/analytics" component={DemoRedirect} />}
        {isDemo && <Route path="/demo" component={DemoRedirect} />}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppInner() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="min-h-screen bg-background text-foreground dark selection:bg-primary/30">
              <AuthenticatedRouter />
            </div>
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  if (clerkEnabled) {
    return (
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY}
          appearance={{
            variables: {
              colorPrimary: "#00A692",
              colorBackground: "#FFFFFF",
              colorText: "#1E2330",
              colorInputBackground: "#F2F4F7",
              colorInputText: "#1E2330",
            },
          }}
        >
          <AppInner />
        </ClerkProvider>
      </ErrorBoundary>
    );
  }

  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}

export default App;
