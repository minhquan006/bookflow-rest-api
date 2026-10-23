import { Router, type RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { requireRoles } from "../../middleware/auth.js";
import { parseInput } from "../../middleware/validation.js";
import { unauthenticated } from "../../shared/errors.js";
import { changeCopyCondition } from "./copies-update.service.js";

const paramsSchema = z.object({ id: z.uuid() }).strict();
const patchSchema = z
  .object({
    conditionStatus: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]),
  })
  .strict();

export function createCopyUpdateRouter(
  pool: Pool,
  authenticate: RequestHandler,
) {
  const router = Router();

  router.patch(
    "/copies/:id",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    async (req, res) => {
      if (!req.principal) throw unauthenticated();

      const { id } = parseInput(paramsSchema, req.params);
      const input = parseInput(patchSchema, req.body);
      const copy = await changeCopyCondition(
        pool,
        req.principal,
        id,
        input.conditionStatus,
        req.requestId,
      );

      res.json({ data: copy });
    },
  );

  return router;
}
