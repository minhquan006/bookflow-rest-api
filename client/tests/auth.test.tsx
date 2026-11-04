import { StrictMode, useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../src/features/auth/AuthContext";
import { LoginPage } from "../src/features/auth/LoginPage";
import { AppLayout } from "../src/app/AppLayout";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { RegisterPage } from "../src/features/auth/RegisterPage";

const user = {
  id: "10000000-0000-4000-8000-000000000001",
  fullName: "Alex Reader",
  email: "alex@example.test",
  role: "MEMBER",
  status: "ACTIVE",
  createdAt: "2026-10-20T00:00:00Z",
};
const session = {
  accessToken: "memory-only-access-token",
  tokenType: "Bearer",
  expiresIn: 900,
  csrfToken: "signed-csrf-token",
  user,
};
function sessionResponse(value = session) {
  document.cookie = `bookflow_csrf=${value.csrfToken}; Path=/`;
  return Response.json({ data: value });
}
const problem = (status: number, detail: string) =>
  Response.json(
    { type: "about:blank", title: "Request failed", status, detail },
    { status },
  );

function Probe() {
  const auth = useAuth();
  return (
    <>
      <p>
        {auth.loading ? "Restoring session" : (auth.user?.fullName ?? "Guest")}
      </p>
      <p>{auth.sessionError}</p>
      <button
        onClick={() => {
          void auth
            .login("alex@example.test", "local-only-test-password")
            .catch(() => {});
        }}
      >
        Test login
      </button>
      <button
        onClick={() => {
          void auth.logout().catch(() => {});
        }}
      >
        Test logout
      </button>
      <button
        onClick={() => {
          void Promise.all([
            auth.api.request("/users/me"),
            auth.api.request("/users/me"),
          ]).catch(() => {});
        }}
      >
        Read twice
      </button>
      <button
        onClick={() => {
          void auth.refreshProfile().catch(() => {});
        }}
      >
        Refresh profile
      </button>
      <button
        onClick={() => {
          void auth.api
            .request("/loans", {
              method: "POST",
              json: { bookId: "example-book" },
            })
            .catch(() => {});
        }}
      >
        Create loan
      </button>
    </>
  );
}
function renderProbe(strict = false) {
  return render(
    strict ? (
      <StrictMode>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </StrictMode>
    ) : (
      <AuthProvider>
        <Probe />
      </AuthProvider>
    ),
  );
}

afterEach(() => {
  document.cookie = "bookflow_csrf=; Max-Age=0; Path=/";
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("memory-only authentication", () => {
  it("starts anonymously without making a refresh request when no session cookie exists", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("restores once under StrictMode and uses CSRF and bearer headers without browser storage", async () => {
    document.cookie = "bookflow_csrf=signed-csrf-token; Path=/";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/refresh")
          ? sessionResponse()
          : Response.json({ data: user }),
      );
    vi.stubGlobal("fetch", fetcher);
    renderProbe(true);
    expect(await screen.findByText("Alex Reader")).toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/refresh"),
      ),
    ).toHaveLength(1);
    const restore = fetcher.mock.calls[0][1];
    expect(restore?.method).toBe("POST");
    expect(restore?.credentials).toBe("same-origin");
    expect(new Headers(restore?.headers).get("X-CSRF-Token")).toBe(
      "signed-csrf-token",
    );
    await userEvent.click(screen.getByRole("button", { name: "Read twice" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get("Authorization"),
    ).toBe(`Bearer ${session.accessToken}`);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("coalesces concurrent expired GETs into one rotation and retries each read once", async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input, init) => {
        if (String(input).endsWith("/auth/login")) return sessionResponse();
        if (String(input).endsWith("/auth/refresh"))
          return new Promise<Response>((resolve) => {
            complete = resolve;
          });
        return new Headers(init?.headers).get("Authorization") ===
          "Bearer replacement-token"
          ? Response.json({ data: user })
          : problem(401, "Expired access token");
      });
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    expect(await screen.findByText("Alex Reader")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Read twice" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([input]) =>
          String(input).endsWith("/auth/refresh"),
        ),
      ).toHaveLength(1),
    );
    await act(async () =>
      complete(
        Response.json({
          data: { ...session, accessToken: "replacement-token" },
        }),
      ),
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([input]) =>
          String(input).endsWith("/users/me"),
        ),
      ).toHaveLength(4),
    );
  });

  it("does not automatically repeat a mutation after an unauthorized response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/login")
          ? sessionResponse()
          : problem(401, "Expired access token"),
      );
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText("Alex Reader");
    await userEvent.click(screen.getByRole("button", { name: "Create loan" }));
    expect(
      fetcher.mock.calls.filter(([input]) => String(input).endsWith("/loans")),
    ).toHaveLength(1);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/refresh"),
      ),
    ).toHaveLength(0);
  });

  it.each(["headers", "body"])(
    "revokes without waiting for a mutation's stalled %s",
    async (stage) => {
      let release!: () => void;
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(async (input) => {
          if (String(input).endsWith("/auth/login")) return sessionResponse();
          if (String(input).endsWith("/auth/logout"))
            return new Response(null, { status: 204 });
          if (stage === "headers")
            return new Promise<Response>((resolve) => {
              release = () =>
                resolve(Response.json({ data: { id: "late-loan" } }));
            });
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"data":'));
                release = () => {
                  controller.enqueue(
                    new TextEncoder().encode('{"id":"late-loan"}}'),
                  );
                  controller.close();
                };
              },
            }),
          );
        });
      vi.stubGlobal("fetch", fetcher);
      renderProbe();
      await userEvent.click(screen.getByRole("button", { name: "Test login" }));
      await screen.findByText(user.fullName);
      await userEvent.click(
        screen.getByRole("button", { name: "Create loan" }),
      );
      await waitFor(() => expect(release).toBeTypeOf("function"));
      try {
        await userEvent.click(
          screen.getByRole("button", { name: "Test logout" }),
        );
        await waitFor(() =>
          expect(
            fetcher.mock.calls.filter(([input]) =>
              String(input).endsWith("/auth/logout"),
            ),
          ).toHaveLength(1),
        );
        expect(screen.getByText("Guest")).toBeInTheDocument();
      } finally {
        await act(async () => release());
      }
      expect(
        fetcher.mock.calls.filter(([input]) =>
          String(input).endsWith("/loans"),
        ),
      ).toHaveLength(1);
      expect(screen.queryByText(user.fullName)).not.toBeInTheDocument();
    },
  );

  it("clears local authentication and explains server revocation failure on logout", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/login")
          ? sessionResponse()
          : problem(503, "Unavailable"),
      );
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText("Alex Reader");
    await userEvent.click(screen.getByRole("button", { name: "Test logout" }));
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    expect(
      await screen.findByText(/server could not revoke the session/),
    ).toBeInTheDocument();
    const logout = fetcher.mock.calls.find(([input]) =>
      String(input).endsWith("/auth/logout"),
    );
    expect(new Headers(logout?.[1]?.headers).get("X-CSRF-Token")).toBe(
      session.csrfToken,
    );
  });

  it("keeps a visible retry after revocation fails, and clears it after success", async () => {
    let attempts = 0;
    let complete!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).endsWith("/auth/login")) return sessionResponse();
      if (String(input).endsWith("/auth/logout")) {
        attempts++;
        if (attempts === 1) return problem(503, "Unavailable");
        return new Promise<Response>((resolve) => {
          complete = resolve;
        });
      }
      return Response.json({ data: user });
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <LanguageProvider>
        <AuthProvider>
          <AppLayout path="/" onNavigate={vi.fn()}>
            <Probe />
          </AppLayout>
        </AuthProvider>
      </LanguageProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByRole("button", { name: user.fullName });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const retry = await screen.findByRole("button", { name: "Retry sign out" });
    expect(screen.getByText("Guest")).toBeInTheDocument();
    await userEvent.click(retry);
    await waitFor(() => expect(attempts).toBe(2));
    expect(retry).toBeDisabled();
    await act(async () => complete(new Response(null, { status: 204 })));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Retry sign out" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText(/server could not revoke/),
    ).not.toBeInTheDocument();
  });

  it("restores a revocation retry from a signed-out marker without restoring the user", async () => {
    localStorage.setItem(
      "bookflow.session.revision",
      "signed-out:failed-attempt",
    );
    document.cookie = "bookflow_csrf=still-current; Path=/";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <AppLayout path="/" onNavigate={vi.fn()}>
          Public page
        </AppLayout>
      </AuthProvider>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Retry sign out" }),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(String(fetcher.mock.calls[0][0])).toMatch(/auth\/logout$/);
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("X-CSRF-Token"),
    ).toBe("still-current");
  });

  it("never lets an old revocation retry revoke a newer account", async () => {
    localStorage.setItem(
      "bookflow.session.revision",
      "signed-out:failed-attempt",
    );
    document.cookie = "bookflow_csrf=still-current; Path=/";
    let state!: ReturnType<typeof useAuth>;
    function Capture() {
      const auth = useAuth();
      useEffect(() => {
        state = auth;
      }, [auth]);
      return <Probe />;
    }
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => sessionResponse());
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
    const retry = state.retryLogout;
    await act(async () => {
      localStorage.setItem("bookflow.session.revision", "active:other-user");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "bookflow.session.revision" }),
      );
    });
    await expect(retry()).rejects.toThrow(/session changed/);
    expect(fetcher).not.toHaveBeenCalled();
    expect(state.revocationPending).toBe(false);
    expect(state.sessionError).toMatch(/session changed/);
  });

  it("never restores a logged-out identity from an earlier profile response", async () => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).endsWith("/auth/login")) return sessionResponse();
      if (String(input).endsWith("/auth/logout"))
        return new Response(null, { status: 204 });
      return new Promise<Response>((resolve) => {
        complete = resolve;
      });
    });
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText("Alex Reader");
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh profile" }),
    );
    await waitFor(() => expect(complete).toBeTypeOf("function"));
    await userEvent.click(screen.getByRole("button", { name: "Test logout" }));
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    await act(async () => {
      complete(Response.json({ data: user }));
    });
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.queryByText("Alex Reader")).not.toBeInTheDocument();
  });

  it("does not rotate or restore a session when an old request fails after logout", async () => {
    let finishProfile!: (response: Response) => void;
    let finishLogout!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).endsWith("/auth/login")) return sessionResponse();
      if (String(input).endsWith("/auth/logout"))
        return new Promise<Response>((resolve) => {
          finishLogout = resolve;
        });
      if (String(input).endsWith("/auth/refresh")) return sessionResponse();
      return new Promise<Response>((resolve) => {
        finishProfile = resolve;
      });
    });
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText("Alex Reader");
    document.cookie = "bookflow_csrf=signed-csrf-token; Path=/";
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh profile" }),
    );
    await waitFor(() => expect(finishProfile).toBeTypeOf("function"));
    await userEvent.click(screen.getByRole("button", { name: "Test logout" }));
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    await act(async () => {
      finishProfile(problem(401, "Expired access token"));
    });
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/refresh"),
      ),
    ).toHaveLength(0);
    expect(screen.getByText("Guest")).toBeInTheDocument();
    await waitFor(() => expect(finishLogout).toBeTypeOf("function"));
    await act(async () => {
      finishLogout(new Response(null, { status: 204 }));
    });
  });

  it("refreshes proactively before access-token expiration", async () => {
    vi.useFakeTimers();
    document.cookie = "bookflow_csrf=signed-csrf-token; Path=/";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: { ...session, expiresIn: 35 } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await act(async () => {
      renderProbe();
    });
    expect(screen.getByText("Alex Reader")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(
      Response.json({
        data: {
          ...session,
          accessToken: "rotated-access-token",
          expiresIn: 900,
        },
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("reads a peer's new CSRF cookie inside the lock before refresh and logout", async () => {
    let rotated = false;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input, init) => {
        if (String(input).endsWith("/auth/login")) return sessionResponse();
        if (String(input).endsWith("/auth/refresh")) {
          expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe(
            "peer-cookie",
          );
          rotated = true;
          return sessionResponse({ ...session, csrfToken: "latest-cookie" });
        }
        if (String(input).endsWith("/auth/logout")) {
          expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe(
            "another-peer-cookie",
          );
          return new Response(null, { status: 204 });
        }
        return rotated
          ? Response.json({ data: user })
          : problem(401, "Expired");
      });
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText(user.fullName);
    document.cookie = "bookflow_csrf=peer-cookie; Path=/";
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh profile" }),
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([input]) =>
          String(input).endsWith("/auth/refresh"),
        ),
      ).toHaveLength(1),
    );
    document.cookie = "bookflow_csrf=another-peer-cookie; Path=/";
    await userEvent.click(screen.getByRole("button", { name: "Read twice" }));
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/refresh"),
      ),
    ).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Test logout" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([input]) =>
          String(input).endsWith("/auth/logout"),
        ),
      ).toBe(true),
    );
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(Object.keys(localStorage)).toEqual(["bookflow.session.revision"]);
    expect(localStorage.getItem("bookflow.session.revision")).toMatch(
      /^signed-out:/,
    );
    expect(JSON.stringify(localStorage)).not.toContain(session.accessToken);
    expect(JSON.stringify(localStorage)).not.toContain(session.csrfToken);
    expect(JSON.stringify(localStorage)).not.toContain(user.email);
  });

  it("does not accept a late refresh after logout, and revokes its replacement cookie", async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input, init) => {
        if (String(input).endsWith("/auth/login")) return sessionResponse();
        if (String(input).endsWith("/auth/refresh"))
          return new Promise<Response>((resolve) => {
            finish = resolve;
          });
        if (String(input).endsWith("/auth/logout")) {
          expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe(
            "replacement-csrf",
          );
          return new Response(null, { status: 204 });
        }
        return problem(401, "Expired");
      });
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText(user.fullName);
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh profile" }),
    );
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    await userEvent.click(screen.getByRole("button", { name: "Test logout" }));
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    await act(async () =>
      finish(sessionResponse({ ...session, csrfToken: "replacement-csrf" })),
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([input]) =>
          String(input).endsWith("/auth/logout"),
        ),
      ).toHaveLength(1),
    );
    expect(screen.queryByText(user.fullName)).not.toBeInTheDocument();
  });

  it("discards a pending private response when a peer switches identity", async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).endsWith("/auth/login")) return sessionResponse();
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText(user.fullName);
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh profile" }),
    );
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    await act(async () => {
      localStorage.setItem("bookflow.session.revision", "active:other-account");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "bookflow.session.revision" }),
      );
      finish(Response.json({ data: user }));
    });
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(
      screen.getByText(/session changed in another tab/),
    ).toBeInTheDocument();
  });

  it("clears the identity when a read discovers the refresh family is revoked", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/login")
          ? sessionResponse()
          : problem(401, "Session revoked"),
      );
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    await userEvent.click(screen.getByRole("button", { name: "Test login" }));
    await screen.findByText(user.fullName);
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh profile" }),
    );
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    expect(
      screen.getByText("Your session expired. Please sign in again."),
    ).toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/auth/refresh"),
      ),
    ).toHaveLength(1);
  });

  it("keeps a failed logout signed out across reload even when cookies remain", async () => {
    localStorage.setItem("bookflow.session.revision", "signed-out:previous");
    document.cookie = "bookflow_csrf=old-cookie; Path=/";
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    expect(await screen.findByText("Guest")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when Web Locks are unavailable", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    document.cookie = "bookflow_csrf=old-cookie; Path=/";
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    expect(
      await screen.findByText(/Secure session coordination is unavailable/),
    ).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed when site storage is blocked", async () => {
    document.cookie = "bookflow_csrf=old-cookie; Path=/";
    const storage = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Blocked", "SecurityError");
      });
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    renderProbe();
    expect(
      await screen.findByText(/Secure session coordination is unavailable/),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    storage.mockRestore();
  });
});

describe("authentication forms", () => {
  it("signs in with normalized email and navigates to the catalog", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => sessionResponse());
    const navigate = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <LoginPage onNavigate={navigate} />
      </AuthProvider>,
    );
    await userEvent.type(screen.getByLabelText("Email"), "ALEX@Example.test");
    await userEvent.type(
      screen.getByLabelText("Password"),
      "local-only-test-password",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/books"));
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      email: "alex@example.test",
      password: "local-only-test-password",
    });
  });

  it("presents failed credentials and server field validation without navigating", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          title: "Unauthorized",
          status: 401,
          detail: "Email or password is incorrect.",
          errors: [{ path: "email", message: "Check this account." }],
        },
        { status: 401 },
      ),
    );
    const navigate = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <LoginPage onNavigate={navigate} />
      </AuthProvider>,
    );
    await userEvent.type(screen.getByLabelText("Email"), "alex@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(screen.getByText("Check this account.")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("validates registration then submits only allowed member-account fields", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: user }, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    render(
      <AuthProvider>
        <RegisterPage onNavigate={vi.fn()} />
      </AuthProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(
      screen.getByText("Enter your full name (1–120 characters)."),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Full name"), "Alex Reader");
    await userEvent.type(screen.getByLabelText("Email"), "ALEX@example.test");
    await userEvent.type(
      screen.getByLabelText("Password", { exact: true }),
      "local-only-test-password",
    );
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "local-only-test-password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Account created" }),
    ).toBeInTheDocument();
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      fullName: "Alex Reader",
      email: "alex@example.test",
      password: "local-only-test-password",
    });
  });
});
