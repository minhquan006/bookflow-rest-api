import { Router } from "express";
import type { Pool } from "pg";
import { parseInput } from "../../middleware/validation.js";
import { listBooksSchema } from "./books.schema.js";
import { createBooksRepository } from "./books.repository.js";
import { createBooksService } from "./books.service.js";

export function createBooksRouter(pool: Pool) {
  const router = Router();
  const service = createBooksService(createBooksRepository(pool));

  router.get("/books", async (req, res) => {
    const input = parseInput(listBooksSchema, req.query);
    res.json(await service.list(input));
  });

  return router;
}
