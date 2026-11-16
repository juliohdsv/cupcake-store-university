"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { adminLogin, adminLogout, fetchAdminSession } from "../lib/api";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";
type AdminRole = "GUEST" | "OWNER";
interface AdminAuthValue {
  status: AuthStatus;
  role: AdminRole | null;
  expired: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  markExpired: () => void;
}

const storageKey = "pit-admin-session-expires-at";
const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [role, setRole] = useState<AdminRole | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  const markExpired = useCallback(() => {
    setStatus("unauthenticated");
    setRole(null);
    setExpiresAt(null);
    setExpired(true);
    sessionStorage.removeItem(storageKey);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const previousExpiry = sessionStorage.getItem(storageKey);
    fetchAdminSession(controller.signal)
      .then(({ expiresAt: expiry, role: sessionRole }) => {
        if (controller.signal.aborted) return;
        setExpiresAt(expiry);
        setStatus("authenticated");
        setRole(sessionRole);
        setExpired(false);
        sessionStorage.setItem(storageKey, String(expiry));
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        )
          return;
        setStatus("unauthenticated");
        setRole(null);
        setExpired(Boolean(previousExpiry));
        sessionStorage.removeItem(storageKey);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || expiresAt === null) return;
    const checkExpiry = () => {
      if (Date.now() >= expiresAt) markExpired();
    };
    const timeout = window.setTimeout(
      markExpired,
      Math.max(0, expiresAt - Date.now()),
    );
    window.addEventListener("focus", checkExpiry);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", checkExpiry);
    };
  }, [status, expiresAt, markExpired]);

  async function login(username: string, password: string) {
    const session = await adminLogin(username, password);
    setStatus("authenticated");
    setRole(session.role);
    setExpiresAt(session.expiresAt);
    setExpired(false);
    sessionStorage.setItem(storageKey, String(session.expiresAt));
  }

  async function logout() {
    await adminLogout();
    setStatus("unauthenticated");
    setRole(null);
    setExpiresAt(null);
    setExpired(false);
    sessionStorage.removeItem(storageKey);
  }

  return (
    <AdminAuthContext.Provider
      value={{ status, role, expired, login, logout, markExpired }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthValue {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("AdminAuthProvider não encontrado.");
  return context;
}
