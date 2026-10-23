import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { createAuthentication } from "../../middleware/auth.js";
import { createBooksRouter } from "../books/books.routes.js";
import { createCategoriesRouter } from "../categories/categories.routes.js";
import { createCopiesRouter } from "../copies/copies.routes.js";

/** Mount the existing Catalog modules under the shared API composition root. */
export function createCatalogRouter({
  pool,
  config,
}: {
  pool: Pool;
  config: AppConfig;
}) {
  const { authenticate } = createAuthentication(config, pool);
  return Router()
    .use(createCategoriesRouter(pool, authenticate))
    .use(createBooksRouter(pool, authenticate))
    .use(createCopiesRouter(pool, authenticate));
}

export function bookETag(id: string, version: number) {
  return `"book-${id}-v${version}"`;
}
