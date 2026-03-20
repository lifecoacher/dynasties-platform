import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn } from "@clerk/clerk-react";
import NotFound from "@/pages/not-found";
import CommandCenter from "./pages/CommandCenter";
import ShipmentsPage from "./pages/ShipmentsPage";
import ShipmentDetail from "./pages/ShipmentDetail";
import IntelligencePage from "./pages/IntelligencePage";
import DecisionTrace from "./pages/DecisionTrace";
import CustomersPage from "./pages/CustomersPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import ControlTower from "./pages/ControlTower";
import DemoControls from "./pages/DemoControls";
import AnalyticsPage from "./pages/Analytics";
import LaneDossier from "./pages/LaneDossier";
import PortDossier from "./pages/PortDossier";
import CarrierDossier from "./pages/CarrierDossier";
import EntityDossier from "./pages/EntityDossier";
import WorkQueue from "./pages/WorkQueue";
import PredictiveIntelligence from "./pages/PredictiveIntelligence";
import StrategyIntelligence from "./pages/StrategyIntelligence";
import PolicyStudio from "./pages/PolicyStudio";
import ReportsPage from "./pages/Reports";
import BillingOverview from "./pages/BillingOverview";
import BillingInvoices from "./pages/BillingInvoices";
import BillingInvoiceDetail from "./pages/BillingInvoiceDetail";
import BillingCustomers from "./pages/BillingCustomers";
import BillingSettings from "./pages/BillingSettings";
import MigrationWorkspace from "./pages/MigrationWorkspace";
import SubscriptionBilling from "./pages/SubscriptionBilling";
import QuotesPage from "./pages/QuotesPage";
import QuoteDetail from "./pages/QuoteDetail";
import ExceptionsPage from "./pages/ExceptionsPage";
import { AuthProvider, useAuth } from "./hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkEnabled = !!(CLERK_PUBLISHABLE_KEY && CLERK_PUBLISHABLE_KEY.startsWith("pk_"));
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

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
  const { user, isLoading, isClerkMode } = useAuth();

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
  if (!user) {
    if (isClerkMode) return <ClerkLoginPage />;
    return <LoginPage />;
  }

  const DemoRedirect = () => { window.location.replace(import.meta.env.BASE_URL.replace(/\/$/, "") || "/"); return null; };

  return (
    <Switch>
      <Route path="/" component={CommandCenter} />
      <Route path="/quotes/:id" component={QuoteDetail} />
      <Route path="/quotes" component={QuotesPage} />
      <Route path="/exceptions" component={ExceptionsPage} />
      <Route path="/shipments" component={ShipmentsPage} />
      <Route path="/shipments/:id/trace" component={DecisionTrace} />
      <Route path="/shipments/:id" component={ShipmentDetail} />
      <Route path="/control-tower" component={ControlTower} />
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
      <Route path="/settings" component={SettingsPage} />
      {!DEMO_MODE && <Route path="/intelligence" component={IntelligencePage} />}
      {!DEMO_MODE && <Route path="/customers" component={CustomersPage} />}
      {!DEMO_MODE && <Route path="/predictive" component={PredictiveIntelligence} />}
      {!DEMO_MODE && <Route path="/strategy" component={StrategyIntelligence} />}
      {!DEMO_MODE && <Route path="/policy-studio" component={PolicyStudio} />}
      {!DEMO_MODE && <Route path="/reports" component={ReportsPage} />}
      {!DEMO_MODE && <Route path="/analytics" component={AnalyticsPage} />}
      {!DEMO_MODE && <Route path="/demo" component={DemoControls} />}
      {DEMO_MODE && <Route path="/intelligence" component={DemoRedirect} />}
      {DEMO_MODE && <Route path="/customers" component={DemoRedirect} />}
      {DEMO_MODE && <Route path="/predictive" component={DemoRedirect} />}
      {DEMO_MODE && <Route path="/strategy" component={DemoRedirect} />}
      {DEMO_MODE && <Route path="/policy-studio" component={DemoRedirect} />}
      {DEMO_MODE && <Route path="/reports" component={DemoRedirect} />}
      {DEMO_MODE && <Route path="/analytics" component={DemoRedirect} />}
      {DEMO_MODE && <Route path="/demo" component={DemoRedirect} />}
      <Route component={NotFound} />
    </Switch>
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
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        appearance={{
          variables: {
            colorPrimary: "#00BFA6",
            colorBackground: "#121821",
            colorText: "#F0F2F5",
            colorInputBackground: "#080C12",
            colorInputText: "#F0F2F5",
          },
        }}
      >
        <AppInner />
      </ClerkProvider>
    );
  }

  return <AppInner />;
}

export default App;
