"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ApiError, requestJson } from "@/lib/api";
import { useCart } from "./CartProvider";

type Session = { accessToken: string; userId: number; expiresAt: number };
type AuthApi = {
  session: Session | null;
  expired: boolean;
  logoutVersion: number;
  login: (accessToken: string) => void;
  logout: () => void;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
};
const Context = createContext<AuthApi | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [expired, setExpired] = useState(false);
  const [logoutVersion, setLogoutVersion] = useState(0);
  const { clear } = useCart();
  const login = useCallback((accessToken: string) => {
    try {
      const payload = JSON.parse(
        atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (
        !Number.isSafeInteger(payload.sub) ||
        payload.sub < 1 ||
        !Number.isFinite(payload.exp) ||
        payload.exp * 1000 <= Date.now()
      )
        throw new Error();
      setSession({
        accessToken,
        userId: payload.sub,
        expiresAt: payload.exp * 1000,
      });
      setExpired(false);
    } catch {
      throw new Error("Máy chủ trả phiên đăng nhập không hợp lệ.");
    }
  }, []);
  const expire = useCallback(() => {
    setSession(null);
    setExpired(true);
  }, []);
  const logout = useCallback(() => {
    setSession(null);
    setExpired(false);
    clear();
    setLogoutVersion((version) => version + 1);
    try {
      sessionStorage.removeItem("brewlite-checkout");
    } catch {}
  }, [clear]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      expire,
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session, expire]);
  const request = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (!session || session.expiresAt <= Date.now()) {
        expire();
        throw new ApiError("Vui lòng đăng nhập để tiếp tục.", 401);
      }
      try {
        return await requestJson(path, {
          ...init,
          headers: {
            ...Object.fromEntries(new Headers(init.headers)),
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) expire();
        throw error;
      }
    },
    [session, expire],
  );
  return (
    <Context.Provider
      value={{ session, expired, logoutVersion, login, logout, request }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider chưa được gắn vào layout.");
  return auth;
}
