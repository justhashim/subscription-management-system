"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, USE_MOCKS } from "@/lib/api";
import {
  clearClientSession,
  getClientSession,
  setClientSession,
} from "./session";
import type { AuthUser, LoginInput, RegisterInput } from "@/types/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      const session = getClientSession();
      let nextUser = session;

      if (!USE_MOCKS) {
        try {
          const remoteUser = await api.auth.me();
          nextUser = remoteUser;

          if (remoteUser) {
            setClientSession(remoteUser);
          } else {
            clearClientSession();
          }
        } catch {
          nextUser = session;
        }
      }

      if (active) {
        setUser(nextUser);
        setLoading(false);
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const nextUser = await api.auth.login(input);
      setClientSession(nextUser);
      setUser(nextUser);
      router.push("/dashboard");
    },
    [router],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const nextUser = await api.auth.register(input);
      setClientSession(nextUser);
      setUser(nextUser);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      clearClientSession();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "ADMIN",
      isCustomer: user?.role === "CUSTOMER" || user?.role === "MEMBER",
      login,
      register,
      logout,
    }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
