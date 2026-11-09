"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { ApiError, requestJson } from "@/lib/api";
import { useCart } from "./CartProvider";

import { parseSession, proxyPath, SessionLifecycle, type Session } from "@/lib/session";
type AuthApi = {
  session: Session | null;
  loading: boolean;
  logoutPending: boolean;
  expired: boolean;
  logoutVersion: number;
  login: (session: unknown) => void;
  logout: () => void;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
};
const Context = createContext<AuthApi | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [expired, setExpired] = useState(false);
  const [logoutVersion, setLogoutVersion] = useState(0);
  const { clear } = useCart();
  const [loading, setLoading] = useState(true);
  const [logoutNotice, setLogoutNotice] = useState("");
  const lifecycle = useRef(new SessionLifecycle());
  const [logoutPending, setLogoutPending] = useState(false);
  const login = useCallback((value: unknown) => {
    const restored = parseSession(value);
    lifecycle.current.login();
    setLogoutNotice("");
    setSession(restored);
    setExpired(false);
    setLoading(false);
  }, []);
  useEffect(() => {
    let disposed = false;
    const current = lifecycle.current.capture();
    requestJson("/api/session/me")
      .then((value) => {
        if (!disposed && lifecycle.current.isCurrent(current)) setSession(parseSession(value));
      })
      .catch(() => {
        // A failed bootstrap must never install an unvalidated session.
      })
      .finally(() => {
        if (!disposed && lifecycle.current.isCurrent(current)) setLoading(false);
      });
    return () => { disposed = true; };
  }, []);
  const expire = useCallback(() => {
    lifecycle.current.advance();
    setLoading(false);
    setSession(null);
    setExpired(true);
  }, []);
  const logout = useCallback(() => {
    const version = lifecycle.current.beginLogout();
    if (version === null) return;
    setLogoutPending(true);
    setLoading(true);
    setSession(null);
    setLogoutNotice("");
    void requestJson("/api/session/logout", {
      method: "POST",
      headers: { "x-brewlite-csrf": "1", "Content-Type": "application/json" },
      body: "{}",
    }).then(() => {
      if (lifecycle.current.finishLogout(version, true)) {
        setLogoutPending(false);
        setLoading(false);
      }
    }).catch(() => {
      if (lifecycle.current.finishLogout(version, false)) {
        setLoading(false);
        setLogoutNotice("Chưa thu hồi được phiên trên máy chủ. Vui lòng thử đăng xuất lại trước khi đóng hoặc tải lại trang.");
      }
    });
    setExpired(false);
    clear();
    setLogoutVersion((value) => value + 1);
    try { sessionStorage.removeItem("brewlite-checkout"); } catch {}
  }, [clear]);
  useEffect(() => {
    if (!session) return;
    const version = lifecycle.current.capture();
    const timer = window.setTimeout(
      () => { if (lifecycle.current.isCurrent(version)) expire(); },
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
      return lifecycle.current.request(() => requestJson(proxyPath(path), {
          ...init,
          headers: {
            ...Object.fromEntries(new Headers(init.headers)),
            "x-brewlite-csrf": "1",
          },
        }), (error) => error instanceof ApiError && error.status === 401, expire);
    },
    [session, expire],
  );
  return (
    <Context.Provider
      value={{ session, loading, logoutPending, expired, logoutVersion, login, logout, request }}
    >
      {logoutNotice && <div role="alert"><p>{logoutNotice}</p><button type="button" onClick={logout}>Thử đăng xuất trên mọi thiết bị</button></div>}
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("AuthProvider chưa được gắn vào layout.");
  return auth;
}
