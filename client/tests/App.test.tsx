import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

const service = {
  data: {
    name: "BookFlow API",
    version: "v1",
    message: "Frontend and backend are connected.",
  },
};
afterEach(() => vi.unstubAllGlobals());

describe("foundation workspace", () => {
  it("shows loading until the actual API responds", async () => {
    let complete!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    render(<App />);
    expect(screen.getByText("Connecting to the API…")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh connection" }),
    ).toBeDisabled();
    complete(Response.json(service));
    expect(await screen.findByText("API connected")).toBeInTheDocument();
    expect(screen.getByText(service.data.message)).toBeInTheDocument();
  });

  it("shows a Problem Details error and lets the user retry once", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            title: "Service unavailable",
            detail: "Database is not ready.",
            requestId: "trace-42",
          },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(Response.json(service));
    vi.stubGlobal("fetch", fetcher);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database is not ready.",
    );
    expect(screen.getByText("Request ID: trace-42")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh connection" }),
    );
    expect(await screen.findByText("API connected")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps unfinished borrowing screens labeled as planned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(service)),
    );
    render(<App />);
    await screen.findByText("API connected");
    await userEvent.click(
      screen.getByRole("button", { name: "Borrowing Planned" }),
    );
    expect(
      screen.getByRole("heading", { name: "Borrowing", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Planned module")).toBeInTheDocument();
    expect(
      screen.getByText(/This area has no business features yet/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to overview" }),
    );
    expect(
      screen.getByRole("heading", { name: "BookFlow", level: 1 }),
    ).toBeInTheDocument();
  });

  it("aborts a pending connection when unmounted", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const { unmount } = render(<App />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const signal = fetcher.mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
