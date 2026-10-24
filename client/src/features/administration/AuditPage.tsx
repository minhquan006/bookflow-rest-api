import { useTranslation } from "../../i18n/language";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { Pagination } from "../../components/Pagination";
import { useAuth } from "../auth/AuthContext";
import { formatLibraryDate, type PageInfo } from "../loans/types";

type AuditEvent = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  occurredAt: string;
};
type AuditCollection = { data: AuditEvent[]; pagination: PageInfo };
type Filters = { action: string; actorId: string; from: string; to: string };
const emptyFilters: Filters = { action: "", actorId: "", from: "", to: "" };

// datetime-local is explicitly interpreted as Vietnam time, independently of device timezone.
function filterTimestamp(value: string) {
  const date = new Date(`${value}+07:00`);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Enter a valid filter date and time.");
  return date.toISOString();
}

export function AuditPage() {
  const { t, translate, locale } = useTranslation();
  const { user, loading: authLoading, api } = useAuth();
  const permitted = user?.role === "ADMIN";
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [collection, setCollection] = useState<AuditCollection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  useEffect(() => {
    setCollection(null);
    if (!permitted) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), limit: "20" });
    if (filters.action) query.set("action", filters.action);
    if (filters.actorId) query.set("actorId", filters.actorId);
    if (filters.from) query.set("from", filterTimestamp(filters.from));
    if (filters.to) query.set("to", filterTimestamp(filters.to));
    setBusy(true);
    setError("");
    void api
      .request<AuditCollection>(`/audit-logs?${query}`, {
        signal: controller.signal,
      })
      .then((result) => {
        if (!controller.signal.aborted) setCollection(result);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Audit events could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [api, permitted, filters, page, refresh]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilterError("");
    const normalized = {
      ...draft,
      action: draft.action.trim(),
      actorId: draft.actorId.trim(),
    };
    if (
      normalized.actorId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        normalized.actorId,
      )
    ) {
      setFilterError("Actor ID must be a UUID.");
      return;
    }
    try {
      const from = normalized.from ? filterTimestamp(normalized.from) : null;
      const to = normalized.to ? filterTimestamp(normalized.to) : null;
      if (from && to && from >= to) {
        setFilterError("The end time must be after the start time.");
        return;
      }
    } catch {
      setFilterError("Enter a valid filter date and time.");
      return;
    }
    setFilters(normalized);
    setPage(1);
  }

  if (authLoading)
    return <Feedback kind="loading">{t("Restoring your session…")}</Feedback>;
  if (!permitted)
    return (
      <Feedback kind="error">
        {t("Only administrators can view audit events.")}
      </Feedback>
    );

  return (
    <div className="stack">
      <header className="section-heading">
        <div>
          <h1>{t("Audit events")}</h1>
          <p className="muted">
            {t(
              "Review who changed library resources. Times use Vietnam time (UTC+7).",
            )}
          </p>
        </div>
        <Button busy={busy} onClick={() => setRefresh((value) => value + 1)}>
          {t("Refresh events")}
        </Button>
      </header>
      <section className="panel stack" aria-label={t("Audit filters")}>
        <form className="form-grid" onSubmit={applyFilters}>
          <FormField
            label={t("Action")}
            placeholder="loan.created"
            value={draft.action}
            maxLength={100}
            onChange={(event) =>
              setDraft((value) => ({ ...value, action: event.target.value }))
            }
          />
          <FormField
            label={t("Actor ID")}
            placeholder={t("User UUID")}
            value={draft.actorId}
            onChange={(event) =>
              setDraft((value) => ({ ...value, actorId: event.target.value }))
            }
          />
          <FormField
            label={t("From (Vietnam time)")}
            type="datetime-local"
            value={draft.from}
            onChange={(event) =>
              setDraft((value) => ({ ...value, from: event.target.value }))
            }
          />
          <FormField
            label={t("To (Vietnam time, exclusive)")}
            type="datetime-local"
            value={draft.to}
            onChange={(event) =>
              setDraft((value) => ({ ...value, to: event.target.value }))
            }
          />
          <div className="toolbar">
            <Button type="submit" busy={busy}>
              {t("Apply filters")}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setDraft(emptyFilters);
                setFilters(emptyFilters);
                setFilterError("");
                setPage(1);
              }}
            >
              {t("Clear filters")}
            </Button>
          </div>
        </form>
        {filterError && (
          <Feedback kind="error">{translate(filterError)}</Feedback>
        )}
      </section>
      {error && <Feedback kind="error">{translate(error)}</Feedback>}
      {busy && <Feedback kind="loading">{t("Loading audit events…")}</Feedback>}
      {collection && (
        <section className="panel stack" aria-label={t("Audit results")}>
          <p className="muted">
            {t("{count} events", { count: collection.pagination.total })}
          </p>
          {collection.data.length === 0 ? (
            <Feedback kind="empty">
              {t("No audit events match these filters.")}
            </Feedback>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">
                  {t("Resource audit events")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("Time")}</th>
                    <th scope="col">{t("Action")}</th>
                    <th scope="col">{t("Actor")}</th>
                    <th scope="col">{t("Resource")}</th>
                    <th scope="col">{t("Request ID")}</th>
                  </tr>
                </thead>
                <tbody>
                  {collection.data.map((event) => (
                    <tr key={event.id}>
                      <td>{formatLibraryDate(event.occurredAt, locale)}</td>
                      <th scope="row">{event.action}</th>
                      <td>{event.actorId ?? t("System")}</td>
                      <td>
                        {event.entityType}
                        <br />
                        <small>{event.entityId}</small>
                      </td>
                      <td>
                        <code>{event.requestId}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={collection.pagination.page}
            totalPages={collection.pagination.totalPages}
            busy={busy}
            onPageChange={setPage}
          />
        </section>
      )}
    </div>
  );
}
