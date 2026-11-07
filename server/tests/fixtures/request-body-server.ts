import { Router } from "express";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config/env.js";
import { createLogger } from "../../src/shared/logger.js";

// Keep parser failures in a separate process: an uncaught decoder error must
// fail the regression without terminating the Vitest worker itself.
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/bookflow_test",
  JWT_SECRET: "body-parser-regression-signing-key-at-least-32-characters",
  LOG_LEVEL: "silent",
});
const router = Router();
router.post("/body-parser-probe", (req, res) => {
  const respond = () => res.json({ data: req.body });
  if (req.get("X-Test-Wait-For-End") && !req.complete) {
    req.once("end", respond);
    process.send?.({ event: "body-parsed" });
  } else respond();
});
const server = createApp({
  config,
  logger: createLogger(config),
  checkReadiness: async () => true,
  apiRouter: router,
}).listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string")
    process.send?.({ port: address.port });
});
process.on("SIGTERM", () => {
  server.closeAllConnections();
  server.close(() => process.exit(0));
});
