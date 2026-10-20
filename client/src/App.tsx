import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { UsersPage } from "./features/users/UsersPage";
import { Button } from "./components/Button";
import { Feedback } from "./components/Feedback";
import { ApiError } from "./lib/http";

function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const changed = () => setPath(window.location.pathname);
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, []);
  function navigate(next: string) {
    if (!next.startsWith("/") || next.startsWith("//")) return;
    window.history.pushState(null, "", next);
    setPath(next.split("?")[0] || "/");
    window.scrollTo?.({ top: 0 });
  }
  return { path, navigate };
}

function Home({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { api, user } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: { message: string } }>("", { signal: controller.signal })
      .then((response) => {
        setMessage(response.data.message);
        setStatus("ok");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage(
            error instanceof Error ? error.message : "Connection failed.",
          );
          setRequestId(
            error instanceof ApiError ? error.problem.requestId : undefined,
          );
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [api, attempt]);
  return (
    <>
      <section className="hero-panel">
        <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
        <h1>
          Good books.
          <br />
          Simple borrowing.
        </h1>
        <p className="lead">
          Discover your next read, keep track of your loans, and make room for a
          new story.
        </p>
        <div className="action-row">
          <Button
            className="button button-primary"
            onClick={() => onNavigate("/books")}
          >
            Explore the catalog
          </Button>
          {!user && (
            <Button onClick={() => onNavigate("/register")}>
              Join the library
            </Button>
          )}
        </div>
      </section>
      <div className="module-grid overview-cards">
        <article className="panel">
          <span className="step-number">01</span>
          <h2>Find your next read</h2>
          <p>Browse books by category, title or author.</p>
        </article>
        <article className="panel">
          <span className="step-number">02</span>
          <h2>Borrow a copy</h2>
          <p>Members can borrow up to three books for fourteen days.</p>
        </article>
        <article className="panel">
          <span className="step-number">03</span>
          <h2>Keep your story going</h2>
          <p>Check your due dates and return books with a librarian.</p>
        </article>
      </div>
      <section className="panel connection" aria-labelledby="connection-title">
        <div className="section-heading">
          <h2 id="connection-title">Library service</h2>
          <Button
            busy={status === "loading"}
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            Refresh connection
          </Button>
        </div>
        {status === "loading" && (
          <Feedback kind="loading">Connecting to the API…</Feedback>
        )}
        {status === "ok" && (
          <Feedback kind="success">
            <strong>API connected</strong>
            <p>{message}</p>
          </Feedback>
        )}
        {status === "error" && (
          <Feedback kind="error">
            <p>{message}</p>
            {requestId && <p>Request ID: {requestId}</p>}
          </Feedback>
        )}
      </section>
    </>
  );
}

function Workspace() {
  const { path, navigate } = usePath();
  const { user, loading, logout, sessionError } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const staff = user?.role === "ADMIN" || user?.role === "LIBRARIAN";
  const links = [
    { path: "/", label: "Overview", visible: true },
    { path: "/books", label: "Catalog", visible: true },
    {
      path: "/loans",
      label: staff ? "All loans" : "My loans",
      visible: !!user,
    },
    { path: "/categories", label: "Categories", visible: staff },
    { path: "/dashboard", label: "Dashboard", visible: staff },
    { path: "/users", label: "Users", visible: user?.role === "ADMIN" },
    {
      path: "/audit-logs",
      label: "Audit log",
      visible: user?.role === "ADMIN",
    },
  ];
  let content;
  const protectedPath = [
    "/account",
    "/users",
    "/loans",
    "/categories",
    "/dashboard",
    "/audit-logs",
  ].includes(path);
  if (protectedPath && loading)
    content = <Feedback kind="loading">Restoring your session…</Feedback>;
  else if (protectedPath && !user)
    content = (
      <section className="panel">
        <h1>Sign in to continue</h1>
        <p>Your library account keeps your loans and information together.</p>
        <Button onClick={() => navigate("/login")}>Sign in</Button>
      </section>
    );
  else if (path === "/") content = <Home onNavigate={navigate} />;
  else if (path === "/login") content = <LoginPage onNavigate={navigate} />;
  else if (path === "/register")
    content = <RegisterPage onNavigate={navigate} />;
  else if (path === "/users")
    content =
      user?.role === "ADMIN" ? (
        <UsersPage />
      ) : (
        <Feedback kind="error">
          You do not have permission to view this page.
        </Feedback>
      );
  else if (path === "/account")
    content = (
      <section className="panel">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>{user?.fullName}</h1>
        <dl>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{user?.role}</dd>
        </dl>
        <Button onClick={() => navigate("/loans")}>View your loans</Button>
      </section>
    );
  else if (
    ["/books", "/categories", "/loans", "/dashboard", "/audit-logs"].includes(
      path,
    )
  )
    content = (
      <section className="panel">
        <h1>Coming soon</h1>
        <p>This part of the library is being prepared.</p>
        <Button onClick={() => navigate("/")}>Back to overview</Button>
      </section>
    );
  else
    content = (
      <section className="panel">
        <h1>Page not found</h1>
        <p>Choose a page from the navigation to continue.</p>
        <Button onClick={() => navigate("/")}>Back to overview</Button>
      </section>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
          aria-label="BookFlow home"
        >
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>
            BookFlow<small>A little more discovery.</small>
          </span>
        </a>
        <div className="header-actions">
          {loading ? (
            <span className="muted">Restoring session…</span>
          ) : user ? (
            <>
              <Button onClick={() => navigate("/account")}>
                {user.fullName}
              </Button>
              <span className="badge">{user.role}</span>
              <Button
                onClick={() => {
                  setLogoutError("");
                  void logout()
                    .then(() => navigate("/"))
                    .catch((error: unknown) =>
                      setLogoutError(
                        error instanceof Error
                          ? error.message
                          : "Sign out failed.",
                      ),
                    );
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => navigate("/login")}>Sign in</Button>
              <Button
                className="button button-primary"
                onClick={() => navigate("/register")}
              >
                Create account
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">YOUR LIBRARY</p>
          <nav aria-label="Main navigation">
            {links
              .filter((link) => link.visible)
              .map((link) => (
                <button
                  key={link.path}
                  type="button"
                  aria-current={
                    path === link.path ||
                    (link.path === "/books" && path.startsWith("/books/"))
                      ? "page"
                      : undefined
                  }
                  onClick={() => navigate(link.path)}
                >
                  {link.label}
                </button>
              ))}
          </nav>
          <p className="sidebar-note">
            Find something worth
            <br />
            turning the page for.
          </p>
          <a
            className="sidebar-docs"
            href={
              import.meta.env.DEV ? "http://127.0.0.1:3000/docs/" : "/docs/"
            }
            target="_blank"
            rel="noreferrer"
          >
            API documentation ↗
          </a>
        </aside>
        <main id="main-content" tabIndex={-1}>
          {(logoutError || sessionError) && (
            <Feedback kind="error">{logoutError || sessionError}</Feedback>
          )}
          {content}
        </main>
      </div>
      <footer>
        BookFlow · Library Management · Web Programming & Applications — 503073
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Workspace />
    </AuthProvider>
  );
}
