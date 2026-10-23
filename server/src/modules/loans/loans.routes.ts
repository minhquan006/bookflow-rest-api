import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { createAuthentication, requireRoles } from "../../middleware/auth.js";
import {
  parseInput,
  validateBody,
  validateQuery,
} from "../../middleware/validation.js";
import {
  loanIdSchema,
  loanInputSchema,
  loanQuerySchema,
  returnInputSchema,
} from "./loans.schema.js";
import { createLoansService } from "./loans.service.js";

export function createLoansRouter({
  pool,
  config,
}: {
  pool: Pool;
  config: AppConfig;
}) {
  const router = Router();
  const { authenticate } = createAuthentication(config, pool);
  const service = createLoansService(pool, config);
  router.post(
    "/loans",
    authenticate,
    requireRoles("MEMBER"),
    validateBody(loanInputSchema),
    async (req, res) => {
      const data = await service.borrow(
        req.principal!,
        res.locals.body.bookId,
        req.requestId,
      );
      res.location(`/api/v1/loans/${data.id}`).status(201).json({ data });
    },
  );
  router.get(
    "/loans",
    authenticate,
    validateQuery(loanQuerySchema),
    async (req, res) => {
      res.json(await service.list(req.principal!, res.locals.query));
    },
  );
  router.get("/loans/:id", authenticate, async (req, res) => {
    const { id } = parseInput(loanIdSchema, req.params);
    res.json({ data: await service.get(req.principal!, id) });
  });
  router.put(
    "/loans/:id/return",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    validateBody(returnInputSchema),
    async (req, res) => {
      const { id } = parseInput(loanIdSchema, req.params);
      res.json({
        data: await service.returnLoan(req.principal!, id, req.requestId),
      });
    },
  );
  return router;
}
