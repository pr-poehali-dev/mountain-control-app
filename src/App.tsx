import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Personnel from "./pages/Personnel";
import Dispatcher from "./pages/Dispatcher";
import Medical from "./pages/Medical";
import Lampa from "./pages/Lampa";
import Scanner from "./pages/Scanner";
import Security from "./pages/Security";
import Checkpoint from "./pages/Checkpoint";
import Reports from "./pages/Reports";
import Aho from "./pages/Aho";
import Ohs from "./pages/Ohs";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PageRoute({ page, children }: { page: string; children: ReactNode }) {
  const { user, loading, allowedPages } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedPages.includes(page)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/personnel" element={<PageRoute page="personnel"><Personnel /></PageRoute>} />
    <Route path="/dispatcher" element={<PageRoute page="dispatcher"><Dispatcher /></PageRoute>} />
    <Route path="/medical" element={<PageRoute page="medical"><Medical /></PageRoute>} />
    <Route path="/lampa" element={<PageRoute page="lampa"><Lampa /></PageRoute>} />
    <Route path="/scanner" element={<PageRoute page="scanner"><Scanner /></PageRoute>} />
    <Route path="/security" element={<PageRoute page="security"><Security /></PageRoute>} />
    <Route path="/checkpoint" element={<PageRoute page="checkpoint"><Checkpoint /></PageRoute>} />
    <Route path="/aho" element={<PageRoute page="aho"><Aho /></PageRoute>} />
    <Route path="/ohs" element={<PageRoute page="ohs"><Ohs /></PageRoute>} />
    <Route path="/reports" element={<PageRoute page="reports"><Reports /></PageRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/admin" element={<PageRoute page="admin"><Admin /></PageRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;