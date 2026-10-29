import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DemoContextType {
  isDemo: boolean;
  demoName: string;
  enterDemo: (token: string, name: string) => void;
  exitDemo: () => void;
  isPreview: boolean;
  startPreview: (session: { token: string; user: Record<string, unknown>; allowed_pages: string[] }) => void;
  blockAction: (actionName?: string) => boolean;
}

const BACKUP_KEY = "mc_admin_backup";
const BACKUP_FIELDS = ["mc_token", "mc_user", "mc_pages", "mc_pending"];

const DemoContext = createContext<DemoContextType | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => localStorage.getItem("mc_demo") === "true");
  const [demoName, setDemoName] = useState(() => localStorage.getItem("mc_demo_name") || "");

  const enterDemo = (token: string, name: string) => {
    localStorage.setItem("mc_demo", "true");
    localStorage.setItem("mc_demo_name", name);
    setIsDemo(true);
    setDemoName(name);
  };

  const isPreview = !!localStorage.getItem(BACKUP_KEY);

  const startPreview = (session: { token: string; user: Record<string, unknown>; allowed_pages: string[] }) => {
    const backup: Record<string, string | null> = {};
    BACKUP_FIELDS.forEach((k) => (backup[k] = localStorage.getItem(k)));
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    localStorage.removeItem("mc_pending");
    localStorage.setItem("mc_token", session.token);
    localStorage.setItem("mc_user", JSON.stringify(session.user));
    localStorage.setItem("mc_pages", JSON.stringify(session.allowed_pages));
    localStorage.setItem("mc_demo_fresh", "true");
    localStorage.setItem("mc_demo", "true");
    localStorage.setItem("mc_demo_name", "");
    window.location.href = "/";
  };

  const exitDemo = () => {
    const raw = localStorage.getItem(BACKUP_KEY);
    localStorage.removeItem("mc_demo");
    localStorage.removeItem("mc_demo_name");
    localStorage.removeItem("mc_token");
    localStorage.removeItem("mc_user");
    localStorage.removeItem("mc_pages");
    setIsDemo(false);
    setDemoName("");
    if (raw) {
      localStorage.removeItem(BACKUP_KEY);
      try {
        const backup = JSON.parse(raw) as Record<string, string | null>;
        Object.entries(backup).forEach(([k, v]) => {
          if (v !== null) localStorage.setItem(k, v);
          else localStorage.removeItem(k);
        });
      } catch {
        /* ignore */
      }
      window.location.href = "/admin";
    }
  };

  const blockAction = (actionName?: string) => {
    if (!isDemo) return false;
    return true;
  };

  return (
    <DemoContext.Provider value={{ isDemo, demoName, enterDemo, exitDemo, blockAction, isPreview, startPreview }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}

export default DemoContext;