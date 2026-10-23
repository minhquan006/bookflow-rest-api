import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createApiClient } from "../../lib/http";

export type Role = "MEMBER" | "LIBRARIAN" | "ADMIN";
export type User = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
};
type Session = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  csrfToken: string;
  user: User;
};
type AuthState = {
  user: User | null;
  loading: boolean;
  api: ReturnType<typeof createApiClient>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  sessionError: string;
  refreshProfile: () => Promise<void>;
};
const AuthContext = createContext<AuthState | undefined>(undefined);

export function readCsrfCookie() {
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("bookflow_csrf="));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice("bookflow_csrf=".length));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const token = useRef<string | null>(null);
  const csrf = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshFlight = useRef<Promise<void> | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const mounted = useRef(false);
  const epoch = useRef(0);
  const rawApi = useMemo(
    () =>
      createApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
      }),
    [],
  );

  const clearSession = useCallback(() => {
    token.current = null;
    csrf.current = null;
    clearTimeout(timer.current);
    timer.current = undefined;
    if (mounted.current) setUser(null);
  }, []);

  const acceptSession = useCallback((session: Session) => {
    if (!mounted.current) return;
    token.current = session.accessToken;
    csrf.current = session.csrfToken;
    clearTimeout(timer.current);
    if (mounted.current) {
      setUser(session.user);
      setSessionError("");
    }
    // Refresh proactively; only one request may rotate the cookie at a time.
    timer.current = setTimeout(
      () => {
        void refreshRef.current().catch(() => {
          if (mounted.current)
            setSessionError("Your session expired. Please sign in again.");
        });
      },
      Math.max(1_000, (session.expiresIn - 30) * 1_000),
    );
  }, []);

  const refresh = useCallback(() => {
    if (refreshFlight.current) return refreshFlight.current;
    const expectedEpoch = epoch.current;
    const csrfToken = csrf.current ?? readCsrfCookie();
    if (!csrfToken)
      return Promise.reject(new Error("No refresh session is available."));
    const request = rawApi
      .request<{ data: Session }>("/auth/refresh", {
        method: "POST",
        json: {},
        headers: { "X-CSRF-Token": csrfToken },
      })
      .then((result) => {
        if (epoch.current !== expectedEpoch) return;
        acceptSession(result.data);
      })
      .catch((error: unknown) => {
        if (epoch.current === expectedEpoch) clearSession();
        throw error;
      })
      .finally(() => {
        if (refreshFlight.current === request) refreshFlight.current = null;
      });
    refreshFlight.current = request;
    return request;
  }, [rawApi, acceptSession, clearSession]);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
        getAccessToken: () => token.current,
        fetcher: async (input, init) => {
          const requestEpoch = epoch.current;
          const response = await fetch(input, init);
          const method = init?.method?.toUpperCase() ?? "GET";
          if (
            response.status !== 401 ||
            epoch.current !== requestEpoch ||
            !token.current ||
            !["GET", "HEAD"].includes(method) ||
            !new Headers(init?.headers).has("Authorization") ||
            init?.signal?.aborted
          )
            return response;
          try {
            await refreshRef.current();
          } catch {
            return response;
          }
          if (
            epoch.current !== requestEpoch ||
            !token.current ||
            init?.signal?.aborted
          )
            return response;
          const headers = new Headers(init?.headers);
          headers.set("Authorization", `Bearer ${token.current}`);
          return fetch(input, { ...init, headers });
        },
      }),
    [],
  );

  useEffect(() => {
    mounted.current = true;
    if (readCsrfCookie()) {
      void refresh()
        .catch(() => {})
        .finally(() => {
          if (mounted.current) setLoading(false);
        });
    } else setLoading(false);
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      // Finish a pending restore before issuing a new session, avoiding rotation races.
      await refreshFlight.current?.catch(() => {});
      const expectedEpoch = ++epoch.current;
      const result = await rawApi.request<{ data: Session }>("/auth/login", {
        method: "POST",
        json: { email: email.trim().toLowerCase(), password },
      });
      if (epoch.current === expectedEpoch) acceptSession(result.data);
    },
    [rawApi, acceptSession],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      await rawApi.request<{ data: User }>("/auth/register", {
        method: "POST",
        json: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
      });
    },
    [rawApi],
  );

  const logout = useCallback(async () => {
    // Let an in-flight rotation finish so logout revokes the replacement cookie too.
    await refreshFlight.current?.catch(() => {});
    const csrfToken = csrf.current ?? readCsrfCookie();
    epoch.current++;
    clearSession();
    if (!csrfToken) return;
    try {
      await rawApi.request<void>("/auth/logout", {
        method: "POST",
        json: {},
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (mounted.current) setSessionError("");
    } catch {
      const message =
        "Signed out locally, but the server could not revoke the session. Reconnect and sign out again before leaving a shared device.";
      if (mounted.current) setSessionError(message);
      throw new Error(message);
    }
  }, [rawApi, clearSession]);

  const refreshProfile = useCallback(async () => {
    const expectedEpoch = epoch.current;
    const result = await api.request<{ data: User }>("/users/me");
    if (mounted.current && epoch.current === expectedEpoch)
      setUser(result.data);
  }, [api]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        api,
        login,
        register,
        logout,
        sessionError,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
