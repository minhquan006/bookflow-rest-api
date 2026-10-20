import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Logger } from "pino";

export type Role = "MEMBER" | "LIBRARIAN" | "ADMIN";
export type Principal = { id: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      principal?: Principal;
    }
  }
}

export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    // Generate server-controlled IDs to avoid log/header injection and spoofed correlation.
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    const started = performance.now();
    res.on("finish", () => {
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          route: req.route?.path ?? "unmatched",
          status: res.statusCode,
          durationMs: Math.round((performance.now() - started) * 100) / 100,
          ...(req.principal ? { userId: req.principal.id } : {}),
        },
        "request completed",
      );
    });
    next();
  };
}
