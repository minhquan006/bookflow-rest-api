import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "./config/env.js";
import { createAuthRouter } from "./modules/auth/index.js";
import { createUsersRouter } from "./modules/users/index.js";

export function createApiRouter(dependencies: {
  pool: Pool;
  config: AppConfig;
}) {
  const router = Router();
  router.use(createAuthRouter(dependencies));
  router.use(createUsersRouter(dependencies));
  return router;
}
