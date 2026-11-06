import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../src/App";

const reader = {
  id: "10000000-0000-4000-8000-000000000001",
  fullName: "Review Reader",
  email: "review@example.test",
  role: "MEMBER",
  status: "ACTIVE",
  createdAt: "2026-10-20T00:00:00Z",
};
const category = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Technology",
  slug: "technology",
  createdAt: reader.createdAt,
};
const book = {
  id: "30000000-0000-4000-8000-000000000001",
  categoryId: category.id,
  title: "Review Book",
  author: "Review Author",
  description: "Synthetic review fixture",
  isbn: null,
  archivedAt: null,
  version: 1,
};
const session = (role = "MEMBER") => ({
  accessToken: "review-access-token",
  tokenType: "Bearer",
  expiresIn: 900,
  csrfToken: "csrf-a",
  user: { ...reader, role },
});
const pageOf = (data: unknown[], limit = 20) => ({
  data,
  pagination: {
    page: 1,
    limit,
    total: data.length,
    totalPages: data.length ? 1 : 0,
  },
});
function installAppApi(role = "MEMBER") {
  document.cookie = "bookflow_csrf=csrf-a; Path=/";
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname.endsWith("/auth/refresh"))
        return Response.json({ data: session(role) });
      if (url.pathname === `/api/v1/books/${book.id}`)
        return Response.json(
          { data: book },
          { headers: { ETag: `"book-${book.id}-v1"` } },
        );
      if (url.pathname.endsWith("/availability"))
        return Response.json({ data: { bookId: book.id, availableCopies: 1 } });
      if (url.pathname.endsWith("/copies")) return Response.json(pageOf([]));
      if (url.pathname === "/api/v1/categories")
        return Response.json(pageOf([category], 100));
      if (url.pathname === "/api/v1/books")
        return Response.json({
          data: [book],
          pagination: {
            page: Number(url.searchParams.get("page") ?? 1),
            limit: 2,
            total: 6,
            totalPages: 3,
          },
        });
      return Response.json({
        data: { message: "Frontend and backend are connected." },
      });
    }),
  );
}
beforeEach(() => {
  localStorage.clear();
  document.cookie = "bookflow_csrf=; Max-Age=0; Path=/";
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  document.cookie = "bookflow_csrf=; Max-Age=0; Path=/";
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves a signed-in member's catalog filter when changing language", async () => {
  installAppApi();
  window.history.replaceState(null, "", "/books");
  render(<App />);
  await screen.findByRole("button", { name: reader.fullName });
  await screen.findByRole("heading", { name: book.title });
  await userEvent.type(screen.getByLabelText("Title or author"), "Practical");
  await userEvent.selectOptions(screen.getByLabelText("Category"), category.id);
  await userEvent.selectOptions(screen.getByLabelText("Sort by"), "-title");
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await userEvent.click(await screen.findByRole("button", { name: "Next" }));
  await screen.findByText("Page 2 of 3");
  const callsBefore = vi.mocked(fetch).mock.calls.length;
  await screen.findByRole("heading", { name: book.title });
  await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
  expect(screen.getByLabelText("Tên sách hoặc tác giả")).toHaveValue(
    "Practical",
  );
  expect(screen.getByLabelText("Thể loại")).toHaveValue(category.id);
  expect(screen.getByLabelText("Sắp xếp theo")).toHaveValue("-title");
  expect(screen.getByText("Trang 2 / 3")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
  expect(screen.getByLabelText("Title or author")).toHaveValue("Practical");
  expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls).toHaveLength(callsBefore);
  const last = vi
    .mocked(fetch)
    .mock.calls.filter(([input]) => String(input).includes("/books?"))
    .at(-1)!;
  expect(
    new URL(String(last[0]), "http://localhost").searchParams.toString(),
  ).toContain("page=2");
});

it("preserves a librarian's unsaved book draft when changing language", async () => {
  installAppApi("LIBRARIAN");
  window.history.replaceState(null, "", `/books/${book.id}`);
  render(<App />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Edit metadata" }),
  );
  await userEvent.clear(screen.getByLabelText("Title", { exact: true }));
  await userEvent.type(
    screen.getByLabelText("Title", { exact: true }),
    "Unsaved title",
  );
  await userEvent.type(
    screen.getByLabelText("New copy barcode"),
    "DRAFT-BARCODE",
  );
  const callsBefore = vi.mocked(fetch).mock.calls.length;
  await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
  await screen.findByRole("heading", { name: book.title });
  expect(screen.queryByLabelText("Tên sách", { exact: true })).toHaveValue(
    "Unsaved title",
  );
  expect(screen.getByLabelText("Mã vạch bản sách mới")).toHaveValue(
    "DRAFT-BARCODE",
  );
  await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
  expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
    "Unsaved title",
  );
  expect(screen.getByLabelText("New copy barcode")).toHaveValue(
    "DRAFT-BARCODE",
  );
  expect(vi.mocked(fetch).mock.calls).toHaveLength(callsBefore);
});

it("preserves the complete unsaved create form through EN–VI–EN without submitting", async () => {
  installAppApi("LIBRARIAN");
  window.history.replaceState(null, "", "/books");
  render(<App />);
  await screen.findByRole("heading", { name: book.title });
  await userEvent.click(screen.getByRole("button", { name: "Add book" }));
  await userEvent.type(
    screen.getByLabelText("Title", { exact: true }),
    "Draft title",
  );
  await userEvent.type(
    screen.getByLabelText("Author", { exact: true }),
    "Draft author",
  );
  await userEvent.type(
    screen.getByLabelText("Description"),
    "Draft description",
  );
  const before = vi.mocked(fetch).mock.calls.length;
  await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
  expect(screen.getByLabelText("Tên sách", { exact: true })).toHaveValue(
    "Draft title",
  );
  await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
  expect(screen.getByLabelText("Title", { exact: true })).toHaveValue(
    "Draft title",
  );
  expect(screen.getByLabelText("Author", { exact: true })).toHaveValue(
    "Draft author",
  );
  expect(screen.getByLabelText("Description")).toHaveValue("Draft description");
  expect(screen.getByRole("form", { name: "Create book" })).toBeInTheDocument();
  await waitFor(() => expect(vi.mocked(fetch).mock.calls).toHaveLength(before));
});

it("keeps credentials typed while an existing cookie session is still restoring", async () => {
  installAppApi();
  const original = vi.mocked(fetch).getMockImplementation()!;
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (String(input).endsWith("/auth/refresh"))
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    return original(input, init);
  });
  window.history.replaceState(null, "", "/login");
  render(<App />);
  await userEvent.type(screen.getByLabelText("Email"), "next@example.test");
  await userEvent.type(screen.getByLabelText("Password"), "typed-password");
  await act(async () => finish(Response.json({ data: session() })));
  await screen.findByRole("button", { name: reader.fullName });
  expect(screen.getByLabelText("Email")).toHaveValue("next@example.test");
  expect(screen.getByLabelText("Password")).toHaveValue("typed-password");
});
