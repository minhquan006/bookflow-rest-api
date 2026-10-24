import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoansPage } from "../src/features/loans/LoansPage";
import { formatLibraryDate, type Loan } from "../src/features/loans/types";

const mocks = vi.hoisted(() => {
  const request = vi.fn();
  return {
    user: null as { id: string; role: "MEMBER" | "LIBRARIAN" | "ADMIN" } | null,
    request,
    api: { request },
  };
});
vi.mock("../src/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    api: mocks.api,
  }),
}));

const borrowerId = "10000000-0000-4000-8000-000000000001";
const staffId = "20000000-0000-4000-8000-000000000001";
const activeLoan: Loan = {
  id: "30000000-0000-4000-8000-000000000001",
  userId: borrowerId,
  bookId: "40000000-0000-4000-8000-000000000001",
  copyId: "50000000-0000-4000-8000-000000000001",
  borrowedAt: new Date(Date.now() - 86_400_000).toISOString(),
  dueAt: new Date(Date.now() + 86_400_000).toISOString(),
  returnedAt: null,
  returnedBy: null,
};
const collection = (data: Loan[]) => ({
  data,
  pagination: {
    page: 1,
    limit: 20,
    total: data.length,
    totalPages: data.length ? 1 : 0,
  },
});

beforeEach(() => {
  mocks.request.mockReset();
  mocks.user = { id: borrowerId, role: "MEMBER" };
});

describe("loan history", () => {
  it("asks an anonymous visitor to sign in without requesting protected data", async () => {
    mocks.user = null;
    const navigate = vi.fn();
    render(<LoansPage onNavigate={navigate} />);
    expect(
      screen.getByText("Sign in to view your borrowing history."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(navigate).toHaveBeenCalledWith("/login");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("shows member statuses, Vietnam dates and details without staff return actions", async () => {
    const overdue = {
      ...activeLoan,
      id: "60000000-0000-4000-8000-000000000001",
      dueAt: new Date(Date.now() - 60_000).toISOString(),
    };
    const returned = {
      ...activeLoan,
      id: "70000000-0000-4000-8000-000000000001",
      returnedAt: activeLoan.borrowedAt,
      returnedBy: staffId,
    };
    mocks.request.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("?")
          ? collection([activeLoan, overdue, returned])
          : { data: activeLoan },
      ),
    );
    render(<LoansPage />);
    expect(
      await screen.findByRole("heading", { name: "My loans" }),
    ).toBeInTheDocument();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Overdue")).toBeInTheDocument();
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).getByText("Returned")).toBeInTheDocument();
    expect(
      screen.getAllByText(formatLibraryDate(activeLoan.borrowedAt)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /^Return loan/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "View loan 30000000" }),
    );
    expect(await screen.findByText(activeLoan.copyId)).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      `/loans/${activeLoan.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("sends the selected server-side status filter and displays an empty state", async () => {
    mocks.request.mockResolvedValue(collection([]));
    render(<LoansPage />);
    await screen.findByText("No loans match this filter.");
    await userEvent.selectOptions(
      screen.getByLabelText("Loan status"),
      "OVERDUE",
    );
    await waitFor(() =>
      expect(mocks.request).toHaveBeenLastCalledWith(
        "/loans?page=1&limit=20&status=OVERDUE",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it("aborts outstanding details and rejects an old response after an account switch", async () => {
    let resolveDetail!: (result: { data: Loan }) => void;
    mocks.request.mockImplementation((path: string) => {
      if (path === `/loans/${activeLoan.id}`)
        return new Promise<{ data: Loan }>((resolve) => {
          resolveDetail = resolve;
        });
      return Promise.resolve(
        collection(mocks.user?.id === borrowerId ? [activeLoan] : []),
      );
    });
    const { rerender } = render(<LoansPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "View loan 30000000" }),
    );
    const options = mocks.request.mock.calls.find(
      ([path]) => path === `/loans/${activeLoan.id}`,
    )?.[1] as { signal: AbortSignal };
    mocks.user = { id: "80000000-0000-4000-8000-000000000001", role: "MEMBER" };
    rerender(<LoansPage />);
    expect(options.signal.aborted).toBe(true);
    await act(async () => resolveDetail({ data: activeLoan }));
    expect(
      await screen.findByText("No loans match this filter."),
    ).toBeInTheDocument();
    expect(screen.queryByText(activeLoan.copyId)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Loan details" }),
    ).not.toBeInTheDocument();
  });

  it("clears already visible details when switching between signed-in accounts", async () => {
    mocks.request.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("?")
          ? collection(mocks.user?.id === borrowerId ? [activeLoan] : [])
          : { data: activeLoan },
      ),
    );
    const { rerender } = render(<LoansPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "View loan 30000000" }),
    );
    await screen.findByText(activeLoan.copyId);
    mocks.user = { id: "80000000-0000-4000-8000-000000000001", role: "MEMBER" };
    rerender(<LoansPage />);
    expect(screen.queryByText(activeLoan.copyId)).not.toBeInTheDocument();
    await screen.findByText("No loans match this filter.");
  });

  it("confirms a staff return once, submits exactly {} and refreshes the result", async () => {
    mocks.user = { id: staffId, role: "LIBRARIAN" };
    let returnedAt: string | null = null;
    mocks.request.mockImplementation((path: string) => {
      if (path.endsWith("/return")) {
        returnedAt = new Date().toISOString();
        return Promise.resolve({
          data: { loanId: activeLoan.id, returnedAt, returnedBy: staffId },
        });
      }
      return Promise.resolve(
        collection([
          {
            ...activeLoan,
            returnedAt,
            returnedBy: returnedAt ? staffId : null,
          },
        ]),
      );
    });
    render(<LoansPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Return loan 30000000" }),
    );
    expect(
      screen.getByRole("heading", { name: "Confirm this return?" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm return" }),
    );
    expect(await screen.findByText("Return recorded")).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      `/loans/${activeLoan.id}/return`,
      { method: "PUT", json: {} },
    );
    expect(
      mocks.request.mock.calls.filter(([path]) =>
        String(path).endsWith("/return"),
      ),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Confirm return" }),
    ).not.toBeInTheDocument();
  });

  it.each([20, 0])(
    "reloads a valid page after returning the last loan on page two leaves %i active loans",
    async (remaining) => {
      mocks.user = { id: staffId, role: "LIBRARIAN" };
      const loans = Array.from({ length: 21 }, (_, index) => ({
        ...activeLoan,
        id: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000001`,
      }));
      const lastLoan = loans[20]!;
      let activeLoans = loans;
      mocks.request.mockImplementation((path: string) => {
        if (path.endsWith("/return")) {
          activeLoans = loans.slice(0, remaining);
          return Promise.resolve({
            data: {
              loanId: lastLoan.id,
              returnedAt: new Date().toISOString(),
              returnedBy: staffId,
            },
          });
        }
        const query = new URL(path, "http://bookflow.test").searchParams;
        const page = Number(query.get("page"));
        return Promise.resolve({
          data: activeLoans.slice((page - 1) * 20, page * 20),
          pagination: {
            page,
            limit: 20,
            total: activeLoans.length,
            totalPages: Math.ceil(activeLoans.length / 20),
          },
        });
      });
      render(<LoansPage />);
      await screen.findByText("Page 1 of 2");
      await userEvent.selectOptions(
        screen.getByLabelText("Loan status"),
        "ACTIVE",
      );
      await screen.findByText("Page 1 of 2");
      await userEvent.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Page 2 of 2");
      await userEvent.click(
        screen.getByRole("button", { name: "Return loan 00000021" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Confirm return" }),
      );

      if (remaining > 0) {
        expect(await screen.findByText("Page 1 of 1")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "View loan 00000001" }),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("No loans match this filter."),
        ).not.toBeInTheDocument();
      } else {
        await screen.findByText("No loans match this filter.");
        await waitFor(() =>
          expect(mocks.request).toHaveBeenLastCalledWith(
            "/loans?page=1&limit=20&status=ACTIVE",
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
          ),
        );
        expect(
          screen.queryByRole("navigation", { name: "Pagination" }),
        ).not.toBeInTheDocument();
      }
      expect(screen.getByLabelText("Loan status")).toHaveValue("ACTIVE");
      expect(screen.queryByText("Page 2 of 1")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "View loan 00000021" }),
      ).not.toBeInTheDocument();
      expect(
        mocks.request.mock.calls.filter(([path]) =>
          String(path).endsWith("/return"),
        ),
      ).toHaveLength(1);
    },
  );

  it("keeps an unsuccessful return visible and does not retry the mutation automatically", async () => {
    mocks.user = { id: staffId, role: "ADMIN" };
    mocks.request.mockImplementation((path: string) =>
      path.endsWith("/return")
        ? Promise.reject(new Error("The request could not reach the server."))
        : Promise.resolve(collection([activeLoan])),
    );
    render(<LoansPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Return loan 30000000" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm return" }),
    );
    const confirmation = screen.getByRole("region", {
      name: "Confirm this return?",
    });
    expect(await within(confirmation).findByRole("alert")).toHaveTextContent(
      "The request could not reach the server.",
    );
    expect(
      mocks.request.mock.calls.filter(([path]) =>
        String(path).endsWith("/return"),
      ),
    ).toHaveLength(1);
  });
});
