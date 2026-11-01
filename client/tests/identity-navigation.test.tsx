import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AppRouter } from "../src/app/AppRouter";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { useAuth } from "../src/features/auth/AuthContext";
import type { User } from "../src/features/auth/AuthContext";

vi.mock("../src/features/auth/AuthContext", () => ({ useAuth: vi.fn() }));
const user: User = {
  id: "account-a",
  fullName: "Staff A",
  email: "a@example.test",
  role: "LIBRARIAN",
  status: "ACTIVE",
  createdAt: "2026-10-20T00:00:00Z",
};
const request = vi.fn().mockImplementation(async (path: string) => ({
  data: path.startsWith("/categories")
    ? [{ id: "category", name: "Books" }]
    : [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
}));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it.each([
  ["another account", { ...user, id: "account-b", fullName: "Staff B" }],
  ["another role", { ...user, role: "ADMIN" as const }],
])(
  "discards the previous viewer's create draft after %s",
  async (_reason, next) => {
    localStorage.clear();
    window.history.replaceState(null, "", "/books");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const state = {
      user,
      loading: false,
      api: { request, requestWithMetadata: vi.fn() },
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      sessionError: "",
      refreshProfile: vi.fn(),
    };
    vi.mocked(useAuth).mockReturnValue(state);
    const view = render(
      <LanguageProvider>
        <AppRouter />
      </LanguageProvider>,
    );
    await screen.findByText("No books found. Try another search or category.");
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    await userEvent.type(
      screen.getByLabelText("Title", { exact: true }),
      "Private draft A",
    );
    vi.mocked(useAuth).mockReturnValue({ ...state, user: next });
    view.rerender(
      <LanguageProvider>
        <AppRouter />
      </LanguageProvider>,
    );
    expect(
      screen.queryByRole("form", { name: "Create book" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    expect(screen.getByLabelText("Title", { exact: true })).toHaveValue("");
  },
);
