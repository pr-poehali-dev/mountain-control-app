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
  login: (email: string, password: string) => Promise<void>;
  loginByCode: (code: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      authApi
        .me()
        .then((data) => {
          setUser(data.user);
          setStoredUser(data.user);
        })
        .catch(() => {
          clearToken();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setToken(data.token);
    setUser(data.user);
    setStoredUser(data.user);
  };

  const loginByCode = async (code: string) => {
    const data = await authApi.loginByCode(code);
    setToken(data.token);
    setUser(data.user);
    setStoredUser(data.user);
  };

  const register = async (regData: Record<string, unknown>) => {
    const data = await authApi.register(regData);
    setToken(data.token);
    setUser(data.user);
    setStoredUser(data.user);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginByCode, register, logout }}
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
