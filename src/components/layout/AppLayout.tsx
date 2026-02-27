import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useDemo } from "@/contexts/DemoContext";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppLayout({ children, title, subtitle }: AppLayoutProps) {
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