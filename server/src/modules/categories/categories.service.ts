import { paginate, type PaginationInput } from "../../shared/pagination.js";
import type { createCategoriesRepository } from "./categories.repository.js";

type CategoriesRepository = ReturnType<typeof createCategoriesRepository>;

export function createCategoriesService(repository: CategoriesRepository) {
  return {
    async list(input: PaginationInput) {
      const total = await repository.count();
      const rows = await repository.list(input);

      return {
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          createdAt: row.createdAt.toISOString(),
        })),
        pagination: paginate(input, total),
      };
    },
  };
}
