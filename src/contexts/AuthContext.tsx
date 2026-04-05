import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  authApi,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
} from "@/lib/api";

interface User {
  id: number;
  email: string;
  full_name: string;
  position: string;
  department: string;
  personal_code: string;
  qr_code: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  allowedPages: string[];
  login: (email: string, password: string) => Promise<void>;
  loginByCode: (code: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => void;
}

const ALL_PAGES = ['dashboard', 'personnel', 'dispatcher', 'medical', 'lampa', 'scanner', 'security', 'checkpoint', 'aho', 'ohs', 'reports', 'profile', 'admin'];

function getStoredPages(): string[] {
  const raw = localStorage.getItem("mc_pages");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function setStoredPages(pages: string[]) {
  localStorage.setItem("mc_pages", JSON.stringify(pages));
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [allowedPages, setAllowedPages] = useState<string[]>(getStoredPages());

  useEffect(() => {
    const stored = getStoredUser();
    const isDemo = localStorage.getItem("mc_demo") === "true";
    const onDemoRoute = window.location.pathname.startsWith("/demo");
    const isFreshDemo = localStorage.getItem("mc_demo_fresh") === "true";
    if (isFreshDemo) {
      localStorage.removeItem("mc_demo_fresh");
    } else if (isDemo && !onDemoRoute) {
      localStorage.removeItem("mc_demo");
      localStorage.removeItem("mc_demo_name");
      clearToken();
      setUser(null);
      setAllowedPages([]);
      localStorage.removeItem("mc_pages");
      setLoading(false);
      return;
    }
    if (stored) {
      authApi
        .me()
        .then((data) => {
          setUser(data.user);
          setStoredUser(data.user);
          const pages = data.allowed_pages || (data.user.role === 'admin' ? ALL_PAGES : ['dashboard', 'profile']);
          setAllowedPages(pages);
          setStoredPages(pages);
        })
        .catch(() => {
          clearToken();
          setUser(null);
          setAllowedPages([]);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const clearDemoFlags = () => {
    localStorage.removeItem("mc_demo");
    localStorage.removeItem("mc_demo_name");
  };

  const login = async (email: string, password: string) => {
    clearDemoFlags();
    const data = await authApi.login({ email, password });
    setToken(data.token);
    setUser(data.user);
    setStoredUser(data.user);
    const pages = data.allowed_pages || (data.user.role === 'admin' ? ALL_PAGES : ['dashboard', 'profile']);
    setAllowedPages(pages);
    setStoredPages(pages);
  };

  const loginByCode = async (code: string) => {
    clearDemoFlags();
    const data = await authApi.loginByCode(code);
    setToken(data.token);
    setUser(data.user);
    setStoredUser(data.user);
    const pages = data.allowed_pages || (data.user.role === 'admin' ? ALL_PAGES : ['dashboard', 'profile']);
    setAllowedPages(pages);
    setStoredPages(pages);
  };

  const register = async (regData: Record<string, unknown>) => {
    clearDemoFlags();
    const data = await authApi.register(regData);
    setToken(data.token);
    setUser(data.user);
    setStoredUser(data.user);
    const pages = data.allowed_pages || ['dashboard', 'profile'];
    setAllowedPages(pages);
    setStoredPages(pages);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    clearToken();
    setUser(null);
    setAllowedPages([]);
    localStorage.removeItem("mc_pages");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, allowedPages, login, loginByCode, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;