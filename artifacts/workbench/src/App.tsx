import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { AuthProvider, useAuth } from "./hooks/use-auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <LoginPage />;

  return (
    <Switch>
      <Route path="/" component={CommandCenter} />
      <Route path="/shipments" component={ShipmentsPage} />
      <Route path="/shipments/:id/trace" component={DecisionTrace} />
      <Route path="/shipments/:id" component={ShipmentDetail} />
      <Route path="/intelligence" component={IntelligencePage} />
      <Route path="/control-tower" component={ControlTower} />
      <Route path="/customers" component={CustomersPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/demo" component={DemoControls} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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

export default App;
