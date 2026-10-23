import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/lib/http";
import { loadAllCategories } from "../src/features/catalog/loadCategories";

function categoryPage(page: number, totalPages: number) {
  return new Response(
    JSON.stringify({
      data: [
        {
          id: `category-${page}`,
          name: `Category ${page}`,
          slug: `category-${page}`,
          createdAt: "2026-10-20T00:00:00Z",
        },
      ],
      pagination: { page, limit: 100, total: totalPages * 100, totalPages },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("category option pagination safety", () => {
  it("rejects a repeated page instead of looping on malformed server pagination", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => categoryPage(1, 2));
    await expect(
      loadAllCategories(createApiClient({ fetcher })),
    ).rejects.toThrow("could not be loaded safely");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("refuses an unbounded option list before requesting further pages", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => categoryPage(1, 1001));
    await expect(
      loadAllCategories(createApiClient({ fetcher })),
    ).rejects.toThrow("could not be loaded safely");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("honors an already aborted signal without starting a network request", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      loadAllCategories(createApiClient({ fetcher }), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
