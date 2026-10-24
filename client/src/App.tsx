import { LanguageSelector } from "./components/LanguageSelector";
import { useTranslation } from "./i18n/language";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { UsersPage } from "./features/users/UsersPage";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { BookDetailPage } from "./features/catalog/BookDetailPage";
import { CategoriesPage } from "./features/catalog/CategoriesPage";
import { LoansPage } from "./features/loans/LoansPage";
import { DashboardPage } from "./features/administration/DashboardPage";
import { AuditPage } from "./features/administration/AuditPage";
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
  const { t, translate } = useTranslation();
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
        <p className="eyebrow">{t("YOUR NEXT CHAPTER STARTS HERE")}</p>
        <h1>
          {t("Good books.")}
          <br />
          {t("Simple borrowing.")}
        </h1>
        <p className="lead">
          {t(
            "Discover your next read, keep track of your loans, and make room for a new story.",
          )}
        </p>
        <div className="action-row">
          <Button
            className="button button-primary"
            onClick={() => onNavigate("/books")}
          >
            {t("Explore the catalog")}
          </Button>
          {!user && (
            <Button onClick={() => onNavigate("/register")}>
              {t("Join the library")}
            </Button>
          )}
        </div>
      </section>
      <div className="module-grid overview-cards">
        <article className="panel">
          <span className="step-number">01</span>
          <h2>{t("Find your next read")}</h2>
          <p>{t("Browse books by category, title or author.")}</p>
        </article>
        <article className="panel">
          <span className="step-number">02</span>
          <h2>{t("Borrow a copy")}</h2>
          <p>{t("Members can borrow up to three books for fourteen days.")}</p>
        </article>
        <article className="panel">
          <span className="step-number">03</span>
          <h2>{t("Keep your story going")}</h2>
          <p>{t("Check your due dates and return books with a librarian.")}</p>
        </article>
      </div>
      <section className="panel connection" aria-labelledby="connection-title">
        <div className="section-heading">
          <h2 id="connection-title">{t("Library service")}</h2>
          <Button
            busy={status === "loading"}
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            {t("Refresh connection")}
          </Button>
        </div>
        {status === "loading" && (
          <Feedback kind="loading">{t("Connecting to the API…")}</Feedback>
        )}
        {status === "ok" && (
          <Feedback kind="success">
            <strong>{t("API connected")}</strong>
            <p>{translate(message)}</p>
          </Feedback>
        )}
        {status === "error" && (
          <Feedback kind="error">
            <p>{translate(message)}</p>
            {requestId && <p>{t("Request ID: {id}", { id: requestId })}</p>}
          </Feedback>
        )}
      </section>
    </>
  );
}

function Workspace() {
  const { t, translate } = useTranslation();
  const { path, navigate } = usePath();
  const { user, loading, logout, sessionError, api } = useAuth();
  const viewer = user ? `${user.id}:${translate(user.role)}` : "anonymous";
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
    content = (
      <Feedback kind="loading">{t("Restoring your session…")}</Feedback>
    );
  else if (protectedPath && !user)
    content = (
      <section className="panel">
        <h1>{t("Sign in to continue")}</h1>
        <p>
          {t("Your library account keeps your loans and information together.")}
        </p>
        <Button onClick={() => navigate("/login")}>{t("Sign in")}</Button>
      </section>
    );
  else if (path === "/") content = <Home onNavigate={navigate} />;
  else if (path === "/login") content = <LoginPage onNavigate={navigate} />;
  else if (path === "/register")
    content = <RegisterPage onNavigate={navigate} />;
  else if (path === "/loans") content = <LoansPage onNavigate={navigate} />;
  else if (path === "/dashboard")
    content = staff ? (
      <DashboardPage />
    ) : (
      <Feedback kind="error">
        {t("Staff access is required to view the dashboard.")}
      </Feedback>
    );
  else if (path === "/audit-logs")
    content =
      user?.role === "ADMIN" ? (
        <AuditPage />
      ) : (
        <Feedback kind="error">
          {t("Administrator access is required to view the audit log.")}
        </Feedback>
      );
  else if (path === "/books")
    content = (
      <CatalogPage
        key={viewer}
        client={api}
        user={user}
        onNavigate={navigate}
      />
    );
  else if (/^\/books\/[^/]+$/.test(path))
    content = (
      <BookDetailPage
        key={`${viewer}:${path}`}
        bookId={path.split("/")[2]!}
        onNavigate={navigate}
      />
    );
  else if (path === "/categories")
    content = staff ? (
      <CategoriesPage />
    ) : (
      <Feedback kind="error">
        {t("Catalog management is available to librarians and administrators.")}
      </Feedback>
    );
  else if (path === "/users")
    content =
      user?.role === "ADMIN" ? (
        <UsersPage />
      ) : (
        <Feedback kind="error">
          {t("You do not have permission to view this page.")}
        </Feedback>
      );
  else if (path === "/account")
    content = (
      <section className="panel">
        <p className="eyebrow">{t("YOUR ACCOUNT")}</p>
        <h1>{user?.fullName}</h1>
        <dl>
          <dt>{t("Email")}</dt>
          <dd>{user?.email}</dd>
          <dt>{t("Role")}</dt>
          <dd>{user && translate(user.role)}</dd>
        </dl>
        <Button onClick={() => navigate("/loans")}>
          {t("View your loans")}
        </Button>
      </section>
    );
  else
    content = (
      <section className="panel">
        <h1>{t("Page not found")}</h1>
        <p>{t("Choose a page from the navigation to continue.")}</p>
        <Button onClick={() => navigate("/")}>{t("Back to overview")}</Button>
      </section>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
          aria-label={t("BookFlow home")}
        >
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>
            BookFlow<small>{t("A little more discovery.")}</small>
          </span>
        </a>
        <div className="header-actions">
          <LanguageSelector />
          {loading ? (
            <span className="muted">{t("Restoring session…")}</span>
          ) : user ? (
            <>
              <Button onClick={() => navigate("/account")}>
                {user.fullName}
              </Button>
              <span className="badge">{translate(user.role)}</span>
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
                {t("Sign out")}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => navigate("/login")}>{t("Sign in")}</Button>
              <Button
                className="button button-primary"
                onClick={() => navigate("/register")}
              >
                {t("Create account")}
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">{t("YOUR LIBRARY")}</p>
          <nav aria-label={t("Main navigation")}>
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
                  {translate(link.label)}
                </button>
              ))}
          </nav>
          <p className="sidebar-note">
            {t("Find something worth turning the page for.")}
          </p>
          <a
            className="sidebar-docs"
            href={
              import.meta.env.DEV ? "http://127.0.0.1:3000/docs/" : "/docs/"
            }
            target="_blank"
            rel="noreferrer"
          >
            {t("API documentation ↗")}
          </a>
        </aside>
        <main id="main-content" tabIndex={-1}>
          {(logoutError || sessionError) && (
            <Feedback kind="error">
              {translate(logoutError || sessionError)}
            </Feedback>
          )}
          {content}
        </main>
      </div>
      <footer>
        {t(
          "BookFlow · Library Management · Web Programming & Applications — 503073",
        )}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Workspace />
      </AuthProvider>
    </LanguageProvider>
  );
}
