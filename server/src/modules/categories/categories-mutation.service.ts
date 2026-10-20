import type { Pool } from "pg";
import type { Principal } from "../../middleware/context.js";
import { withTransaction } from "../../db/index.js";
import { AppError, forbidden } from "../../shared/errors.js";
import type { CreateCategoryInput } from "./categories.schema.js";
import {
  replaceCategory,
  removeCategory,
  insertCategoryMutationAudit,
} from "./categories-mutation.repository.js";

function assertStaff(actor: Principal) {
  if (actor.role !== "LIBRARIAN" && actor.role !== "ADMIN") {
    throw forbidden();
  }
}

function missingCategory() {
  return new AppError(
    404,
    "RESOURCE_NOT_FOUND",
    "Not Found",
    "The requested category was not found.",
  );
}

export async function updateCategory(
  pool: Pool,
  actor: Principal,
  id: string,
  input: CreateCategoryInput,
  requestId: string,
) {
  assertStaff(actor);

  try {
    return await withTransaction(pool, async (client) => {
      const category = await replaceCategory(client, id, input);
      if (!category) throw missingCategory();

      await insertCategoryMutationAudit(
        client,
        actor.id,
        id,
        "CATEGORY_UPDATED",
        requestId,
      );

      return {
        ...category,
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

export async function deleteCategory(
  pool: Pool,
  actor: Principal,
  id: string,
  requestId: string,
) {
  assertStaff(actor);

  try {
    await withTransaction(pool, async (client) => {
      if (!(await removeCategory(client, id))) throw missingCategory();

      await insertCategoryMutationAudit(
        client,
        actor.id,
        id,
        "CATEGORY_DELETED",
        requestId,
      );
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503"
    ) {
      throw new AppError(
        409,
        "CATEGORY_IN_USE",
        "Conflict",
        "Cannot delete a category referenced by books.",
      );
    }
    throw error;
  }
}
