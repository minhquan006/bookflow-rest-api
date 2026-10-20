import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { parseInput } from "../../middleware/validation.js";
import { requireRoles } from "../../middleware/auth.js";
import { unauthenticated } from "../../shared/errors.js";
import { paginationSchema } from "../../shared/pagination.js";
import { createCategoriesRepository } from "./categories.repository.js";
import { createCategoriesService } from "./categories.service.js";
import { createCategorySchema } from "./categories.schema.js";
import { createCategory } from "./categories-write.service.js";

export function createCategoriesRouter(
  pool: Pool,
  authenticate: RequestHandler,
) {
  const router = Router();
  const repository = createCategoriesRepository(pool);
  const service = createCategoriesService(repository);

  router.get("/categories", async (req, res) => {
    const input = parseInput(paginationSchema.strict(), req.query);
    res.json(await service.list(input));
  });

  router.post(
    "/categories",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    async (req, res) => {
      if (!req.principal) throw unauthenticated();

      const input = parseInput(createCategorySchema, req.body);
      const category = await createCategory(
        pool,
        req.principal,
        input,
        req.requestId,
      );

      res
        .location(`/api/v1/categories/${category.id}`)
        .status(201)
        .json({ data: category });
    },
  );

  return router;
}
