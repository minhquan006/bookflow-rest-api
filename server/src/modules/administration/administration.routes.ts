import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { createAuthentication, requireRoles } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validation.js";
import { auditQuerySchema } from "./administration.schema.js";
import { createAdministrationService } from "./administration.service.js";

export function createAdministrationRouter({
  pool,
  config,
}: {
  pool: Pool;
  config: AppConfig;
}) {
  const router = Router();
  const { authenticate } = createAuthentication(config, pool);
  const service = createAdministrationService(pool);
  router.get(
    "/dashboard",
    authenticate,
    requireRoles("LIBRARIAN", "ADMIN"),
    async (_req, res) => {
      res.json({ data: await service.dashboard() });
    },
  );
  router.get(
    "/audit-logs",
    authenticate,
    requireRoles("ADMIN"),
    validateQuery(auditQuerySchema),
    async (_req, res) => {
      res.json(await service.auditLogs(res.locals.query));
    },
  );
  return router;
}
