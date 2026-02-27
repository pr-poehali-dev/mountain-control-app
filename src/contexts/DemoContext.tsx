import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DemoContextType {
  isDemo: boolean;
  demoName: string;
  enterDemo: (token: string, name: string) => void;
  exitDemo: () => void;
  blockAction: (actionName?: string) => boolean;
}

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

  const exitDemo = () => {
    localStorage.removeItem("mc_demo");
    localStorage.removeItem("mc_demo_name");
    localStorage.removeItem("mc_token");
    localStorage.removeItem("mc_user");
    localStorage.removeItem("mc_pages");
    setIsDemo(false);
    setDemoName("");
  };

  const blockAction = (actionName?: string) => {
    if (!isDemo) return false;
    return true;
  };

  return (
    <DemoContext.Provider value={{ isDemo, demoName, enterDemo, exitDemo, blockAction }}>
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