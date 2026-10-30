import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "../../i18n/language";
import { ApiError } from "../../lib/http";

export function HomePage({
  onNavigate,
}: {
  onNavigate: (path: string) => void;
}) {
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
