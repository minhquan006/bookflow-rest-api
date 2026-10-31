import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import type { User } from "../src/features/auth/AuthContext";

const state = vi.hoisted(() => {
  const request = vi.fn();
  const metadata = vi.fn();
  return {
    user: null as User | null,
    request,
    metadata,
    api: { request, requestWithMetadata: metadata },
  };
});
vi.mock("../src/features/auth/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: state.user,
    loading: false,
    logout: vi.fn(),
    api: state.api,
  }),
}));
const book = {
  id: "10000000-0000-4000-8000-000000000001",
  categoryId: "20000000-0000-4000-8000-000000000001",
  title: "Synthetic book",
  author: "Synthetic Author",
  isbn: null,
  description: "",
  archivedAt: null,
  version: 1,
};
beforeEach(() => {
  localStorage.clear();
  state.user = {
    id: "reader",
    fullName: "Demo Reader",
    role: "LIBRARIAN",
    status: "ACTIVE",
    email: "reader@bookflow.test",
    createdAt: "2026-10-30T00:00:00Z",
  };
  state.request.mockReset().mockImplementation(async (path: string) => {
    if (path.includes("/availability"))
      return { data: { bookId: book.id, availableCopies: 1 } };
    if (path.startsWith("/categories"))
      return {
        data: [{ id: book.categoryId, name: "Demo category" }],
        pagination: { page: 1, totalPages: 1 },
      };
    if (path.includes("/copies"))
      return { data: [], pagination: { page: 1, totalPages: 0, total: 0 } };
    return {
      data: [book],
      pagination: { page: 1, limit: 12, totalPages: 1, total: 1 },
    };
  });
  state.metadata.mockResolvedValue({
    status: 200,
    data: { data: book },
    headers: new Headers({ ETag: `"book-${book.id}-v1"` }),
  });
});
afterEach(() => localStorage.clear());

describe("App Catalog viewer and language", () => {
  it("retains staff create form, draft search and identity across EN/VI", async () => {
    window.history.replaceState(null, "", "/books?q=applied&sort=-title");
    render(<App />);
    await screen.findByRole("heading", { name: book.title });
    await userEvent.type(screen.getByLabelText("Title or author"), " draft");
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    await userEvent.type(
      screen.getByLabelText("Title", { exact: true }),
      "Unsubmitted book",
    );
    const mutations = state.request.mock.calls.filter(
      ([, options]) => options?.method,
    );
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByLabelText("Tên sách hoặc tác giả")).toHaveValue(
      "applied draft",
    );
    expect(screen.getByLabelText("Tên sách", { exact: true })).toHaveValue(
      "Unsubmitted book",
    );
    await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
    expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
      "Unsubmitted book",
    );
    expect(
      state.request.mock.calls.filter(([, options]) => options?.method),
    ).toEqual(mutations);
  });
  it("retains edit/barcode drafts on language change but clears them for a new viewer", async () => {
    window.history.replaceState(null, "", `/books/${book.id}`);
    const view = render(<App />);
    await screen.findByRole("button", { name: "Edit metadata" });
    await userEvent.type(
      screen.getByLabelText("New copy barcode"),
      "Unsubmitted barcode",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Edit metadata" }),
    );
    await userEvent.clear(screen.getByLabelText("Title", { exact: true }));
    await userEvent.type(
      screen.getByLabelText("Title", { exact: true }),
      "Edited draft",
    );
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByLabelText("Tên sách", { exact: true })).toHaveValue(
      "Edited draft",
    );
    await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
    expect(screen.getByLabelText("New copy barcode")).toHaveValue(
      "Unsubmitted barcode",
    );
    state.user = { ...state.user!, id: "another-reader", role: "MEMBER" };
    view.rerender(<App />);
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Title", { exact: true }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("New copy barcode")).not.toBeInTheDocument();
    expect(
      state.request.mock.calls.some(([, options]) => options?.method),
    ).toBe(false);
  });
});
