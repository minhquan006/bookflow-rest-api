import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "../components/Icon";
import { LanguageSelector } from "../components/LanguageSelector";
import { Button } from "../components/Button";
import { Feedback } from "../components/Feedback";
import { useTranslation } from "../i18n/language";
import { useAuth } from "../features/auth/AuthContext";

export function AppLayout({
  path,
  onNavigate: navigate,
  children,
}: {
  path: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}) {
  const { t, translate } = useTranslation();
  const {
    user,
    loading,
    logout,
    retryLogout,
    revocationPending,
    sessionError,
  } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const navigationIcons: Record<string, IconName> = {
    "/": "home",
    "/books": "book",
    "/loans": "loans",
    "/categories": "categories",
    "/dashboard": "chart",
    "/users": "users",
    "/audit-logs": "audit",
  };
  function signOut(retry = false) {
    if (signingOut) return;
    setSigningOut(true);
    void (retry ? retryLogout() : logout())
      .then(() => navigate("/"))
      .catch(() => {})
      .finally(() => setSigningOut(false));
  }
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
            <Icon name="book" />
          </span>
          <span>
            BookFlow<small>{t("A little more discovery.")}</small>
          </span>
        </a>
        <Button
          className="button mobile-nav-toggle"
          aria-label={t("Main navigation")}
          aria-controls="library-navigation"
          aria-expanded={navigationOpen}
          onClick={() => setNavigationOpen((value) => !value)}
        >
          <Icon name={navigationOpen ? "close" : "menu"} />
        </Button>
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
              <Button busy={signingOut} onClick={() => signOut()}>
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
        <aside
          className="sidebar"
          id="library-navigation"
          data-open={navigationOpen}
        >
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
                  <Icon name={navigationIcons[link.path]!} />
                  <span>{translate(link.label)}</span>
                </button>
              ))}
          </nav>
          <p className="sidebar-note">
            {t("Find something worth turning the page for.")}
          </p>
          <a
            className="sidebar-docs"
            href="/docs/"
            target="_blank"
            rel="noreferrer"
          >
            {t("API documentation ↗")}
          </a>
        </aside>
        <main id="main-content" tabIndex={-1}>
          {sessionError && (
            <Feedback kind="error">{translate(sessionError)}</Feedback>
          )}
          {revocationPending && (
            <Button busy={signingOut} onClick={() => signOut(true)}>
              {t("Retry sign out")}
            </Button>
          )}
          {children}
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
