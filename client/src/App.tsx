import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";

// Pages
import TenantOnboarding from "./pages/TenantOnboarding";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Campaigns from "./pages/Campaigns";
import LandingPages from "./pages/LandingPages";
import AIAssistant from "./pages/AIAssistant";
import PaymentSettings from "./pages/PaymentSettings";
import SuperAdmin from "./pages/SuperAdmin";
import Wallet from "./pages/Wallet";
import AIAddons from "./pages/AIAddons";
import ContentWriter from "./pages/ContentWriter";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  
  // استخدام onboarding.getStatus بدلاً من tenant.getCurrent
  // لأنه يعمل مع protectedProcedure وليس tenantProcedure
  const { data: onboardingStatus, isLoading: statusLoading, error } = trpc.onboarding.getStatus.useQuery(undefined, {
    enabled: !!user,
    retry: false, // لا نعيد المحاولة إذا فشل
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // إذا لم يكن مسجل دخول، توجيه للـ onboarding
  if (!user) {
    return <Redirect to="/onboarding" />;
  }

  // إذا كان يتم تحميل حالة الـ onboarding
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحقق من الحساب...</p>
        </div>
      </div>
    );
  }

  // إذا حدث خطأ أو لم يكمل الـ onboarding
  if (error || !onboardingStatus?.hasCompletedOnboarding) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/onboarding" component={TenantOnboarding} />
      <Route path="/admin" component={SuperAdmin} />
      <Route path="/">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/products">{() => <ProtectedRoute component={Products} />}</Route>
      <Route path="/orders">{() => <ProtectedRoute component={Orders} />}</Route>
      <Route path="/campaigns">{() => <ProtectedRoute component={Campaigns} />}</Route>
      <Route path="/landing-pages">{() => <ProtectedRoute component={LandingPages} />}</Route>
      <Route path="/ai-assistant">{() => <ProtectedRoute component={AIAssistant} />}</Route>
      <Route path="/settings/payments">{() => <ProtectedRoute component={PaymentSettings} />}</Route>
      <Route path="/wallet">{() => <ProtectedRoute component={Wallet} />}</Route>
      <Route path="/ai-addons">{() => <ProtectedRoute component={AIAddons} />}</Route>
      <Route path="/content-writer">{() => <ProtectedRoute component={ContentWriter} />}</Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
