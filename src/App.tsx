import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigate, useParams } from "react-router-dom";
import Index from "./pages/Index";
import InstallerApp from "./pages/InstallerApp";
import CustomerPortal from "./pages/CustomerPortal";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { legacyViewPaths } from "@/lib/navigation";

const queryClient = new QueryClient();

const LegacyViewRedirect = () => {
  const { legacyView } = useParams<{ legacyView: string }>();
  const destination = legacyView ? legacyViewPaths[`/${legacyView}`] : undefined;
  return <Navigate to={destination ?? "/"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/app/:view" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/portal" element={<ProtectedRoute><CustomerPortal /></ProtectedRoute>} />
            <Route path="/installer" element={<ProtectedRoute><InstallerApp /></ProtectedRoute>} />
            <Route path="/:legacyView" element={<ProtectedRoute><LegacyViewRedirect /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
