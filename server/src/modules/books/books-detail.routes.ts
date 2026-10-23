import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { parseInput } from "../../middleware/validation.js";
import { createBookDetailsRepository } from "./books-detail.repository.js";
import { createBookDetailsService } from "./books-detail.service.js";

const paramsSchema = z.object({ id: z.uuid() }).strict();

function matchesETag(header: string | undefined, etag: string) {
  return (header ?? "").split(",").some((value) => {
    const tag = value.trim();
    return tag === "*" || tag.replace(/^W\//, "") === etag;
  });
}

export function createBookDetailsRouter(
  pool: Pool,
  authenticate: RequestHandler,
) {
  const router = Router();
  const service = createBookDetailsService(createBookDetailsRepository(pool));

  const optionalAuth: RequestHandler = (req, res, next) => {
    if (req.get("authorization") !== undefined) {
      return authenticate(req, res, next);
    }
    next();
  };

  router.get("/books/:id/availability", optionalAuth, async (req, res) => {
    const { id } = parseInput(paramsSchema, req.params);
    const data = await service.availability(id, req.principal);
    res.set("Cache-Control", "no-store").json({ data });
  });

  router.get("/books/:id", optionalAuth, async (req, res) => {
    const { id } = parseInput(paramsSchema, req.params);
    const data = await service.detail(id, req.principal);
    const etag = `"book-${data.id}-v${data.version}"`;

    res.set("ETag", etag);
    res.set("Cache-Control", "private, no-cache");
    res.vary("Authorization");

    if (matchesETag(req.get("if-none-match"), etag)) {
      res.status(304).end();
      return;
    }

    res.json({ data });
  });

  return router;
}
