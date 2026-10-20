import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { requireRoles } from "../../middleware/auth.js";
import { parseInput } from "../../middleware/validation.js";
import { paginationSchema } from "../../shared/pagination.js";
import { unauthenticated } from "../../shared/errors.js";
import { createCopiesService } from "./copies.service.js";

const paramsSchema = z.object({ id: z.uuid() }).strict();
const inputSchema = z
  .object({
    barcode: z.string().trim().min(1).max(64),
  })
  .strict();

export function createCopiesRouter(pool: Pool, authenticate: RequestHandler) {
  const router = Router();
  const service = createCopiesService(pool);
  const staff = requireRoles("LIBRARIAN", "ADMIN");

  router.get("/books/:id/copies", authenticate, staff, async (req, res) => {
    if (!req.principal) throw unauthenticated();
    const { id } = parseInput(paramsSchema, req.params);
    const input = parseInput(paginationSchema.strict(), req.query);
    res.json(await service.list(req.principal, id, input));
  });

  router.post("/books/:id/copies", authenticate, staff, async (req, res) => {
    if (!req.principal) throw unauthenticated();
    const { id } = parseInput(paramsSchema, req.params);
    const input = parseInput(inputSchema, req.body);
    const copy = await service.create(
      req.principal,
      id,
      input.barcode,
      req.requestId,
    );

    res.location(`/api/v1/copies/${copy.id}`).status(201).json({ data: copy });
  });

  return router;
}
