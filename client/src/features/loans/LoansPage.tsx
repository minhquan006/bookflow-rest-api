import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { useAuth } from "../auth/AuthContext";
import {
  formatLibraryDate,
  loanStatus,
  shortId,
  type Loan,
  type LoanCollection,
  type LoanReturn,
} from "./types";

export function LoansPage({
  onNavigate,
}: {
  onNavigate?: (path: string) => void;
} = {}) {
  const { user, loading: authLoading, api } = useAuth();
  const staff = user?.role === "LIBRARIAN" || user?.role === "ADMIN";
  const viewer = user ? `${user.id}:${user.role}` : "anonymous";
  const currentViewer = useRef(viewer);
  const detailRequest = useRef<AbortController | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [collectionState, setCollection] = useState<LoanCollection | null>(
    null,
  );
  const [collectionViewer, setCollectionViewer] = useState("");
  const collection = collectionViewer === viewer ? collectionState : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detailState, setDetail] = useState<Loan | null>(null);
  const [detailViewer, setDetailViewer] = useState("");
  const detail = detailViewer === viewer ? detailState : null;
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmationViewer, setConfirmationViewer] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    currentViewer.current = viewer;
    detailRequest.current?.abort();
    setDetail(null);
    setDetailError("");
    setDetailBusy(false);
    setConfirmId(null);
    setConfirmationViewer("");
    setReturnError("");
    setReturnBusy(false);
    setNotice("");
    return () => detailRequest.current?.abort();
  }, [viewer]);

  useEffect(() => {
    if (!user) {
      setCollection(null);
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) query.set("status", status);
    setBusy(true);
    setCollection(null);
    setError("");
    void api
      .request<LoanCollection>(`/loans?${query}`, {
        signal: controller.signal,
      })
      .then((result) => {
        if (!controller.signal.aborted && currentViewer.current === viewer) {
          setCollection(result);
          setCollectionViewer(viewer);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Loans could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [api, viewer, page, status, refresh, user]);

  async function loadDetail(id: string) {
    const requestViewer = viewer;
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailViewer(requestViewer);
    setDetailBusy(true);
    setDetailError("");
    setDetail(null);
    try {
      const result = await api.request<{ data: Loan }>(`/loans/${id}`, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted && currentViewer.current === requestViewer)
        setDetail(result.data);
    } catch (failure) {
      if (!controller.signal.aborted && currentViewer.current === requestViewer)
        setDetailError(
          failure instanceof Error
            ? failure.message
            : "Loan details could not be loaded.",
        );
    } finally {
      if (!controller.signal.aborted && currentViewer.current === requestViewer)
        setDetailBusy(false);
    }
  }

  async function confirmReturn() {
    if (!confirmId || returnBusy || !staff || confirmationViewer !== viewer)
      return;
    const requestViewer = viewer;
    setReturnBusy(true);
    setReturnError("");
    setNotice("");
    try {
      const { data } = await api.request<{ data: LoanReturn }>(
        `/loans/${confirmId}/return`,
        { method: "PUT", json: {} },
      );
      if (currentViewer.current !== requestViewer) return;
      setDetail((previous) =>
        previous?.id === data.loanId
          ? {
              ...previous,
              returnedAt: data.returnedAt,
              returnedBy: data.returnedBy,
            }
          : previous,
      );
      setConfirmId(null);
      setNotice(
        `Return confirmed at ${formatLibraryDate(data.returnedAt)} (Vietnam time).`,
      );
      setRefresh((value) => value + 1);
    } catch (failure) {
      if (currentViewer.current !== requestViewer) return;
      setReturnError(
        failure instanceof Error
          ? failure.message
          : "The return could not be confirmed.",
      );
    } finally {
      if (currentViewer.current === requestViewer) setReturnBusy(false);
    }
  }

  if (authLoading)
    return <Feedback kind="loading">Restoring your session…</Feedback>;
  if (!user)
    return (
      <section className="panel stack">
        <h1>My loans</h1>
        <p>Sign in to view your borrowing history.</p>
        {onNavigate && (
          <Button onClick={() => onNavigate("/login")}>Sign in</Button>
        )}
      </section>
    );

  return (
    <div className="stack">
      <header className="section-heading">
        <div>
          <h1>{staff ? "Library loans" : "My loans"}</h1>
          <p className="muted">
            {staff
              ? "Review borrowing activity and confirm returned copies."
              : "Track your current books and borrowing history."}{" "}
            Dates are shown in Vietnam time (UTC+7).
          </p>
        </div>
        <Button busy={busy} onClick={() => setRefresh((value) => value + 1)}>
          Refresh loans
        </Button>
      </header>
      <section className="panel stack" aria-label="Loan history">
        <div className="toolbar">
          <label className="form-field">
            <span>Loan status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All loans</option>
              <option value="ACTIVE">Active</option>
              <option value="OVERDUE">Overdue</option>
              <option value="RETURNED">Returned</option>
            </select>
          </label>
          <p className="muted">
            {collection ? `${collection.pagination.total} loans` : ""}
          </p>
        </div>
        {error && <Feedback kind="error">{error}</Feedback>}
        {busy && <Feedback kind="loading">Loading loans…</Feedback>}
        {notice && confirmationViewer === viewer && (
          <Feedback kind="success">{notice}</Feedback>
        )}
        {collection && !busy && !error && collection.data.length === 0 && (
          <Feedback kind="empty">No loans match this filter.</Feedback>
        )}
        {collection && collection.data.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">
                {staff ? "All library loans" : "Your loans"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Loan</th>
                  <th scope="col">Book</th>
                  {staff && <th scope="col">Borrower</th>}
                  <th scope="col">Borrowed</th>
                  <th scope="col">Due</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {collection.data.map((loan) => (
                  <tr key={loan.id}>
                    <th scope="row">
                      <Button
                        onClick={() => void loadDetail(loan.id)}
                        aria-label={`View loan ${shortId(loan.id)}`}
                      >
                        {shortId(loan.id)}
                      </Button>
                    </th>
                    <td>
                      {onNavigate ? (
                        <Button
                          onClick={() => onNavigate(`/books/${loan.bookId}`)}
                          aria-label={`View book ${shortId(loan.bookId)}`}
                        >
                          {shortId(loan.bookId)}
                        </Button>
                      ) : (
                        shortId(loan.bookId)
                      )}
                    </td>
                    {staff && (
                      <td title={loan.userId}>{shortId(loan.userId)}</td>
                    )}
                    <td>{formatLibraryDate(loan.borrowedAt)}</td>
                    <td>{formatLibraryDate(loan.dueAt)}</td>
                    <td>
                      <span
                        className={`badge ${loanStatus(loan) === "Overdue" ? "badge--danger" : ""}`}
                      >
                        {loanStatus(loan)}
                      </span>
                    </td>
                    <td>
                      {staff && !loan.returnedAt ? (
                        <Button
                          disabled={returnBusy}
                          onClick={() => {
                            setConfirmId(loan.id);
                            setConfirmationViewer(viewer);
                            setReturnError("");
                            setNotice("");
                          }}
                          aria-label={`Return loan ${shortId(loan.id)}`}
                        >
                          Return copy
                        </Button>
                      ) : loan.returnedAt ? (
                        "Return recorded"
                      ) : (
                        "Return at the library"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {collection && (
          <Pagination
            page={collection.pagination.page}
            totalPages={collection.pagination.totalPages}
            busy={busy}
            onPageChange={setPage}
          />
        )}
      </section>
      {confirmId && staff && confirmationViewer === viewer && (
        <section
          className="panel stack"
          aria-labelledby="return-confirmation-title"
        >
          <h2 id="return-confirmation-title">Confirm this return?</h2>
          <p>
            Confirm that the library has received the copy for loan{" "}
            {shortId(confirmId)}. The server records the return time and staff
            account.
          </p>
          {returnError && (
            <Feedback kind="error">
              {returnError}
              <p>
                If the connection failed, refresh the history before trying
                again.
              </p>
            </Feedback>
          )}
          <div className="toolbar">
            <Button busy={returnBusy} onClick={() => void confirmReturn()}>
              Confirm return
            </Button>
            <Button disabled={returnBusy} onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {detailViewer === viewer && (detail || detailBusy || detailError) && (
        <section className="panel stack" aria-labelledby="loan-details-title">
          <h2 id="loan-details-title">Loan details</h2>
          {detailBusy && (
            <Feedback kind="loading">Loading loan details…</Feedback>
          )}
          {detailError && <Feedback kind="error">{detailError}</Feedback>}
          {detail && (
            <dl className="detail-list">
              <dt>Loan ID</dt>
              <dd>{detail.id}</dd>
              <dt>Book ID</dt>
              <dd>{detail.bookId}</dd>
              <dt>Copy ID</dt>
              <dd>{detail.copyId}</dd>
              {staff && (
                <>
                  <dt>Borrower ID</dt>
                  <dd>{detail.userId}</dd>
                </>
              )}
              <dt>Borrowed</dt>
              <dd>{formatLibraryDate(detail.borrowedAt)}</dd>
              <dt>Due</dt>
              <dd>{formatLibraryDate(detail.dueAt)}</dd>
              <dt>Status</dt>
              <dd>{loanStatus(detail)}</dd>
              {detail.returnedAt && (
                <>
                  <dt>Returned</dt>
                  <dd>{formatLibraryDate(detail.returnedAt)}</dd>
                  <dt>Confirmed by</dt>
                  <dd>{detail.returnedBy}</dd>
                </>
              )}
            </dl>
          )}
        </section>
      )}
    </div>
  );
}
