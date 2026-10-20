import type { Pool } from "pg";
import { offsetOf, type PaginationInput } from "../../shared/pagination.js";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

export function createCategoriesRepository(pool: Pool) {
  return {
    async list(input: PaginationInput) {
      const result = await pool.query<CategoryRow>(
        `SELECT id, name, slug, created_at AS "createdAt"
         FROM categories
         ORDER BY name ASC, id ASC
         LIMIT $1 OFFSET $2`,
        [input.limit, offsetOf(input)],
      );

      return result.rows;
    },

    async count() {
      const result = await pool.query<{ total: string }>(
        "SELECT COUNT(*) AS total FROM categories",
      );

      return Number(result.rows[0]!.total);
    },
  };
}
