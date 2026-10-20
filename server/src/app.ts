import express from "express";
import type { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import type { Logger } from "pino";
import type { AppConfig } from "./config/env.js";
import { AppError } from "./shared/errors.js";
import { requestContext } from "./middleware/context.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRateLimiter } from "./middleware/rate-limit.js";

export type AppDependencies = {
  config: AppConfig;
  logger: Logger;
  checkReadiness: () => Promise<boolean>;
  rateLimit?: number;
  apiRouter?: Router;
};

export function createApp({
  config,
  logger,
  checkReadiness,
  rateLimit,
  apiRouter,
}: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  // Enable one hop only when the API is reachable exclusively through a trusted proxy.
  app.set("trust proxy", config.trustProxyHops === 0 ? false : 1);
  app.use(requestContext(logger));
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin))
          callback(null, true);
        else
          callback(
            new AppError(
              403,
              "ORIGIN_NOT_ALLOWED",
              "Forbidden",
              "This origin is not allowed.",
            ),
          );
      },
      credentials: true,
      exposedHeaders: ["X-Request-Id", "ETag", "Location"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "If-Match",
        "If-None-Match",
        "X-CSRF-Token",
      ],
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.get("/health/live", (_req, res) => {
    res.json({ status: "ok", service: "bookflow-api" });
  });
  app.get("/health/ready", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let ready = false;
    try {
      ready = await checkReadiness();
    } catch {
      /* Dependency failure is reflected without leaking connection details. */
    }
    if (!ready)
      throw new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "Service Unavailable",
        "The database or required schema is not ready.",
      );
    res.json({ status: "ready", service: "bookflow-api" });
  });

  const contractPath = fileURLToPath(
    new URL("../../docs/openapi.yaml", import.meta.url),
  );
  app.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").sendFile(contractPath);
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: "/openapi.yaml" },
      customSiteTitle: "BookFlow API",
    }),
  );

  app.use("/api", createRateLimiter(rateLimit));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, _res, next) => {
    if (
      ["POST", "PUT", "PATCH"].includes(req.method) &&
      (req.get("transfer-encoding") || Number(req.get("content-length")) > 0) &&
      !req.is("application/json")
    ) {
      throw new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Unsupported Media Type",
        "Send request bodies using Content-Type: application/json.",
      );
    }
    next();
  });
  app.use(express.json({ limit: "100kb", strict: true }));
  app.get("/api/v1", (_req, res) => {
    res.json({
      data: {
        name: "BookFlow API",
        version: "v1",
        message: "Frontend and backend are connected.",
      },
    });
  });
  // Pass the composed feature router from the application entry point.
  if (apiRouter) app.use("/api/v1", apiRouter);
  app.use((_req, _res) => {
    throw new AppError(
      404,
      "RESOURCE_NOT_FOUND",
      "Not Found",
      "The requested endpoint does not exist.",
    );
  });
  app.use(errorHandler(logger));
  return app;
}
