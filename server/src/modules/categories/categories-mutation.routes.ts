import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { requireRoles } from "../../middleware/auth.js";
import { parseInput } from "../../middleware/validation.js";
import { unauthenticated } from "../../shared/errors.js";
import { createCategorySchema } from "./categories.schema.js";
import {
  updateCategory,
  deleteCategory,
} from "./categories-mutation.service.js";

const paramsSchema = z.object({ id: z.uuid() }).strict();

export function createCategoryMutationRouter(
  pool: Pool,
  authenticate: RequestHandler,
) {
  const router = Router();

  router.put(
    "/categories/:id",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    async (req, res) => {
      if (!req.principal) throw unauthenticated();
      const { id } = parseInput(paramsSchema, req.params);
      const input = parseInput(createCategorySchema, req.body);

      const category = await updateCategory(
        pool,
        req.principal,
        id,
        input,
        req.requestId,
      );
      res.json({ data: category });
    },
  );

  router.delete(
    "/categories/:id",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    async (req, res) => {
      if (!req.principal) throw unauthenticated();
      const { id } = parseInput(paramsSchema, req.params);

      await deleteCategory(pool, req.principal, id, req.requestId);
      res.status(204).end();
    },
  );

  return router;
}
