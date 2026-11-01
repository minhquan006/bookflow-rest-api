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
import { ApiError, createApiClient } from "../../lib/http";
import {
  canRestore,
  ensureSessionSupport,
  notifySessionChange,
  readRevision,
  sessionChangedError,
  watchSessionChange,
  withSessionLock,
  writeRevision,
} from "./session-coordination";

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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshFlight = useRef<Promise<void> | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const mounted = useRef(false);
  const epoch = useRef(0);
  const identity = useRef<string | null>(null);
  const rawApi = useMemo(
    () =>
      createApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
      }),
    [],
  );

  const clearSession = useCallback(() => {
    token.current = null;
    identity.current = null;
    clearTimeout(timer.current);
    timer.current = undefined;
    if (mounted.current) setUser(null);
  }, []);

  const acceptSession = useCallback((session: Session) => {
    if (!mounted.current) return;
    const nextIdentity = `${session.user.id}:${session.user.role}`;
    if (identity.current && identity.current !== nextIdentity) epoch.current++;
    identity.current = nextIdentity;
    token.current = session.accessToken;
    clearTimeout(timer.current);
    if (mounted.current) {
      setUser(session.user);
      setSessionError("");
    }
    // Refresh proactively; only one request may rotate the cookie at a time.
    timer.current = setTimeout(
      () => {
        void refreshRef.current().catch(() => {});
      },
      Math.max(1_000, (session.expiresIn - 30) * 1_000),
    );
  }, []);

  const revision = useRef<string | null>(null);
  const assertCurrent = useCallback(
    (expected: number, expectedRevision: string | null) => {
      if (epoch.current !== expected || readRevision() !== expectedRevision)
        throw new Error(sessionChangedError);
    },
    [],
  );
  const publish = useCallback((value: string) => {
    writeRevision(value);
    revision.current = value;
    notifySessionChange();
  }, []);
  const rejectSession = useCallback(
    (error: unknown, expected: number) => {
      if (epoch.current !== expected) return;
      epoch.current++;
      clearSession();
      if (mounted.current)
        setSessionError(
          error instanceof ApiError
            ? "Your session expired. Please sign in again."
            : (error as Error).message,
        );
    },
    [clearSession],
  );

  // Only call while holding the shared lock. Read the actual cookie after acquiring it.
  const refreshUnlocked = useCallback(
    async (expected: number, expectedRevision: string | null) => {
      try {
        assertCurrent(expected, expectedRevision);
        if (!canRestore(expectedRevision)) throw new Error(sessionChangedError);
        const csrfToken = readCsrfCookie();
        if (!csrfToken) throw new Error("No refresh session is available.");
        const result = await rawApi.request<{ data: Session }>(
          "/auth/refresh",
          {
            method: "POST",
            json: {},
            headers: { "X-CSRF-Token": csrfToken },
            signal: AbortSignal.timeout(15_000),
          },
        );
        assertCurrent(expected, expectedRevision);
        acceptSession(result.data);
      } catch (error) {
        rejectSession(error, expected);
        throw error;
      }
    },
    [rawApi, acceptSession, assertCurrent, rejectSession],
  );

  const refresh = useCallback(() => {
    if (refreshFlight.current) return refreshFlight.current;
    const expected = epoch.current;
    const expectedRevision = revision.current;
    const request = withSessionLock(() =>
      refreshUnlocked(expected, expectedRevision),
    )
      .catch((error: unknown) => {
        rejectSession(error, expected);
        throw error;
      })
      .finally(() => {
        if (refreshFlight.current === request) refreshFlight.current = null;
      });
    refreshFlight.current = request;
    return request;
  }, [refreshUnlocked, rejectSession]);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const api = useMemo(() => {
    const client = createApiClient({
      baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
      getAccessToken: () => token.current,
    });
    const requestWithMetadata = async <T,>(
      path: string,
      options: NonNullable<Parameters<typeof client.request>[1]> = {},
    ) => {
      if (!token.current) return client.requestWithMetadata<T>(path, options);
      const expected = epoch.current;
      const expectedRevision = revision.current;
      return withSessionLock(async () => {
        assertCurrent(expected, expectedRevision);
        options.signal?.throwIfAborted();
        try {
          let result;
          try {
            result = await client.requestWithMetadata<T>(path, options);
          } catch (error) {
            assertCurrent(expected, expectedRevision);
            if (
              !(error instanceof ApiError) ||
              error.problem.status !== 401 ||
              !["GET", "HEAD"].includes(
                options.method?.toUpperCase() ?? "GET",
              ) ||
              options.signal?.aborted
            )
              throw error;
            await refreshUnlocked(expected, expectedRevision);
            result = await client.requestWithMetadata<T>(path, options);
          }
          // The lock includes body parsing, preventing an old response reaching a new identity.
          assertCurrent(expected, expectedRevision);
          return result;
        } catch (error) {
          assertCurrent(expected, expectedRevision);
          throw error;
        }
      });
    };
    return {
      requestWithMetadata,
      async request<T>(
        path: string,
        options?: Parameters<typeof client.request>[1],
      ): Promise<T> {
        return (await requestWithMetadata<T>(path, options)).data;
      },
    };
  }, [assertCurrent, refreshUnlocked]);

  useEffect(() => {
    mounted.current = true;
    const sync = () => {
      try {
        const current = readRevision();
        if (current === revision.current) return;
        revision.current = current;
        epoch.current++;
        clearSession();
        setSessionError(sessionChangedError);
      } catch (error) {
        epoch.current++;
        clearSession();
        setSessionError((error as Error).message);
      }
    };
    const stop = watchSessionChange(sync);
    try {
      revision.current = readRevision();
      if (readCsrfCookie() && canRestore(revision.current)) {
        void refresh()
          .catch(() => {})
          .finally(() => {
            if (mounted.current) setLoading(false);
          });
      } else setLoading(false);
    } catch (error) {
      setLoading(false);
      setSessionError((error as Error).message);
    }
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      stop();
    };
  }, [refresh, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      ensureSessionSupport();
      const expected = ++epoch.current;
      clearSession();
      const id = crypto.randomUUID();
      const pending = `pending:${id}`;
      publish(pending);
      await withSessionLock(async () => {
        assertCurrent(expected, pending);
        const result = await rawApi.request<{ data: Session }>("/auth/login", {
          method: "POST",
          json: { email: email.trim().toLowerCase(), password },
          signal: AbortSignal.timeout(15_000),
        });
        assertCurrent(expected, pending);
        publish(`active:${id}`);
        acceptSession(result.data);
      });
    },
    [rawApi, acceptSession, assertCurrent, publish, clearSession],
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
    const hadSession = Boolean(token.current || readCsrfCookie());
    const expected = ++epoch.current;
    clearSession();
    const signedOut = `signed-out:${crypto.randomUUID()}`;
    try {
      publish(signedOut);
      await withSessionLock(async () => {
        assertCurrent(expected, signedOut);
        const csrfToken = readCsrfCookie();
        if (!csrfToken) {
          if (hadSession) throw new Error("No refresh session is available.");
          return;
        }
        await rawApi.request<void>("/auth/logout", {
          method: "POST",
          json: {},
          headers: { "X-CSRF-Token": csrfToken },
          signal: AbortSignal.timeout(15_000),
        });
        assertCurrent(expected, signedOut);
      });
      if (mounted.current && epoch.current === expected) setSessionError("");
    } catch {
      if (epoch.current !== expected) return;
      const message =
        "Signed out locally, but the server could not revoke the session. Reconnect and sign out again before leaving a shared device.";
      if (mounted.current) setSessionError(message);
      throw new Error(message);
    }
  }, [rawApi, clearSession, publish, assertCurrent]);

  const refreshProfile = useCallback(async () => {
    const expectedEpoch = epoch.current;
    const result = await api.request<{ data: User }>("/users/me");
    if (mounted.current && epoch.current === expectedEpoch) {
      const nextIdentity = `${result.data.id}:${result.data.role}`;
      if (identity.current !== nextIdentity) epoch.current++;
      identity.current = nextIdentity;
      setUser(result.data);
    }
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
