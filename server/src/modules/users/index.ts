import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { createAuthentication, requireRoles } from "../../middleware/auth.js";
import {
  parseInput,
  validateBody,
  validateQuery,
} from "../../middleware/validation.js";
import type { PaginationInput } from "../../shared/pagination.js";
import {
  userIdSchema,
  userListSchema,
  userPatchSchema,
  type UserPatch,
} from "./users.schema.js";
import { createUsersService } from "./users.service.js";

export function createUsersRouter({
  pool,
  config,
}: {
  pool: Pool;
  config: AppConfig;
}) {
  const router = Router();
  const { authenticate } = createAuthentication(config, pool);
  const service = createUsersService(pool);
  router.get("/users/me", authenticate, async (req, res) => {
    res.json({ data: await service.me(req.principal!.id) });
  });
  router.get(
    "/users",
    authenticate,
    requireRoles("ADMIN"),
    validateQuery(userListSchema),
    async (_req, res) => {
      res.json(await service.list(res.locals.query as PaginationInput));
    },
  );
  router.patch(
    "/users/:id",
    authenticate,
    requireRoles("ADMIN"),
    validateBody(userPatchSchema),
    async (req, res) => {
      const id = parseInput(userIdSchema, req.params.id);
      res.json({
        data: await service.patch(
          req.principal!.id,
          id,
          res.locals.body as UserPatch,
          req.requestId,
        ),
      });
    },
  );
  return router;
}
