import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { LANGUAGE_STORAGE_KEY } from "../src/i18n/language";
import { LoansPage } from "../src/features/loans/LoansPage";
import { formatLibraryDate } from "../src/lib/datetime";
import type { Loan } from "../src/features/loans/types";

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
  book: {
    id: "40000000-0000-4000-8000-000000000001",
    title: "Library at Dawn",
  },
  copy: { id: "50000000-0000-4000-8000-000000000001", barcode: "BOOK-ONE" },
  borrower: { id: borrowerId, fullName: "Synthetic Borrower" },
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
  localStorage.clear();
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
    expect(within(table).getByText("Active loan")).toBeInTheDocument();
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
  it.each(["MEMBER", "LIBRARIAN"] as const)(
    "shows EN/VI actions and statuses for %s without translating record contents",
    async (role) => {
      mocks.user = { id: role === "MEMBER" ? borrowerId : staffId, role };
      localStorage.setItem(LANGUAGE_STORAGE_KEY, "vi");
      const records = [
        {
          ...activeLoan,
          book: { ...activeLoan.book, title: "Return recorded" },
        },
        {
          ...activeLoan,
          id: "60000000-0000-4000-8000-000000000001",
          dueAt: new Date(Date.now() - 60_000).toISOString(),
        },
        {
          ...activeLoan,
          id: "70000000-0000-4000-8000-000000000001",
          returnedAt: activeLoan.borrowedAt,
          returnedBy: staffId,
        },
      ];
      mocks.request.mockResolvedValue(collection(records));
      render(
        <LanguageProvider>
          <LoansPage />
        </LanguageProvider>,
      );
      const table = await screen.findByRole("table");
      expect(within(table).getByText("Return recorded")).toBeInTheDocument();
      expect(
        within(table).getByText("Đã ghi nhận trả sách"),
      ).toBeInTheDocument();
      for (const status of ["Đang mượn", "Quá hạn", "Đã trả"])
        expect(within(table).getByText(status)).toBeInTheDocument();
      expect(within(table).getAllByText("BOOK-ONE")).toHaveLength(3);
      if (role === "MEMBER") {
        expect(
          within(table).getAllByText("Trả sách tại thư viện"),
        ).toHaveLength(2);
        expect(
          within(table).queryByText("Synthetic Borrower"),
        ).not.toBeInTheDocument();
      } else {
        expect(within(table).getAllByText("Synthetic Borrower")).toHaveLength(
          3,
        );
        await userEvent.click(
          screen.getByRole("button", { name: "Trả sách cho phiếu 30000000" }),
        );
        const confirmation = screen.getByRole("region", {
          name: "Xác nhận đã nhận lại sách?",
        });
        for (const text of [
          "Return recorded",
          "BOOK-ONE",
          "Synthetic Borrower",
        ])
          expect(within(confirmation).getByText(text)).toBeInTheDocument();
      }
    },
  );

  it("locks a pending return and shows success only after the matching confirmation", async () => {
    mocks.user = { id: staffId, role: "LIBRARIAN" };
    let resolveReturn!: (result: unknown) => void;
    mocks.request.mockImplementation((path: string) =>
      path.endsWith("/return")
        ? new Promise((resolve) => {
            resolveReturn = resolve;
          })
        : Promise.resolve(collection([activeLoan])),
    );
    render(<LoansPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Return loan 30000000" }),
    );
    const confirmation = screen.getByRole("region", {
      name: "Confirm this return?",
    });
    for (const text of ["Library at Dawn", "BOOK-ONE", "Synthetic Borrower"])
      expect(within(confirmation).getByText(text)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm return" }),
    );
    expect(
      screen.getByRole("button", { name: "Confirm return" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByText(/Return confirmed at/)).not.toBeInTheDocument();
    await act(async () =>
      resolveReturn({
        data: {
          loanId: activeLoan.id,
          returnedAt: activeLoan.borrowedAt,
          returnedBy: staffId,
        },
      }),
    );
    expect(await screen.findByText(/Return confirmed at/)).toBeInTheDocument();
    expect(
      mocks.request.mock.calls.filter(([path]) => path.endsWith("/return")),
    ).toHaveLength(1);
  });

  it.each([
    null,
    ...[
      { returnedBy: [staffId] },
      { returnedBy: null },
      { returnedBy: 123 },
      { returnedAt: "2026-02-30T10:00:00.000Z" },
      { returnedAt: "2025-02-29T10:00:00.000Z" },
      { returnedAt: "1900-02-29T10:00:00+07:00" },
      { returnedAt: "2026-04-31T10:00:00-04:00" },
      { returnedAt: "2026-01-01T24:00:00Z" },
      { returnedAt: "2026-01-01T10:00:00+24:00" },
    ].map((invalid) => ({
      data: {
        loanId: activeLoan.id,
        returnedAt: activeLoan.borrowedAt,
        returnedBy: staffId,
        ...invalid,
      },
    })),
    {
      data: {
        loanId: "different-loan",
        returnedAt: activeLoan.borrowedAt,
        returnedBy: staffId,
      },
    },
    {
      data: {
        loanId: activeLoan.id,
        returnedAt: "yesterday",
        returnedBy: staffId,
      },
    },
    {
      data: {
        loanId: activeLoan.id,
        returnedAt: activeLoan.borrowedAt,
        returnedBy: "unknown-staff",
      },
    },
  ])(
    "keeps an unverifiable response ambiguous and tells staff to refresh history (%j)",
    async (response) => {
      mocks.user = { id: staffId, role: "ADMIN" };
      mocks.request.mockImplementation((path: string) =>
        Promise.resolve(
          path.endsWith("/return") ? response : collection([activeLoan]),
        ),
      );
      render(<LoansPage />);
      await userEvent.click(
        await screen.findByRole("button", { name: "Return loan 30000000" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Confirm return" }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The return response could not be verified. Refresh the history before trying again.",
      );
      expect(screen.queryByText(/Return confirmed at/)).not.toBeInTheDocument();
      const confirmation = screen.getByRole("region", {
        name: "Confirm this return?",
      });
      expect(
        within(confirmation).getByRole("button", { name: "Confirm return" }),
      ).toBeEnabled();
      expect(
        within(confirmation).getByText(
          "If the connection failed, refresh the history before trying again.",
        ),
      ).toBeInTheDocument();
      expect(
        mocks.request.mock.calls.filter(([path]) => path.endsWith("/return")),
      ).toHaveLength(1);
    },
  );

  it.each([
    "2024-02-29T10:00:00.000Z",
    "2000-02-29T00:15:30.123456+07:00",
    "2024-02-29T23:59:59-04:00",
    "2024-02-29t10:00:00z",
  ])(
    "accepts a valid timestamp %s and an earlier confirmation by different staff",
    async (returnedAt) => {
      mocks.user = { id: staffId, role: "LIBRARIAN" };
      const originalStaff = "90000000-0000-4000-8000-000000000001";
      mocks.request.mockImplementation((path: string) =>
        Promise.resolve(
          path.endsWith("/return")
            ? {
                data: {
                  loanId: activeLoan.id,
                  returnedAt,
                  returnedBy: originalStaff,
                },
              }
            : path.includes("?")
              ? collection([activeLoan])
              : { data: activeLoan },
        ),
      );
      render(<LoansPage />);
      await userEvent.click(
        await screen.findByRole("button", { name: "View loan 30000000" }),
      );
      await screen.findByRole("heading", { name: "Loan details" });
      await userEvent.click(
        screen.getByRole("button", { name: "Return loan 30000000" }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Confirm return" }),
      );
      expect(await screen.findByText(/Return confirmed at/)).toHaveTextContent(
        formatLibraryDate(returnedAt),
      );
      const detail = screen.getByRole("region", { name: "Loan details" });
      expect(within(detail).getByText(originalStaff)).toBeInTheDocument();
      expect(
        within(detail).getByText(formatLibraryDate(returnedAt)),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Confirm this return?" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        mocks.request.mock.calls.filter(([path]) => path.endsWith("/return")),
      ).toHaveLength(1);
    },
  );

  it("rejects a late return after switching away and back to the same staff account", async () => {
    mocks.user = { id: staffId, role: "LIBRARIAN" };
    let resolveReturn!: (result: unknown) => void;
    mocks.request.mockImplementation((path: string) =>
      path.endsWith("/return")
        ? new Promise((resolve) => {
            resolveReturn = resolve;
          })
        : Promise.resolve(
            collection(mocks.user?.role === "LIBRARIAN" ? [activeLoan] : []),
          ),
    );
    const { rerender } = render(<LoansPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Return loan 30000000" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm return" }),
    );
    mocks.user = { id: borrowerId, role: "MEMBER" };
    rerender(<LoansPage />);
    await screen.findByText("No loans match this filter.");
    mocks.user = { id: staffId, role: "LIBRARIAN" };
    rerender(<LoansPage />);
    await screen.findByRole("button", { name: "Return loan 30000000" });
    await act(async () =>
      resolveReturn({
        data: {
          loanId: activeLoan.id,
          returnedAt: activeLoan.borrowedAt,
          returnedBy: staffId,
        },
      }),
    );
    expect(screen.queryByText(/Return confirmed at/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Confirm this return?" }),
    ).not.toBeInTheDocument();
  });
});
