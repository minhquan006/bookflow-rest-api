import { useTranslation } from "../../i18n/language";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { useAuth } from "../auth/AuthContext";
import { formatLibraryDate } from "../loans/types";

type Dashboard = {
  activeBooks: number;
  serviceableCopies: number;
  activeLoans: number;
  overdueLoans: number;
  asOf: string;
};

export function DashboardPage() {
  const { t, translate, locale } = useTranslation();
  const { user, loading: authLoading, api } = useAuth();
  const permitted = user?.role === "LIBRARIAN" || user?.role === "ADMIN";
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setDashboard(null);
    if (!permitted) return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    void api
      .request<{ data: Dashboard }>("/dashboard", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setDashboard(data);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Dashboard could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [api, permitted, refresh]);

  if (authLoading)
    return <Feedback kind="loading">{t("Restoring your session…")}</Feedback>;
  if (!permitted)
    return (
      <Feedback kind="error">
        {t("The dashboard is available to librarians and administrators.")}
      </Feedback>
    );

  return (
    <div className="stack">
      <header className="section-heading">
        <div>
          <h1>{t("Library dashboard")}</h1>
          <p className="muted">
            {t(
              "A snapshot of the library. Refresh after borrowing or returning books.",
            )}
          </p>
        </div>
        <Button busy={busy} onClick={() => setRefresh((value) => value + 1)}>
          {t("Refresh statistics")}
        </Button>
      </header>
      {error && <Feedback kind="error">{translate(error)}</Feedback>}
      {busy && (
        <Feedback kind="loading">{t("Loading library statistics…")}</Feedback>
      )}
      {dashboard && (
        <>
          <div className="stat-grid">
            {[
              [
                "Active books",
                dashboard.activeBooks,
                "Titles available in the catalog",
              ],
              [
                "Serviceable copies",
                dashboard.serviceableCopies,
                "Copies not marked retired",
              ],
              ["Active loans", dashboard.activeLoans, "Copies awaiting return"],
              [
                "Overdue loans",
                dashboard.overdueLoans,
                "Unreturned copies past their due date",
              ],
            ].map(([label, value, description]) => (
              <section className="panel stat-card" key={label}>
                <h2>{translate(String(label))}</h2>
                <p className="stat-value">{value}</p>
                <p className="muted">{translate(String(description))}</p>
              </section>
            ))}
          </div>
          <p className="muted">
            {t("Statistics as of {date} (Vietnam time).", {
              date: formatLibraryDate(dashboard.asOf, locale),
            })}
          </p>
        </>
      )}
    </div>
  );
}
