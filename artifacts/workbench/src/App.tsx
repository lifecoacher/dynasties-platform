import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Workbench from "./pages/Workbench";
import ShipmentDetail from "./pages/ShipmentDetail";
import LoginPage from "./pages/LoginPage";
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
      <Route path="/" component={Workbench} />
      <Route path="/shipments/:id" component={ShipmentDetail} />
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
