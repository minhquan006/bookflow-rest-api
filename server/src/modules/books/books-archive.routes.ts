import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { requireRoles } from "../../middleware/auth.js";
import { parseInput } from "../../middleware/validation.js";
import { unauthenticated } from "../../shared/errors.js";
import { archiveBook } from "./books-archive.service.js";

const paramsSchema = z.object({ id: z.uuid() }).strict();

export function createBookArchiveRouter(
  pool: Pool,
  authenticate: RequestHandler,
) {
  const router = Router();

  router.delete(
    "/books/:id",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    async (req, res) => {
      if (!req.principal) throw unauthenticated();
      const { id } = parseInput(paramsSchema, req.params);

      const version = await archiveBook(
        pool,
        req.principal,
        id,
        req.get("if-match"),
        req.requestId,
      );

      res.set("ETag", `"book-${id}-v${version}"`).status(204).end();
    },
  );

  return router;
}
