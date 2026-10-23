import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogPage } from "../src/features/catalog/CatalogPage";
import { BookDetailPage } from "../src/features/catalog/BookDetailPage";
import { CategoriesPage } from "../src/features/catalog/CategoriesPage";
import { ApiError } from "../src/lib/http";
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
  useAuth: () => ({
    user: state.user,
    api: state.api,
  }),
}));
const category = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Technology",
  slug: "technology",
  createdAt: "2026-10-20T00:00:00Z",
};
const book = {
  id: "20000000-0000-4000-8000-000000000001",
  categoryId: category.id,
  title: "Practical Web Foundations",
  author: "Demo Author",
  isbn: null,
  description: "A clear guide to web APIs.",
  archivedAt: null,
  version: 1,
};
const copy = {
  id: "30000000-0000-4000-8000-000000000001",
  bookId: book.id,
  barcode: "BOOK-001",
  conditionStatus: "AVAILABLE",
  createdAt: "2026-10-20T00:00:00Z",
};
function principal(role: User["role"]): User {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    fullName: "Demo Reader",
    email: "reader@bookflow.test",
    role,
    status: "ACTIVE",
    createdAt: "2026-10-20T00:00:00Z",
  };
}
function metadata(version = 1) {
  return {
    data: { data: { ...book, version } },
    status: 200,
    headers: new Headers({ ETag: `"book-${book.id}-v${version}"` }),
  };
}
function problem(status: number, code: string, detail: string) {
  return new ApiError({
    type: "about:blank",
    title: "Request failed",
    status,
    code,
    detail,
  });
}
beforeEach(() => {
  state.user = null;
  state.request.mockReset();
  state.metadata.mockReset();
  state.metadata.mockResolvedValue(metadata());
  state.request.mockImplementation(async (path: string) => {
    if (path.split("?")[0] === "/categories")
      return {
        data: [category],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      };
    if (path.includes("/availability"))
      return { data: { bookId: book.id, availableCopies: 1 } };
    if (path.includes("/copies"))
      return {
        data: [copy],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
    return {
      data: [book],
      pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    };
  });
});
afterEach(cleanup);

describe("catalog and copy screens", () => {
  it("lets a public reader search/filter without exposing staff actions", async () => {
    const navigate = vi.fn();
    render(
      <CatalogPage
        client={state.api}
        user={state.user}
        onNavigate={navigate}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: book.title }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Add book" }),
    ).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Title or author"), "web APIs");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(
        state.request.mock.calls.some(
          ([path]) => typeof path === "string" && path.includes("q=web+APIs"),
        ),
      ).toBe(true),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Category"),
      category.id,
    );
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(
        state.request.mock.calls.some(
          ([path]) =>
            typeof path === "string" &&
            path.includes(`categoryId=${category.id}`),
        ),
      ).toBe(true),
    );
    await userEvent.click(
      screen.getByRole("button", { name: `View ${book.title}` }),
    );
    expect(navigate).toHaveBeenCalledWith(`/books/${book.id}`);
  });

  it("reports a catalog failure and permits a manual retry", async () => {
    state.request.mockRejectedValueOnce(
      new Error("Catalog temporarily unavailable."),
    );
    render(
      <CatalogPage client={state.api} user={state.user} onNavigate={vi.fn()} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Catalog temporarily unavailable.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: book.title }),
    ).toBeVisible();
  });

  it("creates staff metadata using the public contract and navigates to the new book", async () => {
    state.user = principal("LIBRARIAN");
    const navigate = vi.fn();
    const original = state.request.getMockImplementation()!;
    state.request.mockImplementation(
      async (path: string, options?: { method?: string }) =>
        options?.method === "POST" ? { data: book } : original(path),
    );
    render(
      <CatalogPage
        client={state.api}
        user={state.user}
        onNavigate={navigate}
      />,
    );
    await screen.findByRole("heading", { name: book.title });
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    await userEvent.type(screen.getByLabelText("Title"), "A new book");
    await userEvent.type(screen.getByLabelText("Author"), "A new author");
    await userEvent.click(screen.getByRole("button", { name: "Create book" }));
    await waitFor(() =>
      expect(state.request).toHaveBeenCalledWith(
        "/books",
        expect.objectContaining({
          method: "POST",
          json: {
            title: "A new book",
            author: "A new author",
            isbn: null,
            categoryId: category.id,
            description: "",
          },
        }),
      ),
    );
    expect(navigate).toHaveBeenCalledWith(`/books/${book.id}`);
  });

  it("loads later category option pages for both filtering and book forms", async () => {
    state.user = principal("LIBRARIAN");
    const original = state.request.getMockImplementation()!;
    const later = {
      ...category,
      id: "10000000-0000-4000-8000-000000000101",
      name: "Later category",
      slug: "later-category",
    };
    state.request.mockImplementation(async (path: string) => {
      if (path.startsWith("/categories?")) {
        const page = Number(
          new URLSearchParams(path.split("?")[1]).get("page"),
        );
        return {
          data: page === 1 ? [category] : [later],
          pagination: { page, limit: 100, total: 101, totalPages: 2 },
        };
      }
      return original(path);
    });
    render(
      <CatalogPage client={state.api} user={state.user} onNavigate={vi.fn()} />,
    );
    await screen.findByRole("option", { name: "Later category" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), later.id);
    await userEvent.click(screen.getByRole("button", { name: "Add book" }));
    expect(
      within(
        screen
          .getByRole("form", { name: "Create book" })
          .querySelector("select")!,
      ).getByRole("option", {
        name: "Later category",
      }),
    ).toBeInTheDocument();
    expect(state.request).toHaveBeenCalledWith(
      "/categories?page=2&limit=100",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("paginates category management to records after the first twenty", async () => {
    state.user = principal("ADMIN");
    const later = {
      ...category,
      id: "10000000-0000-4000-8000-000000000021",
      name: "Later category",
      slug: "later-category",
    };
    state.request.mockImplementation(async (path: string) => {
      const page = Number(new URLSearchParams(path.split("?")[1]).get("page"));
      return {
        data: page === 1 ? [category] : [later],
        pagination: { page, limit: 20, total: 21, totalPages: 2 },
      };
    });
    render(<CategoriesPage />);
    await screen.findByRole("button", { name: "Edit Technology" });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByRole("button", { name: "Edit Later category" }),
    ).toBeVisible();
    expect(state.request).toHaveBeenCalledWith(
      "/categories?page=2&limit=20",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("paginates physical copies beyond the first twenty", async () => {
    state.user = principal("LIBRARIAN");
    const original = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path: string) => {
      if (path.includes("/copies?")) {
        const page = Number(
          new URLSearchParams(path.split("?")[1]).get("page"),
        );
        return {
          data: [{ ...copy, barcode: page === 1 ? copy.barcode : "BOOK-021" }],
          pagination: { page, limit: 20, total: 21, totalPages: 2 },
        };
      }
      return original(path);
    });
    render(<BookDetailPage bookId={book.id} onNavigate={vi.fn()} />);
    await screen.findByLabelText(`Condition for ${copy.barcode}`);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByLabelText("Condition for BOOK-021"),
    ).toBeVisible();
    expect(state.request).toHaveBeenCalledWith(
      `/books/${book.id}/copies?page=2&limit=20`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("submits only editable book metadata and excludes resource DTO fields", async () => {
    state.user = principal("LIBRARIAN");
    render(<BookDetailPage bookId={book.id} onNavigate={vi.fn()} />);
    await screen.findByRole("heading", { name: book.title });
    await userEvent.click(
      screen.getByRole("button", { name: "Edit metadata" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save book" }));
    await waitFor(() =>
      expect(state.metadata).toHaveBeenCalledWith(
        `/books/${book.id}`,
        expect.objectContaining({
          method: "PUT",
          json: {
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            categoryId: book.categoryId,
            description: book.description,
          },
        }),
      ),
    );
    expect(await screen.findByText("Book metadata saved.")).toBeVisible();
  });

  it.each(["guest", "MEMBER"] as const)(
    "shows availability and the appropriate borrowing controls to %s after Loans integration",
    async (viewer) => {
      state.user = viewer === "guest" ? null : principal(viewer);
      const navigate = vi.fn();
      render(<BookDetailPage bookId={book.id} onNavigate={navigate} />);
      expect(
        await screen.findByRole("heading", { name: book.title }),
      ).toBeVisible();
      expect(screen.getByText("1 available copy")).toBeVisible();
      if (viewer === "MEMBER") {
        expect(
          screen.getByRole("button", { name: "Borrow this book" }),
        ).toBeEnabled();
        expect(screen.getByRole("button", { name: "My loans" })).toBeVisible();
      } else {
        expect(
          screen.getByRole("button", {
            name: "Sign in to borrow",
          }),
        ).toBeVisible();
        expect(
          screen.queryByRole("button", {
            name: "Borrow this book",
          }),
        ).not.toBeInTheDocument();
      }
      expect(
        screen.queryByText("Borrowing is coming soon."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit metadata" }),
      ).not.toBeInTheDocument();
      expect(
        state.request.mock.calls.some(([path]) => path.startsWith("/loans")),
      ).toBe(false);
      await userEvent.click(
        screen.getByRole("button", { name: "Back to catalog" }),
      );
      expect(navigate).toHaveBeenCalledWith("/books");
      expect(navigate).not.toHaveBeenCalledWith("/loans");
    },
  );

  it("refreshes live availability after a copy change while retaining metadata on 304", async () => {
    state.user = principal("LIBRARIAN");
    let available = 1;
    const original = state.request.getMockImplementation()!;
    state.request.mockImplementation(
      async (path: string, options?: { method?: string }) => {
        if (path === `/copies/${copy.id}` && options?.method === "PATCH") {
          available = 0;
          return { data: { ...copy, conditionStatus: "MAINTENANCE" } };
        }
        if (path.includes("/availability"))
          return { data: { bookId: book.id, availableCopies: available } };
        return original(path);
      },
    );
    state.metadata.mockResolvedValueOnce(metadata()).mockResolvedValue({
      data: undefined,
      status: 304,
      headers: new Headers({ ETag: `"book-${book.id}-v1"` }),
    });
    render(<BookDetailPage bookId={book.id} onNavigate={vi.fn()} />);
    await screen.findByLabelText(`Condition for ${copy.barcode}`);
    await userEvent.selectOptions(
      screen.getByLabelText(`Condition for ${copy.barcode}`),
      "MAINTENANCE",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Update condition" }),
    );
    expect(await screen.findByText("0 available copies")).toBeVisible();
    expect(screen.getByRole("heading", { name: book.title })).toBeVisible();
    expect(state.metadata.mock.calls[1][1].headers.get("If-None-Match")).toBe(
      `"book-${book.id}-v1"`,
    );
  });

  it("removes cached book details when a copy refresh reveals the resource is no longer visible", async () => {
    state.user = principal("LIBRARIAN");
    state.metadata
      .mockResolvedValueOnce(metadata())
      .mockRejectedValue(
        problem(404, "RESOURCE_NOT_FOUND", "The book is no longer available."),
      );
    render(<BookDetailPage bookId={book.id} onNavigate={vi.fn()} />);
    await screen.findByLabelText(`Condition for ${copy.barcode}`);
    expect(screen.getByRole("heading", { name: book.title })).toBeVisible();
    await userEvent.selectOptions(
      screen.getByLabelText(`Condition for ${copy.barcode}`),
      "MAINTENANCE",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Update condition" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The book is no longer available.",
      ),
    );
    expect(
      screen.queryByRole("heading", { name: book.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit metadata" }),
    ).not.toBeInTheDocument();
  });

  it("requires review of the latest version after a stale write and retains the editor draft", async () => {
    state.user = principal("ADMIN");
    let reads = 0;
    state.metadata.mockImplementation(
      async (_path: string, options: { method?: string }) => {
        if (options.method === "PUT")
          throw problem(412, "VERSION_MISMATCH", "The book has changed.");
        reads += 1;
        return reads === 1
          ? metadata(1)
          : {
              ...metadata(2),
              data: {
                data: { ...book, title: "Latest server title", version: 2 },
              },
            };
      },
    );
    render(<BookDetailPage bookId={book.id} onNavigate={vi.fn()} />);
    await screen.findByRole("heading", { name: book.title });
    await userEvent.click(
      screen.getByRole("button", { name: "Edit metadata" }),
    );
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "My retained draft");
    await userEvent.click(screen.getByRole("button", { name: "Save book" }));
    expect(
      await screen.findByRole("heading", { name: "Latest server title" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue("My retained draft");
    expect(screen.getByRole("button", { name: "Save book" })).toBeDisabled();
    const put = state.metadata.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(put?.[1].headers["If-Match"]).toBe(`"book-${book.id}-v1"`);
    await userEvent.click(
      screen.getByRole("button", { name: "I reviewed the latest version" }),
    );
    expect(screen.getByRole("button", { name: "Save book" })).toBeEnabled();
  });

  it("shows the server's active-loan copy constraint instead of claiming a condition change succeeded", async () => {
    state.user = principal("LIBRARIAN");
    const original = state.request.getMockImplementation()!;
    state.request.mockImplementation(async (path: string) => {
      if (path === `/copies/${copy.id}`)
        throw problem(
          409,
          "COPY_HAS_ACTIVE_LOAN",
          "This copy has an active loan.",
        );
      return original(path);
    });
    render(<BookDetailPage bookId={book.id} onNavigate={vi.fn()} />);
    await screen.findByLabelText(`Condition for ${copy.barcode}`);
    await userEvent.selectOptions(
      screen.getByLabelText(`Condition for ${copy.barcode}`),
      "MAINTENANCE",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Update condition" }),
    );
    expect(
      await screen.findByText("This copy has an active loan."),
    ).toBeVisible();
    expect(
      screen.queryByText("Copy condition updated."),
    ).not.toBeInTheDocument();
  });

  it("confirms category deletion and retains a referenced category when API rejects it", async () => {
    state.user = principal("ADMIN");
    const original = state.request.getMockImplementation()!;
    state.request.mockImplementation(
      async (path: string, options?: { method?: string }) => {
        if (options?.method === "DELETE")
          throw problem(
            409,
            "CATEGORY_IN_USE",
            "This category is referenced by books.",
          );
        return original(path);
      },
    );
    render(<CategoriesPage />);
    await screen.findByRole("button", { name: "Delete Technology" });
    await userEvent.click(
      screen.getByRole("button", { name: "Delete Technology" }),
    );
    expect(
      state.request.mock.calls.some(
        ([, options]) => options?.method === "DELETE",
      ),
    ).toBe(false);
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm delete" }),
    );
    expect(
      await screen.findByText("This category is referenced by books."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit Technology" }),
    ).toBeVisible();
  });
});
