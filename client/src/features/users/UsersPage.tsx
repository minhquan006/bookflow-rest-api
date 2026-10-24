import { useTranslation } from "../../i18n/language";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { useAuth } from "../auth/AuthContext";
import type { Role, User } from "../auth/AuthContext";
import { errorMessage } from "../auth/forms";

type UserPage = {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function UsersPage() {
  const { t, translate } = useTranslation();
  const { api, user, refreshProfile } = useAuth();
  const [result, setResult] = useState<UserPage | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    void api
      .request<UserPage>(`/users?page=${page}&limit=20`, {
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [api, user?.role, page, revision]);

  if (user?.role !== "ADMIN")
    return (
      <Feedback kind="error">
        {t("Administrator access is required to manage users.")}
      </Feedback>
    );
  const matching =
    result?.data.filter((entry) =>
      `${entry.fullName} ${entry.email}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  async function saved(updated: User) {
    if (updated.id === user?.id) await refreshProfile();
    setRevision((current) => current + 1);
  }
  return (
    <section aria-labelledby="users-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("Administration")}</p>
          <h1 id="users-title">{t("Users")}</h1>
          <p className="muted">
            {t(
              "Manage access while preserving at least one active administrator.",
            )}
          </p>
        </div>
        <Button
          busy={busy}
          onClick={() => setRevision((current) => current + 1)}
        >
          {t("Refresh users")}
        </Button>
      </div>
      <label className="filter-field">
        {t("Filter this page by name or email")}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error && <Feedback kind="error">{translate(error)}</Feedback>}
      {busy && <Feedback kind="loading">{t("Loading users…")}</Feedback>}
      {!busy && result && matching.length === 0 && (
        <Feedback kind="empty">
          {t("No users match this page filter.")}
        </Feedback>
      )}
      {result && (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              {t("User access administration")}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("Account")}</th>
                <th scope="col">{t("Role")}</th>
                <th scope="col">{t("Status")}</th>
                <th scope="col">{t("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {matching.map((entry) => (
                <UserRow
                  key={`${entry.id}-${entry.role}-${entry.status}`}
                  entry={entry}
                  onSaved={saved}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result && (
        <>
          <p className="muted">
            {t("{count} accounts · Filters apply to the current page.", {
              count: result.pagination.total,
            })}
          </p>
          <Pagination
            page={page}
            totalPages={result.pagination.totalPages}
            busy={busy}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function UserRow({
  entry,
  onSaved,
}: {
  entry: User;
  onSaved: (user: User) => Promise<void>;
}) {
  const { t, translate } = useTranslation();
  const { api } = useAuth();
  const [role, setRole] = useState<Role>(entry.role);
  const [status, setStatus] = useState<User["status"]>(entry.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const result = await api.request<{ data: User }>(`/users/${entry.id}`, {
        method: "PATCH",
        json: { role, status },
      });
      setSuccess(true);
      await onSaved(result.data);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr>
      <td>
        <strong>{entry.fullName}</strong>
        <br />
        <span className="muted">{entry.email}</span>
      </td>
      <td>
        <select
          aria-label={t("Role for {email}", { email: entry.email })}
          value={role}
          disabled={busy}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          <option value="MEMBER">{t("Member")}</option>
          <option value="LIBRARIAN">{t("Librarian")}</option>
          <option value="ADMIN">{t("Administrator")}</option>
        </select>
      </td>
      <td>
        <select
          aria-label={t("Status for {email}", { email: entry.email })}
          value={status}
          disabled={busy}
          onChange={(event) => setStatus(event.target.value as User["status"])}
        >
          <option value="ACTIVE">{t("Active")}</option>
          <option value="DISABLED">{t("Disabled")}</option>
        </select>
      </td>
      <td>
        <Button
          busy={busy}
          disabled={role === entry.role && status === entry.status}
          onClick={() => {
            void save();
          }}
        >
          {t("Save {name}", { name: entry.fullName })}
        </Button>
        {error && <Feedback kind="error">{translate(error)}</Feedback>}
        {success && <span role="status">{t("Access updated.")}</span>}
      </td>
    </tr>
  );
}
