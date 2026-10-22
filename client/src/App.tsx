import { useEffect, useState } from "react";
import { Catalog } from "./features/catalog/Catalog";
import { Button } from "./components/Button";
import { Feedback } from "./components/Feedback";
import { api, ApiError } from "./lib/http";

type ServiceInfo = { name: string; version: string; message: string };
type Connection =
  | { state: "loading" }
  | { state: "connected"; service: ServiceInfo }
  | { state: "error"; message: string; requestId?: string };

const modules = [
  {
    id: "catalog",
    title: "Catalog",
    audience: "Everyone · Librarian",
    description:
      "Find books, manage categories and keep physical copies organized.",
  },
  {
    id: "loans",
    title: "Borrowing",
    audience: "Member · Librarian",
    description: "Borrow a copy, review your loans and confirm returns.",
  },
  {
    id: "accounts",
    title: "Accounts",
    audience: "Member · Administrator",
    description: "Sign in, manage your profile and administer account access.",
  },
] as const;

export default function App() {
  const [connection, setConnection] = useState<Connection>({
    state: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [section, setSection] = useState("overview");

  useEffect(() => {
    const controller = new AbortController();
    async function connect() {
      try {
        const result = await api.request<{ data: ServiceInfo }>("", {
          signal: controller.signal,
        });
        if (!controller.signal.aborted)
          setConnection({ state: "connected", service: result.data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setConnection({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "The API could not be reached.",
          requestId:
            error instanceof ApiError ? error.problem.requestId : undefined,
        });
      }
    }
    void connect();
    return () => controller.abort();
  }, [attempt]);

  const selected = modules.find((module) => module.id === section);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={() => setSection("overview")}
          aria-label="BookFlow home"
        >
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>
            BookFlow<small>Library management</small>
          </span>
        </a>
        <span className="badge">Development foundation</span>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">Workspace</p>
          <nav aria-label="Main navigation">
            {[{ id: "overview", title: "Overview" }, ...modules].map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => setSection(item.id)}
              >
                {item.title}{" "}
                {item.id !== "overview" && item.id !== "catalog" && (
                  <span className="nav-note">Planned</span>
                )}
              </button>
            ))}
          </nav>
          <p className="sidebar-note">
            Browse the catalog, or sign in there to manage books and copies.
          </p>
        </aside>
        <main id="main-content" tabIndex={-1}>
          <p className="eyebrow">WEB PROGRAMMING & APPLICATIONS · 503073</p>
          <h1>{selected?.title ?? "BookFlow"}</h1>
          <p className="lead">
            {selected
              ? selected.description
              : "A shared starting point for a better library experience."}
          </p>
          {section === "catalog" ? (
            <Catalog />
          ) : selected ? (
            <section className="panel" aria-labelledby="module-status">
              <span className="badge">Planned module</span>
              <h2 id="module-status">Ready for feature development</h2>
              <p>
                This area has no business features yet. The team will implement
                it against the agreed API contract.
              </p>
              <p className="muted">Intended roles: {selected.audience}</p>
              <Button onClick={() => setSection("overview")}>
                Back to overview
              </Button>
            </section>
          ) : (
            <>
              <section
                className="panel connection"
                aria-labelledby="connection-title"
              >
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Service status</p>
                    <h2 id="connection-title">API connection</h2>
                  </div>
                  <Button
                    busy={connection.state === "loading"}
                    onClick={() => {
                      setConnection({ state: "loading" });
                      setAttempt((value) => value + 1);
                    }}
                  >
                    Refresh connection
                  </Button>
                </div>
                {connection.state === "loading" && (
                  <Feedback kind="loading">Connecting to the API…</Feedback>
                )}
                {connection.state === "connected" && (
                  <Feedback kind="success">
                    <strong>API connected</strong>
                    <p>{connection.service.message}</p>
                    <small>
                      {connection.service.name} · {connection.service.version}
                    </small>
                  </Feedback>
                )}
                {connection.state === "error" && (
                  <Feedback kind="error">
                    <strong>API disconnected</strong>
                    <p>{connection.message}</p>
                    <p>
                      Check the backend service, then refresh the connection.
                    </p>
                    {connection.requestId && (
                      <small>Request ID: {connection.requestId}</small>
                    )}
                  </Feedback>
                )}
              </section>
              <section aria-labelledby="modules-title">
                <div className="section-heading">
                  <h2 id="modules-title">Library modules</h2>
                  <span className="muted">Shared API · Separate ownership</span>
                </div>
                <div className="module-grid">
                  {modules.map((module) => (
                    <article className="panel module-card" key={module.id}>
                      <span className="badge">
                        {module.id === "catalog" ? "Available" : "Planned"}
                      </span>
                      <h3>{module.title}</h3>
                      <p>{module.description}</p>
                      <small className="muted">{module.audience}</small>
                      <Button onClick={() => setSection(module.id)}>
                        {module.id === "catalog"
                          ? "Open catalog"
                          : `View ${module.title.toLowerCase()} plan`}
                      </Button>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      <footer>
        BookFlow · Team foundation · Business features are under development.
      </footer>
    </div>
  );
}
