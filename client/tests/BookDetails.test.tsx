import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookDetails } from "../src/features/catalog/BookDetails";

const bookId = "10000000-0000-4000-8000-000000000001";
const title = "Practical Web Foundations";

afterEach(() => vi.unstubAllGlobals());

function mockDetails(availableCopies = 2) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    if (String(input).endsWith("/availability")) {
      return Response.json({ data: { bookId, availableCopies } });
    }
    return Response.json({
      data: {
        id: bookId,
        title,
        author: "Test Author",
        description: "Book description.",
        isbn: null,
      },
    });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("Book details", () => {
  it("loads details only when opened and closes accessibly", async () => {
    const fetcher = mockDetails();
    const user = userEvent.setup();
    render(<BookDetails bookId={bookId} title={title} />);

    expect(fetcher).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: `View details for ${title}`,
      }),
    );

    expect(await screen.findByText("Book description.")).toBeInTheDocument();
    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: `Hide details for ${title}`,
      }),
    );
    expect(screen.queryByText("Book description.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `View details for ${title}`,
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("explains when no copies are available", async () => {
    mockDetails(0);
    render(<BookDetails bookId={bookId} title={title} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: `View details for ${title}`,
      }),
    );

    expect(
      await screen.findByText(
        "No copies are currently available for borrowing.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an API failure and recovers on retry", async () => {
    const fetcher = mockDetails();
    fetcher.mockResolvedValueOnce(
      Response.json(
        {
          title: "Unavailable",
          detail: "Please retry loading details.",
        },
        { status: 503 },
      ),
    );

    render(<BookDetails bookId={bookId} title={title} />);
    await userEvent.click(
      screen.getByRole("button", {
        name: `View details for ${title}`,
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please retry loading details.",
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Retry details",
      }),
    );
    expect(await screen.findByText("Book description.")).toBeInTheDocument();
  });
});
