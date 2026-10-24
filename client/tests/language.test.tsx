import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { LANGUAGE_STORAGE_KEY, translateText } from "../src/i18n/language";
import { LanguageSelector } from "../src/components/LanguageSelector";
import { Pagination } from "../src/components/Pagination";
import { formatLibraryDate } from "../src/features/loans/types";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: { message: "Frontend and backend are connected." },
      }),
    ),
  );
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("website language", () => {
  it("keeps English by default without writing browser storage", async () => {
    render(<App />);
    await screen.findByText("API connected");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.length).toBe(0);
  });

  it("switches navigation and messages immediately and restores the preference on remount", async () => {
    const view = render(<App />);
    await screen.findByText("API connected");
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByText("Đã kết nối API")).toBeInTheDocument();
    expect(
      screen.getByText("Giao diện đã kết nối với máy chủ."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Danh mục sách" }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("vi");
    expect(document.title).toBe("BookFlow · Thư viện");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
    view.unmount();
    render(<App />);
    expect(screen.getByLabelText("Ngôn ngữ")).toHaveValue("vi");
    await userEvent.selectOptions(screen.getByLabelText("Ngôn ngữ"), "en");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("keeps form input and translates existing validation when switching languages", async () => {
    window.history.replaceState(null, "", "/register");
    render(<App />);
    await userEvent.type(
      screen.getByLabelText("Full name"),
      "Nguyễn Minh Quân",
    );
    await userEvent.type(
      screen.getByLabelText("Email", { exact: true }),
      "invalid-email",
    );
    await userEvent.click(
      within(
        screen.getByLabelText("Confirm password").closest("form")!,
      ).getByRole("button"),
    );
    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Minh Quân");
    expect(screen.getByLabelText("Email", { exact: true })).toHaveValue(
      "invalid-email",
    );
    expect(
      screen.getByText("Vui lòng nhập địa chỉ email hợp lệ."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("translates API errors already displayed without repeating a request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            title: "Service unavailable",
            detail: "The database or required schema is not ready.",
            requestId: "trace-vi",
          },
          { status: 503 },
        ),
      ),
    );
    render(<App />);
    await screen.findByRole("alert");
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cơ sở dữ liệu chưa sẵn sàng.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Mã yêu cầu: trace-vi");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("ignores unsupported preferences and still switches when storage is blocked", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "unsupported");
    const first = render(<App />);
    await screen.findByText("API connected");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    first.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    await waitFor(() => expect(document.documentElement.lang).toBe("vi"));
    expect(screen.getByLabelText("Ngôn ngữ")).toHaveValue("vi");
  });

  it("localizes interpolated pagination without changing page values", async () => {
    const onChange = vi.fn();
    render(
      <LanguageProvider>
        <LanguageSelector />
        <Pagination page={2} totalPages={3} onPageChange={onChange} />
      </LanguageProvider>,
    );
    await userEvent.selectOptions(screen.getByLabelText("Language"), "vi");
    expect(screen.getByText("Trang 2 / 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tiếp" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("formats dates in Vietnamese while preserving Vietnam timezone and unknown error details", () => {
    const date = "2026-10-24T18:30:00Z";
    const vietnamese = formatLibraryDate(date, "vi-VN");
    expect(vietnamese).toBe(
      new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(date)),
    );
    expect(vietnamese).not.toBe(formatLibraryDate(date));
    expect(
      translateText("vi", "A member may hold at most 3 active loans."),
    ).toBe("Bạn chỉ được mượn tối đa 3 cuốn sách cùng lúc.");
    expect(translateText("vi", "Unrecognized error detail")).toBe(
      "Unrecognized error detail",
    );
    expect(
      translateText("vi", "View {title}", {
        title: "<script>{title}</script>",
      }),
    ).toBe("Xem <script>{title}</script>");
  });
});
