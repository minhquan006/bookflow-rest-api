import { Router } from "express";
import { createBooksRouter } from "./modules/books/books.routes.js";
import { createCategoriesRouter } from "./modules/categories/categories.routes.js";
import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createLogger } from "./shared/logger.js";
import { createPool, hasCurrentSchema } from "./db/index.js";

const config = loadConfig();
const logger = createLogger(config);
const pool = createPool(config.databaseUrl);
pool.on("error", () =>
  logger.error({ code: "DATABASE_POOL_ERROR" }, "database pool error"),
);
const app = createApp({
  config,
  logger,
  checkReadiness: () => hasCurrentSchema(pool),
  apiRouter: Router()
    .use(createCategoriesRouter(pool))
    .use(createBooksRouter(pool)),
});
const server = app.listen(config.port, config.host, () =>
  logger.info({ host: config.host, port: config.port }, "BookFlow API started"),
);
server.on("error", (error) => {
  logger.fatal({ errorType: error.name }, "server startup failed");
  void pool.end().finally(() => process.exit(1));
});
let stopping = false;
function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  const deadline = setTimeout(() => {
    logger.error("shutdown timed out");
    process.exit(1);
  }, 10_000);
  deadline.unref();
  server.close(() => {
    void pool
      .end()
      .then(() => {
        clearTimeout(deadline);
        process.exitCode = 0;
      })
      .catch(() => {
        clearTimeout(deadline);
        process.exitCode = 1;
      });
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
