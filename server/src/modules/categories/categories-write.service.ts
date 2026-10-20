import type { Pool } from "pg";
import type { Principal } from "../../middleware/context.js";
import { withTransaction } from "../../db/index.js";
import { AppError, forbidden } from "../../shared/errors.js";
import type { CreateCategoryInput } from "./categories.schema.js";
import {
  insertCategory,
  insertCategoryAudit,
} from "./categories-write.repository.js";

export async function createCategory(
  pool: Pool,
  actor: Principal,
  input: CreateCategoryInput,
  requestId: string,
) {
  if (actor.role !== "LIBRARIAN" && actor.role !== "ADMIN") {
    throw forbidden();
  }

  try {
    return await withTransaction(pool, async (client) => {
      const category = await insertCategory(client, input);
      await insertCategoryAudit(client, actor.id, category.id, requestId);

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        createdAt: category.createdAt.toISOString(),
      };
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AppError(
        409,
        "CATEGORY_ALREADY_EXISTS",
        "Conflict",
        "A category with this name or slug already exists.",
      );
    }
    throw error;
  }
}
