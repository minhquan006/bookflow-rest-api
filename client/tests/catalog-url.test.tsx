import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CatalogPage } from "../src/features/catalog/CatalogPage";
import {
  catalogSearch,
  readCatalogQuery,
} from "../src/features/catalog/catalogQuery";
import { navigate } from "../src/lib/navigation";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { LanguageSelector } from "../src/components/LanguageSelector";

function clientFixture(total = 30) {
  const request = vi.fn();
  request.mockImplementation(async (path: string) => {
    const url = new URL(path, "http://localhost");
    if (url.pathname === "/categories")
      return { data: [], pagination: { page: 1, totalPages: 0 } };
    const page = Number(url.searchParams.get("page"));
    const limit = Number(url.searchParams.get("limit"));
    return {
      data:
        page <= Math.ceil(total / limit)
          ? [
              {
                id: `book-${page}`,
                title: `Page ${page} book`,
                author: "Synthetic Author",
                description: "Fixture",
                archivedAt: null,
              },
            ]
          : [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
  return { request };
}

describe("Catalog URL state", () => {
  it("normalizes untrusted query input and removes staff-only archived state", () => {
    const query = readCatalogQuery(
      "?page=Infinity&limit=2&sort=sql&categoryId=bad&q=%20reader%20&includeArchived=true",
      false,
    );
    expect(query).toEqual({
      page: 1,
      limit: 12,
      sort: "title",
      categoryId: "",
      q: "reader",
      includeArchived: false,
    });
    expect(catalogSearch(query)).toBe("?page=1&limit=12&sort=title&q=reader");
  });
  it("restores applied filters/page/size from a direct URL and keeps draft out of requests", async () => {
    window.history.replaceState(
      null,
      "",
      "/books?page=2&limit=12&sort=-title&q=applied",
    );
    const client = clientFixture();
    render(<CatalogPage client={client} />);
    await screen.findByRole("heading", { name: "Page 2 book" });
    expect(screen.getByLabelText("Title or author")).toHaveValue("applied");
    expect(screen.getByLabelText("Sort by")).toHaveValue("-title");
    expect(screen.getByLabelText("Books per page")).toHaveValue("12");
    const calls = client.request.mock.calls.length;
    await userEvent.type(screen.getByLabelText("Title or author"), " draft");
    expect(client.request).toHaveBeenCalledTimes(calls);
    expect(window.location.search).toContain("q=applied");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("heading", { name: "Page 1 book" });
    expect(window.location.search).toContain("q=applied+draft");
    expect(window.location.search).toContain("page=1");
  });
  it("handles history events and resets to page one when the size changes", async () => {
    window.history.replaceState(
      null,
      "",
      "/books?page=2&limit=12&sort=title&q=first",
    );
    const client = clientFixture();
    render(<CatalogPage client={client} />);
    await screen.findByRole("heading", { name: "Page 2 book" });
    act(() => {
      window.history.replaceState(
        null,
        "",
        "/books?page=1&limit=24&sort=-title&q=history",
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await screen.findByRole("heading", { name: "Page 1 book" });
    expect(screen.getByLabelText("Title or author")).toHaveValue("history");
    expect(screen.getByLabelText("Books per page")).toHaveValue("24");
    act(() => navigate("/books?page=2&limit=12&sort=title"));
    await screen.findByRole("heading", { name: "Page 2 book" });
    await userEvent.selectOptions(
      screen.getByLabelText("Books per page"),
      "48",
    );
    await waitFor(() =>
      expect(window.location.search).toContain("page=1&limit=48"),
    );
    await screen.findByRole("heading", { name: "Page 1 book" });
  });
  it("moves an out-of-range page to the actual last page, including empty results", async () => {
    window.history.replaceState(null, "", "/books?page=99&limit=12&sort=title");
    const client = clientFixture(13);
    const view = render(<CatalogPage client={client} />);
    await screen.findByRole("heading", { name: "Page 2 book" });
    expect(window.location.search).toContain("page=2");
    view.unmount();
    act(() => navigate("/books?page=5&limit=12&sort=title"));
    render(<CatalogPage client={clientFixture(0)} />);
    await screen.findByText("No books found. Try another search or category.");
    expect(window.location.search).toContain("page=1");
  });
  it("removes archived URL/options on a role change and aborts prior work", async () => {
    window.history.replaceState(
      null,
      "",
      "/books?page=1&limit=12&sort=title&includeArchived=true",
    );
    const client = clientFixture();
    const view = render(
      <CatalogPage client={client} user={{ id: "staff", role: "ADMIN" }} />,
    );
    await screen.findByRole("heading", { name: "Page 1 book" });
    expect(screen.getByLabelText("Include archived")).toBeChecked();
    const priorOptions = client.request.mock.calls[0][1];
    view.rerender(
      <CatalogPage client={client} user={{ id: "member", role: "MEMBER" }} />,
    );
    await waitFor(() =>
      expect(window.location.search).not.toContain("includeArchived"),
    );
    expect(screen.queryByLabelText("Include archived")).not.toBeInTheDocument();
    expect(priorOptions.signal.aborted).toBe(true);
    expect(
      client.request.mock.calls
        .filter(([path]) => path.startsWith("/books"))
        .at(-1)?.[0],
    ).not.toContain("includeArchived");
  });
  it("keeps applied and draft search when switching EN/VI without new requests", async () => {
    window.history.replaceState(
      null,
      "",
      "/books?page=2&limit=12&sort=-title&q=applied",
    );
    const client = clientFixture();
    render(
      <LanguageProvider>
        <LanguageSelector />
        <CatalogPage client={client} user={{ id: "reader", role: "MEMBER" }} />
      </LanguageProvider>,
    );
    await screen.findByRole("heading", { name: "Page 2 book" });
    await userEvent.type(screen.getByLabelText("Title or author"), " draft");
    const calls = client.request.mock.calls.length;
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByLabelText("Tên sách hoặc tác giả")).toHaveValue(
      "applied draft",
    );
    expect(screen.getByLabelText("Số sách mỗi trang")).toHaveValue("12");
    await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
    expect(screen.getByLabelText("Title or author")).toHaveValue(
      "applied draft",
    );
    expect(client.request).toHaveBeenCalledTimes(calls);
    localStorage.clear();
  });
});
