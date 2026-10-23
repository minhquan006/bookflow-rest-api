import type { createApiClient } from "../../lib/http";
import type { Category, PaginationInfo } from "./types";

type CategoryPage = { data: Category[]; pagination: PaginationInfo };
const PAGE_SIZE = 100;
const MAX_OPTION_PAGES = 1000;

/** Fetch every option page; a malformed or unbounded response must not loop forever. */
export async function loadAllCategories(
  api: Pick<ReturnType<typeof createApiClient>, "request">,
  signal?: AbortSignal,
): Promise<Category[]> {
  const options = new Map<string, Category>();
  for (let page = 1; page <= MAX_OPTION_PAGES; page++) {
    signal?.throwIfAborted();
    const result = await api.request<CategoryPage>(
      `/categories?page=${page}&limit=${PAGE_SIZE}`,
      { signal },
    );
    signal?.throwIfAborted();
    const totalPages = result.pagination.totalPages;
    if (
      result.pagination.page !== page ||
      !Number.isSafeInteger(totalPages) ||
      totalPages < 0 ||
      totalPages > MAX_OPTION_PAGES
    ) {
      throw new Error(
        "The category option list could not be loaded safely. Please refresh the catalog.",
      );
    }
    for (const category of result.data) options.set(category.id, category);
    if (page >= totalPages) return [...options.values()];
    if (result.data.length === 0) {
      throw new Error(
        "A category option page is missing. Please refresh the catalog.",
      );
    }
  }
  throw new Error(
    "The category option list is too large. Please contact the administrator.",
  );
}
