import { act, render, screen, waitFor, within } from "@testing-library/react";
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

const categoryId = "20000000-0000-4000-8000-000000000001";
const staff: User = {
  id: "10000000-0000-4000-8000-000000000001",
  fullName: "Synthetic Staff",
  email: "review-staff@bookflow.test",
  role: "LIBRARIAN",
  status: "ACTIVE",
  createdAt: "2026-10-30T00:00:00Z",
};
const books = Array.from({ length: 25 }, (_, index) => ({
  id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  categoryId,
  title: `Synthetic book ${String(index + 1).padStart(2, "0")}`,
  author: "Synthetic Author",
  isbn: null,
  description: "Synthetic Q1 review fixture",
  archivedAt: null,
  version: 1,
}));
const archived = {
  ...books[0]!,
  id: "30000000-0000-4000-8000-000000000099",
  title: "STAFF ARCHIVED FIXTURE",
  archivedAt: "2026-10-30T00:00:00Z",
};
function response(path: string) {
  const url = new URL(path || "/", "http://localhost");
  if (url.pathname === "/categories")
    return {
      data: [{ id: categoryId, name: "Synthetic category", slug: "synthetic" }],
      pagination: { page: 1, totalPages: 1 },
    };
  if (url.pathname.endsWith("/availability"))
    return { data: { bookId: books[0]!.id, availableCopies: 1 } };
  if (url.pathname.endsWith("/copies"))
    return { data: [], pagination: { page: 1, totalPages: 0, total: 0 } };
  if (url.pathname === "/books") {
    const page = Number(url.searchParams.get("page"));
    const limit = Number(url.searchParams.get("limit"));
    const rows =
      url.searchParams.get("includeArchived") === "true"
        ? [archived, ...books]
        : books;
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / limit),
      },
    };
  }
  return { data: { message: "Frontend and backend are connected." } };
}
function mutations() {
  return [...state.request.mock.calls, ...state.metadata.mock.calls].filter(
    ([, options]) => options?.method && options.method !== "GET",
  );
}
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/books");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  state.user = { ...staff };
  state.request
    .mockReset()
    .mockImplementation(async (path: string) => response(path));
  state.metadata.mockReset().mockResolvedValue({
    status: 200,
    data: { data: books[0] },
    headers: new Headers({ ETag: `"book-${books[0]!.id}-v1"` }),
  });
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Q1 independent frontend review", () => {
  it.each([null, "MEMBER", "LIBRARIAN", "ADMIN"] as const)(
    "shows only the navigation allowed to %s",
    async (role) => {
      state.user = role ? { ...staff, role } : null;
      render(<App />);
      await screen.findByRole("heading", { name: books[0]!.title });
      const nav = within(
        screen.getByRole("navigation", { name: "Main navigation" }),
      );
      expect(nav.getByRole("button", { name: "Overview" })).toBeInTheDocument();
      expect(nav.getByRole("button", { name: "Catalog" })).toBeInTheDocument();
      expect(
        Boolean(nav.queryByRole("button", { name: /^(All loans|My loans)$/ })),
      ).toBe(role !== null);
      expect(Boolean(nav.queryByRole("button", { name: "Categories" }))).toBe(
        role === "LIBRARIAN" || role === "ADMIN",
      );
      expect(Boolean(nav.queryByRole("button", { name: "Dashboard" }))).toBe(
        role === "LIBRARIAN" || role === "ADMIN",
      );
      expect(Boolean(nav.queryByRole("button", { name: "Users" }))).toBe(
        role === "ADMIN",
      );
      expect(Boolean(nav.queryByRole("button", { name: "Audit log" }))).toBe(
        role === "ADMIN",
      );
    },
  );

  it("keeps MEMBER query/category/sort/page and unsubmitted text through EN-VI-EN without requests", async () => {
    state.user = { ...staff, role: "MEMBER" };
    render(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    await userEvent.type(screen.getByLabelText("Title or author"), "book");
    await userEvent.selectOptions(
      screen.getByLabelText("Category"),
      categoryId,
    );
    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "-title");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText(/^Page 2 of /);
    const appliedPath = state.request.mock.calls
      .filter(([path]) => path.startsWith("/books?"))
      .at(-1)![0];
    const applied = new URL(appliedPath, "http://localhost").searchParams;
    expect(applied.get("page")).toBe("2");
    expect(applied.get("q")).toBe("book");
    expect(applied.get("categoryId")).toBe(categoryId);
    expect(applied.get("sort")).toBe("-title");
    await userEvent.type(screen.getByLabelText("Title or author"), " draft");
    const requests = state.request.mock.calls.length;
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByLabelText("Tên sách hoặc tác giả")).toHaveValue(
      "book draft",
    );
    await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
    expect(screen.getByLabelText("Category")).toHaveValue(categoryId);
    expect(screen.getByLabelText("Sort by")).toHaveValue("-title");
    expect(screen.getByLabelText("Title or author")).toHaveValue("book draft");
    expect(screen.getByText(/^Page 2 of /)).toBeInTheDocument();
    expect(state.request).toHaveBeenCalledTimes(requests);
    expect(mutations()).toEqual([]);
  });

  it("keeps every staff create field through EN-VI-EN without submitting", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    const form = screen.getByRole("form", { name: "Create book" });
    await userEvent.type(
      within(form).getByLabelText("Title", {}),
      "Unsaved create title",
    );
    await userEvent.type(
      within(form).getByLabelText("Author", {}),
      "Unsaved author",
    );
    await userEvent.type(
      within(form).getByLabelText("ISBN", {}),
      "9780132350884",
    );
    await userEvent.type(
      within(form).getByLabelText("Description", {}),
      "Unsaved description",
    );
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByLabelText("Tên sách", {})).toHaveValue(
      "Unsaved create title",
    );
    await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
    const restored = screen.getByRole("form", {
      name: "Create book",
    });
    expect(within(restored).getByLabelText("Title", {})).toHaveValue(
      "Unsaved create title",
    );
    expect(within(restored).getByLabelText("Author", {})).toHaveValue(
      "Unsaved author",
    );
    expect(within(restored).getByLabelText("ISBN", {})).toHaveValue(
      "9780132350884",
    );
    expect(within(restored).getByLabelText("Category", {})).toHaveValue(
      categoryId,
    );
    expect(within(restored).getByLabelText("Description", {})).toHaveValue(
      "Unsaved description",
    );
    expect(mutations()).toEqual([]);
  });

  it.each(["account", "role"] as const)(
    "clears edit and barcode drafts after a %s change",
    async (change) => {
      window.history.replaceState(null, "", `/books/${books[0]!.id}`);
      const view = render(<App />);
      await screen.findByRole("button", { name: "Edit metadata" });
      await userEvent.type(
        screen.getByLabelText("New copy barcode"),
        "UNSAVED-COPY",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Edit metadata" }),
      );
      await userEvent.clear(screen.getByLabelText("Title", {}));
      await userEvent.type(screen.getByLabelText("Title", {}), "UNSAVED-EDIT");
      await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
      expect(screen.getByLabelText("Tên sách", {})).toHaveValue("UNSAVED-EDIT");
      await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
      expect(screen.getByLabelText("New copy barcode")).toHaveValue(
        "UNSAVED-COPY",
      );
      state.user =
        change === "account"
          ? { ...staff, id: "10000000-0000-4000-8000-000000000002" }
          : { ...staff, role: "MEMBER" };
      view.rerender(<App />);
      await screen.findByRole("heading", { name: books[0]!.title });
      expect(
        screen.queryByDisplayValue("UNSAVED-EDIT"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByDisplayValue("UNSAVED-COPY"),
      ).not.toBeInTheDocument();
      if (change === "account")
        expect(screen.getByLabelText("New copy barcode")).toHaveValue("");
      else
        expect(
          screen.queryByLabelText("New copy barcode"),
        ).not.toBeInTheDocument();
      expect(mutations()).toEqual([]);
    },
  );

  it("hides archived results and a create draft immediately after staff becomes MEMBER", async () => {
    const view = render(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    await userEvent.click(screen.getByLabelText("Include archived"));
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("heading", { name: archived.title });
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    await userEvent.type(
      screen.getByLabelText("Title", {}),
      "STAFF CREATE DRAFT",
    );
    state.user = { ...staff, role: "MEMBER" };
    view.rerender(<App />);
    expect(
      screen.queryByRole("heading", { name: archived.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue("STAFF CREATE DRAFT"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Include archived")).not.toBeInTheDocument();
    await screen.findByRole("heading", { name: books[0]!.title });
    expect(mutations()).toEqual([]);
  });

  it("does not resurrect a create draft when switching to another librarian and back", async () => {
    const view = render(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    await userEvent.type(
      screen.getByLabelText("Title", {}),
      "FIRST VIEWER DRAFT",
    );
    state.user = { ...staff, id: "10000000-0000-4000-8000-000000000002" };
    view.rerender(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    expect(
      screen.queryByDisplayValue("FIRST VIEWER DRAFT"),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    expect(screen.getByLabelText("Title", {})).toHaveValue("");
    state.user = { ...staff };
    view.rerender(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    expect(
      screen.queryByDisplayValue("FIRST VIEWER DRAFT"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("form", { name: "Create book" }),
    ).not.toBeInTheDocument();
    expect(mutations()).toEqual([]);
  });

  it("ignores a late archived response after an account and role change", async () => {
    const view = render(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    let finish: (value: unknown) => void = () => {};
    let signal: AbortSignal | undefined;
    state.request.mockImplementation(
      (path: string, options?: { signal?: AbortSignal }) => {
        if (path.includes("includeArchived=true")) {
          signal = options?.signal;
          return new Promise((resolve) => {
            finish = resolve;
          });
        }
        return Promise.resolve(response(path));
      },
    );
    await userEvent.click(screen.getByLabelText("Include archived"));
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(signal).toBeDefined());
    state.user = {
      ...staff,
      id: "10000000-0000-4000-8000-000000000003",
      role: "MEMBER",
    };
    view.rerender(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish(response("/books?page=1&limit=12&includeArchived=true"));
    });
    expect(
      screen.queryByRole("heading", { name: archived.title }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Include archived")).not.toBeInTheDocument();
  });

  it.each(["/categories", "/dashboard", "/users", "/audit-logs"])(
    "denies MEMBER direct navigation to %s",
    async (path) => {
      state.user = { ...staff, role: "MEMBER" };
      window.history.replaceState(null, "", path);
      render(<App />);
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(state.request).not.toHaveBeenCalled();
      expect(state.metadata).not.toHaveBeenCalled();
    },
  );

  it("keeps route and language consistent through actual browser history events", async () => {
    state.user = { ...staff, role: "MEMBER" };
    render(<App />);
    await screen.findByRole("heading", { name: books[0]!.title });
    await userEvent.click(
      screen.getByRole("button", {
        name: `View ${books[0]!.title}`,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Book catalog" }),
      ).not.toBeInTheDocument(),
    );
    await screen.findByRole("heading", { name: books[0]!.title });
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    act(() => window.history.back());
    await screen.findByRole("heading", { name: "Danh mục sách" });
    act(() => window.history.forward());
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Danh mục sách" }),
      ).not.toBeInTheDocument(),
    );
    await screen.findByRole("heading", { name: books[0]!.title });
    expect(screen.getByLabelText("Ngôn ngữ")).toHaveValue("vi");
    expect(mutations()).toEqual([]);
  });
});
