import { createBookDetailsRouter } from "./books-detail.routes.js";
import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { parseInput } from "../../middleware/validation.js";
import { requireRoles } from "../../middleware/auth.js";
import { unauthenticated } from "../../shared/errors.js";
import { listBooksSchema } from "./books.schema.js";
import { createBooksRepository } from "./books.repository.js";
import { createBooksService } from "./books.service.js";
import { createBookSchema } from "./books-write.schema.js";
import { createBook } from "./books-write.service.js";

export function createBooksRouter(pool: Pool, authenticate: RequestHandler) {
  const router = Router();
  router.use(createBookDetailsRouter(pool, authenticate));
  const service = createBooksService(createBooksRepository(pool));

  router.get("/books", async (req, res) => {
    const input = parseInput(listBooksSchema, req.query);
    res.json(await service.list(input));
  });

  router.post(
    "/books",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    async (req, res) => {
      if (!req.principal) throw unauthenticated();

      const input = parseInput(createBookSchema, req.body);
      const book = await createBook(pool, req.principal, input, req.requestId);

      res
        .location(`/api/v1/books/${book.id}`)
        .set("ETag", `"book-${book.id}-v${book.version}"`)
        .status(201)
        .json({ data: book });
    },
  );

  return router;
}
