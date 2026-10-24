import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "./config/env.js";
import { createAuthRouter } from "./modules/auth/index.js";
import { createUsersRouter } from "./modules/users/index.js";
import { createCatalogRouter } from "./modules/catalog/index.js";
import { createLoansRouter } from "./modules/loans/index.js";
import { createAdministrationRouter } from "./modules/administration/index.js";

export function createApiRouter(dependencies: {
  pool: Pool;
  config: AppConfig;
}) {
  const router = Router();
  router.use(createAuthRouter(dependencies));
  router.use(createUsersRouter(dependencies));
  router.use(createCatalogRouter(dependencies));
  router.use(createLoansRouter(dependencies));
  router.use(createAdministrationRouter(dependencies));
  return router;
}
