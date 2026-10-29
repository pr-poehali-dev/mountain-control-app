import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import DemoBanner from "@/components/demo/DemoBanner";
import Index from "./pages/Index";
import Login from "./pages/Login";
import { ReactNode, Suspense, lazy, useEffect } from "react";
import FaceOnboardingDialog from "@/components/face/FaceOnboardingDialog";

const Personnel = lazy(() => import("./pages/Personnel"));
const Dispatcher = lazy(() => import("./pages/Dispatcher"));
const Medical = lazy(() => import("./pages/Medical"));
const Lampa = lazy(() => import("./pages/Lampa"));
const Scanner = lazy(() => import("./pages/Scanner"));
const Security = lazy(() => import("./pages/Security"));
const ControlPointPage = lazy(() => import("./pages/ControlPointPage"));
const Reports = lazy(() => import("./pages/Reports"));
const Aho = lazy(() => import("./pages/Aho"));
const Ohs = lazy(() => import("./pages/Ohs"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const DemoEntry = lazy(() => import("./pages/DemoEntry"));
const Landing = lazy(() => import("./pages/Landing"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

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
  const isDemo = localStorage.getItem("mc_demo") === "true";
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (isDemo && (page === "admin" || page === "profile")) return <Navigate to="/" replace />;
  if (page !== "profile" && !allowedPages.includes(page)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Landing />;
  return <Index />;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const pageLoaders = [
  () => import("./pages/Personnel"),
  () => import("./pages/Dispatcher"),
  () => import("./pages/Medical"),
  () => import("./pages/Lampa"),
  () => import("./pages/Scanner"),
  () => import("./pages/Security"),
  () => import("./pages/ControlPointPage"),
  () => import("./pages/Reports"),
  () => import("./pages/Aho"),
  () => import("./pages/Ohs"),
  () => import("./pages/Profile"),
  () => import("./pages/Admin"),
];

function usePrefetchPages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window
        ? (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(cb)
        : window.setTimeout(cb, 1500);
    let i = 0;
    const next = () => {
      if (i >= pageLoaders.length) return;
      pageLoaders[i++]().catch(() => {}).finally(() => idle(next));
    };
    const t = window.setTimeout(() => idle(next), 1200);
    return () => window.clearTimeout(t);
  }, [enabled]);
}

const AppRoutes = () => {
  const { user } = useAuth();
  usePrefetchPages(!!user);
  return (
  <>
    <DemoBanner />
    <FaceOnboardingDialog />
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/demo" element={<DemoEntry />} />
      <Route path="/demo/:token" element={<DemoEntry />} />
      <Route path="/" element={<HomeRoute />} />
      <Route path="/about" element={<Landing />} />
      <Route path="/personnel" element={<PageRoute page="personnel"><Personnel /></PageRoute>} />
      <Route path="/dispatcher" element={<PageRoute page="dispatcher"><Dispatcher /></PageRoute>} />
      <Route path="/medical" element={<PageRoute page="medical"><Medical /></PageRoute>} />
      <Route path="/lampa" element={<PageRoute page="lampa"><Lampa /></PageRoute>} />
      <Route path="/scanner" element={<PageRoute page="scanner"><Scanner /></PageRoute>} />
      <Route path="/security" element={<PageRoute page="security"><Security /></PageRoute>} />
      <Route path="/checkpoint" element={<PageRoute page="checkpoint"><ControlPointPage main /></PageRoute>} />
      <Route path="/point/:id" element={<ProtectedRoute><ControlPointPage /></ProtectedRoute>} />
      <Route path="/aho" element={<PageRoute page="aho"><Aho /></PageRoute>} />
      <Route path="/ohs" element={<PageRoute page="ohs"><Ohs /></PageRoute>} />
      <Route path="/reports" element={<PageRoute page="reports"><Reports /></PageRoute>} />
      <Route path="/profile" element={<PageRoute page="profile"><Profile /></PageRoute>} />
      <Route path="/admin" element={<PageRoute page="admin"><Admin /></PageRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DemoProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </DemoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;