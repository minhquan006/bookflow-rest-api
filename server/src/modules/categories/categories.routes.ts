import { Router } from "express";
import type { Pool } from "pg";
import { parseInput } from "../../middleware/validation.js";
import { paginationSchema } from "../../shared/pagination.js";
import { createCategoriesRepository } from "./categories.repository.js";
import { createCategoriesService } from "./categories.service.js";

export function createCategoriesRouter(pool: Pool) {
  const router = Router();
  const repository = createCategoriesRepository(pool);
  const service = createCategoriesService(repository);

  router.get("/categories", async (req, res) => {
    const input = parseInput(paginationSchema.strict(), req.query);
    const result = await service.list(input);
    res.json(result);
  });

  return router;
}
