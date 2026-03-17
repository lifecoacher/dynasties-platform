import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { setAuthToken } from "@workspace/api-client-react";
import { useClerk, useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyName?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isClerkMode: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "dynasties_token";
const USER_KEY = "dynasties_user";
const MANUAL_LOGOUT_KEY = "dynasties_manual_logout";

function getBaseUrl() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

async function validateToken(savedToken: string): Promise<User | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return {
      ...data,
      companyName: data.companyName || data.company?.name || undefined,
    } as User;
  } catch {
    return null;
  }
}

function useClerkEnabled(): boolean {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  return !!(key && key.startsWith("pk_"));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const logoutRef = useRef<() => void>(() => {});
  const clerkEnabled = useClerkEnabled();
  const clerkSyncedRef = useRef(false);

  let clerkUser: ReturnType<typeof useUser>["user"] = null;
  let clerkIsLoaded = true;
  let clerkIsSignedIn = false;
  let clerkSignOut: (() => Promise<void>) | null = null;

  let clerkGetToken: (() => Promise<string | null>) | null = null;

  if (clerkEnabled) {
    const clerkUserHook = useUser();
    const clerkAuthHook = useClerkAuth();
    const clerk = useClerk();
    clerkUser = clerkUserHook.user;
    clerkIsLoaded = clerkUserHook.isLoaded;
    clerkIsSignedIn = clerkAuthHook.isSignedIn ?? false;
    clerkSignOut = () => clerk.signOut();
    clerkGetToken = () => clerkAuthHook.getToken();
  }

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.setItem(MANUAL_LOGOUT_KEY, "true");
    clerkSyncedRef.current = false;
    if (clerkEnabled && clerkSignOut) {
      clerkSignOut().catch(() => {});
    }
  }, [clerkEnabled, clerkSignOut]);

  logoutRef.current = logout;

  useEffect(() => {
    if (clerkEnabled) {
      if (!clerkIsLoaded) return;

      if (clerkIsSignedIn && clerkUser && !clerkSyncedRef.current) {
        clerkSyncedRef.current = true;
        (async () => {
          try {
            const sessionToken = clerkGetToken ? await clerkGetToken() : null;
            if (!sessionToken) {
              console.error("[auth] No Clerk session token available");
              clerkSyncedRef.current = false;
              setIsLoading(false);
              return;
            }
            const res = await fetch(`${getBaseUrl()}/api/auth/clerk-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionToken}`,
              },
            });
            if (!res.ok) throw new Error("Clerk sync failed");
            const { data } = await res.json();
            const userData = {
              ...data.user,
              companyName: data.user.companyName || data.user.company?.name || undefined,
            };
            setToken(data.token);
            setUser(userData);
            setAuthToken(data.token);
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify(userData));
            localStorage.removeItem(MANUAL_LOGOUT_KEY);
          } catch (err) {
            console.error("[auth] Clerk sync error:", err);
            clerkSyncedRef.current = false;
          } finally {
            setIsLoading(false);
          }
        })();
      } else if (!clerkIsSignedIn) {
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        const validatedUser = await validateToken(savedToken);
        if (cancelled) return;
        if (validatedUser) {
          setToken(savedToken);
          setUser(validatedUser);
          setAuthToken(savedToken);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
      setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [clerkEnabled, clerkIsLoaded, clerkIsSignedIn, clerkUser]);

  useEffect(() => {
    const handle = (e: PromiseRejectionEvent) => {
      const err = e.reason;
      if (err && typeof err === "object" && "status" in err && err.status === 401) {
        logoutRef.current();
      }
    };
    window.addEventListener("unhandledrejection", handle);
    return () => window.removeEventListener("unhandledrejection", handle);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Login failed (${res.status})`);
    }

    const { data } = await res.json();
    const userData = {
      ...data.user,
      companyName: data.user.companyName || data.user.company?.name || data.company?.name || undefined,
    };
    setToken(data.token);
    setUser(userData);
    setAuthToken(data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.removeItem(MANUAL_LOGOUT_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isClerkMode: clerkEnabled }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
