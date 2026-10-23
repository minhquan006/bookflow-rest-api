import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogPage } from "../src/features/catalog/CatalogPage";

const book = {
  id: "10000000-0000-4000-8000-000000000001",
  categoryId: "a610c346-8377-4351-8038-311d7fc73c2f",
  title: "Practical Web Foundations",
  author: "BookFlow Demo Team",
  description: "Synthetic local demonstration data.",
};

function collection<T>(data: T[]) {
  return {
    data,
    pagination: {
      page: 1,
      limit: 2,
      total: data.length,
      totalPages: data.length ? 1 : 0,
    },
  };
}

function mockCatalog() {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = String(input);

    if (url.includes("/categories?")) {
      return Response.json(
        collection([{ id: book.categoryId, name: "Technology" }]),
      );
    }

    if (url.includes("/books?")) {
      const query = new URL(url, "http://localhost").searchParams;
      const books = query.get("q") === "missing-book" ? [] : [book];
      return Response.json(collection(books));
    }

    throw new Error(`Unexpected request: ${url}`);
  });

  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

describe("Catalog page", () => {
  it("displays books returned by the API", async () => {
    mockCatalog();
    render(<CatalogPage />);

    expect(
      await screen.findByRole("heading", {
        name: book.title,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(book.author)).toBeInTheDocument();
    expect(screen.getByText("1 books found")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: "Category",
      }),
    ).toBeInTheDocument();
  });

  it("submits a search and shows the empty result", async () => {
    const fetcher = mockCatalog();
    const user = userEvent.setup();
    render(<CatalogPage />);

    await screen.findByRole("heading", { name: book.title });
    await user.type(
      screen.getByRole("searchbox", { name: "Title or author" }),
      "missing-book",
    );
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(
        "No books found. Try another search or category.",
      ),
    ).toBeInTheDocument();

    expect(
      fetcher.mock.calls.some(([input]) => {
        const url = new URL(String(input), "http://localhost");
        return (
          url.pathname.endsWith("/books") &&
          url.searchParams.get("q") === "missing-book" &&
          url.searchParams.get("page") === "1"
        );
      }),
    ).toBe(true);

    expect(
      screen.queryByRole("heading", {
        name: book.title,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows an API error and recovers after retry", async () => {
    const fetcher = mockCatalog();
    fetcher.mockResolvedValueOnce(
      Response.json(
        {
          title: "Service unavailable",
          detail: "Please try again.",
        },
        { status: 503 },
      ),
    );

    render(<CatalogPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again.",
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Try again",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: book.title,
      }),
    ).toBeInTheDocument();
  });

  it("aborts a pending request when unmounted", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetcher);

    const { unmount } = render(<CatalogPage />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    const signal = fetcher.mock.calls[0][1]?.signal;
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
