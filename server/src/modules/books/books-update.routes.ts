import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { requireRoles } from "../../middleware/auth.js";
import { parseInput } from "../../middleware/validation.js";
import { unauthenticated } from "../../shared/errors.js";
import { createBookSchema } from "./books-write.schema.js";
import { changeBookMetadata } from "./books-update.service.js";

const paramsSchema = z.object({ id: z.uuid() }).strict();
const patchSchema = createBookSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one metadata field is required.",
  });

export function createBookUpdateRouter(
  pool: Pool,
  authenticate: RequestHandler,
) {
  const router = Router();

  const update: RequestHandler = async (req, res) => {
    if (!req.principal) throw unauthenticated();

    const { id } = parseInput(paramsSchema, req.params);
    const input =
      req.method === "PUT"
        ? parseInput(createBookSchema, req.body)
        : parseInput(patchSchema, req.body);

    const book = await changeBookMetadata(
      pool,
      req.principal,
      id,
      input,
      req.get("if-match"),
      req.requestId,
    );

    res.set("ETag", `"book-${book.id}-v${book.version}"`).json({ data: book });
  };

  router.put(
    "/books/:id",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    update,
  );

  router.patch(
    "/books/:id",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    update,
  );

  return router;
}
