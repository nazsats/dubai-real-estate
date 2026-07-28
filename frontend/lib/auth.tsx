"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, getToken, setToken, setUnauthorizedHandler, User } from "./api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (agency: string, name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // When any API call reports an expired token, drop the user back to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/api/auth/me")
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { access_token } = await api.post<{ access_token: string }>("/api/auth/login", { email, password });
    setToken(access_token);
    setUser(await api.get<User>("/api/auth/me"));
    router.push("/dashboard");
  }

  async function signup(agency: string, name: string, email: string, password: string) {
    const { access_token } = await api.post<{ access_token: string }>("/api/auth/signup", {
      agency_name: agency,
      full_name: name,
      email,
      password,
    });
    setToken(access_token);
    setUser(await api.get<User>("/api/auth/me"));
    router.push("/dashboard");
  }

  function logout() {
    clearToken();
    setUser(null);
    router.push("/login");
  }

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
