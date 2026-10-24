import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../src/features/administration/DashboardPage";
import { AuditPage } from "../src/features/administration/AuditPage";

const mocks = vi.hoisted(() => {
  const request = vi.fn();
  return {
    role: "ADMIN" as "MEMBER" | "LIBRARIAN" | "ADMIN",
    request,
    api: { request },
  };
});
vi.mock("../src/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { role: mocks.role },
    loading: false,
    api: mocks.api,
  }),
}));

const empty = {
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};
beforeEach(() => {
  mocks.request.mockReset();
  mocks.role = "ADMIN";
});

describe("administration pages", () => {
  it("loads and refreshes aggregate statistics for library staff", async () => {
    mocks.role = "LIBRARIAN";
    mocks.request.mockResolvedValue({
      data: {
        activeBooks: 12,
        serviceableCopies: 31,
        activeLoans: 8,
        overdueLoans: 2,
        asOf: "2026-10-20T03:00:00Z",
      },
    });
    render(<DashboardPage />);
    expect(await screen.findByText("31")).toBeInTheDocument();
    expect(screen.getByText("Active books")).toBeInTheDocument();
    expect(screen.getByText(/20 Oct 2026, 10:00/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh statistics" }),
    );
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
  });

  it("does not request staff statistics for a member", () => {
    mocks.role = "MEMBER";
    render(<DashboardPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "available to librarians and administrators",
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("sends audit filters as UTC boundaries while labeling the inputs in Vietnam time", async () => {
    mocks.request.mockResolvedValue(empty);
    render(<AuditPage />);
    await screen.findByText("No audit events match these filters.");
    await userEvent.type(screen.getByLabelText("Action"), "loan.created");
    await userEvent.type(
      screen.getByLabelText("Actor ID"),
      "10000000-0000-4000-8000-000000000001",
    );
    const start = screen.getByLabelText("From (Vietnam time)");
    const end = screen.getByLabelText("To (Vietnam time, exclusive)");
    await userEvent.type(start, "2026-10-20T10:00");
    await userEvent.type(end, "2026-10-21T10:00");
    await userEvent.click(
      screen.getByRole("button", { name: "Apply filters" }),
    );
    await waitFor(() => {
      const lastPath = String(mocks.request.mock.calls.at(-1)?.[0]);
      const query = new URL(lastPath, "http://bookflow.test").searchParams;
      expect(query.get("action")).toBe("loan.created");
      expect(query.get("actorId")).toBe("10000000-0000-4000-8000-000000000001");
      expect(query.get("from")).toBe("2026-10-20T03:00:00.000Z");
      expect(query.get("to")).toBe("2026-10-21T03:00:00.000Z");
    });
  });

  it("rejects an invalid audit actor locally and keeps the previous query", async () => {
    mocks.request.mockResolvedValue(empty);
    render(<AuditPage />);
    await screen.findByText("No audit events match these filters.");
    await userEvent.type(screen.getByLabelText("Actor ID"), "not-a-user-id");
    await userEvent.click(
      screen.getByRole("button", { name: "Apply filters" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Actor ID must be a UUID.",
    );
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("keeps the audit page and its requests restricted to administrators", () => {
    mocks.role = "LIBRARIAN";
    render(<AuditPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Only administrators");
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
