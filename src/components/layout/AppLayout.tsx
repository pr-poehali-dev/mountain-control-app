import { ReactNode, useEffect } from "react";
import { eventsApi } from "@/lib/api";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useDemo } from "@/contexts/DemoContext";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  useEffect(() => {
    if (localStorage.getItem("mc_demo") === "true") return;
    const key = `mc_pass_alert_${new Date().toISOString().slice(0, 13)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    eventsApi.triggerPassAlert().catch(() => {});
  }, []);
  const { isDemo } = useDemo();

  return (
    <div className={`min-h-screen bg-background ${isDemo ? "pt-10" : ""}`}>
      <Sidebar />
      <div className="ml-60 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}