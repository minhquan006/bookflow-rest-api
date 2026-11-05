import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "./config/env.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createUsersRouter } from "./modules/users/users.routes.js";
import { createCatalogRouter } from "./modules/catalog/catalog.routes.js";
import { createLoansRouter } from "./modules/loans/loans.routes.js";
import { createAdministrationRouter } from "./modules/administration/administration.routes.js";
import { createAuthentication } from "./middleware/auth.js";
import { createMethodGuard } from "./middleware/methods.js";
import { API_RESOURCES } from "./routes.resources.js";

export function createApiRouter(dependencies: {
  pool: Pool;
  config: AppConfig;
}) {
  const router = Router();
  router.use(
    createMethodGuard(
      API_RESOURCES,
      createAuthentication(dependencies.config, dependencies.pool).authenticate,
    ),
  );
  router.use(createAuthRouter(dependencies));
  router.use(createUsersRouter(dependencies));
  router.use(createCatalogRouter(dependencies));
  router.use(createLoansRouter(dependencies));
  router.use(createAdministrationRouter(dependencies));
  return router;
}
