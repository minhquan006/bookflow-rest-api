export const CATALOG_PAGE_SIZES = [12, 24, 48] as const;
const sorts = ["title", "-title", "createdAt", "-createdAt"] as const;
export type CatalogFilters = {
  q: string;
  categoryId: string;
  sort: string;
  includeArchived: boolean;
};
export type CatalogQuery = CatalogFilters & { page: number; limit: number };

export function readCatalogQuery(search: string, staff: boolean): CatalogQuery {
  const params = new URLSearchParams(search);
  const rawPage = params.get("page") ?? "1";
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const limit = Number(params.get("limit") ?? 12);
  const category = params.get("categoryId") ?? "";
  const sort = params.get("sort") ?? "title";
  return {
    q: (params.get("q") ?? "").trim().slice(0, 200),
    categoryId:
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        category,
      )
        ? category
        : "",
    sort: sorts.includes(sort as (typeof sorts)[number]) ? sort : "title",
    includeArchived: staff && params.get("includeArchived") === "true",
    page:
      Number.isSafeInteger(page) && page > 0 && page <= 1_000_000 ? page : 1,
    limit: CATALOG_PAGE_SIZES.includes(
      limit as (typeof CATALOG_PAGE_SIZES)[number],
    )
      ? limit
      : 12,
  };
}
export function catalogSearch(query: CatalogQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    sort: query.sort,
  });
  if (query.q) params.set("q", query.q);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.includeArchived) params.set("includeArchived", "true");
  return `?${params}`;
}
export function catalogHref(query: CatalogQuery) {
  return `/books${catalogSearch(query)}`;
}
