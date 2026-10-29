import { ReactNode, useEffect } from "react";
import { eventsApi, reportsApi } from "@/lib/api";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useDemo } from "@/contexts/DemoContext";
import HousingConflictAlert from "@/components/aho/HousingConflictAlert";
import PendingAccessBanner from "@/components/demo/PendingAccessBanner";
import PendingAccessAlert from "@/components/admin/PendingAccessAlert";
import PassExpiryAlert from "@/components/checkpoint/PassExpiryAlert";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  useEffect(() => {
    if (localStorage.getItem("mc_demo") === "true" || localStorage.getItem("mc_pending") === "true") return;
    const key = `mc_pass_alert_${new Date().toISOString().slice(0, 13)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    eventsApi.triggerPassAlert().catch(() => {});
    reportsApi.triggerMailings().catch(() => {});
  }, []);
  const { isDemo } = useDemo();

  return (
    <div className={`min-h-screen bg-background ${isDemo ? "pt-10" : ""}`}>
      <Sidebar />
      <div className="ml-60 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <main className="p-6">
          <PendingAccessBanner />
          {children}
        </main>
      </div>
      <HousingConflictAlert />
      <PendingAccessAlert />
      <PassExpiryAlert />
    </div>
  );
}