import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/http";
import { UsersPage } from "../src/features/users/UsersPage";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  refreshProfile: vi.fn(),
  role: "ADMIN",
}));
vi.mock("../src/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-id", fullName: "Admin", role: mocks.role },
    api: { request: mocks.request },
    refreshProfile: mocks.refreshProfile,
  }),
}));
const admin = {
  id: "admin-id",
  fullName: "Demo Admin",
  email: "admin@example.test",
  role: "ADMIN",
  status: "ACTIVE",
  createdAt: "2026-10-20T00:00:00Z",
};
const member = {
  id: "member-id",
  fullName: "Demo Reader",
  email: "reader@example.test",
  role: "MEMBER",
  status: "ACTIVE",
  createdAt: "2026-10-20T00:00:00Z",
};
const result = {
  data: [admin, member],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};
afterEach(() => {
  mocks.role = "ADMIN";
});

describe("administrator user management", () => {
  it("does not request private data for a member", () => {
    mocks.role = "MEMBER";
    render(<UsersPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Administrator access is required",
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("loads safe account information and filters the current page", async () => {
    mocks.request.mockResolvedValue(result);
    render(<UsersPage />);
    expect(await screen.findByText("reader@example.test")).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      "/users?page=1&limit=20",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await userEvent.type(screen.getByRole("searchbox"), "reader");
    expect(screen.queryByText("admin@example.test")).not.toBeInTheDocument();
    expect(screen.getByText("reader@example.test")).toBeInTheDocument();
  });

  it("displays last-administrator conflict without pretending the update succeeded", async () => {
    mocks.request.mockImplementation(async (_path, options) => {
      if (options?.method === "PATCH")
        throw new ApiError({
          type: "about:blank",
          title: "Conflict",
          status: 409,
          detail: "At least one active administrator is required.",
        });
      return result;
    });
    render(<UsersPage />);
    await screen.findByText("admin@example.test");
    await userEvent.selectOptions(
      screen.getByLabelText("Status for admin@example.test"),
      "DISABLED",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save Demo Admin" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "At least one active administrator is required.",
    );
    expect(screen.queryByText("Access updated.")).not.toBeInTheDocument();
  });

  it("patches only role/status and reloads the server state", async () => {
    let changed = false;
    mocks.request.mockImplementation(async (_path, options) => {
      if (options?.method === "PATCH") {
        changed = true;
        return { data: { ...member, role: "LIBRARIAN" } };
      }
      return {
        ...result,
        data: [admin, { ...member, role: changed ? "LIBRARIAN" : "MEMBER" }],
      };
    });
    render(<UsersPage />);
    await screen.findByText("reader@example.test");
    await userEvent.selectOptions(
      screen.getByLabelText("Role for reader@example.test"),
      "LIBRARIAN",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save Demo Reader" }),
    );
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith("/users/member-id", {
        method: "PATCH",
        json: { role: "LIBRARIAN", status: "ACTIVE" },
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save Demo Reader" }),
      ).toBeDisabled(),
    );
  });
});
