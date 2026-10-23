import { createHash } from "node:crypto";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { AppError } from "../shared/errors.js";

const rateLimited = () =>
  new AppError(
    429,
    "RATE_LIMITED",
    "Too Many Requests",
    "Too many requests. Please try again later.",
  );

export function createRateLimiter(limit = 300, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(rateLimited()),
  });
}

// Memory stores are per process. A shared store is required before adding replicas.
export const createAuthRateLimiter = (limit = 10) =>
  createRateLimiter(limit, 15 * 60_000);

export function createAccountRateLimiter(limit = 10) {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator(req) {
      const email: unknown = req.body?.email;
      // Hash normalized identifiers so account-limit store keys do not contain personal data.
      return typeof email === "string" && email.trim()
        ? `account:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`
        : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
    },
    handler: (_req, _res, next) => next(rateLimited()),
  });
}

// Mount these together after JSON parsing on login; the IP limit bounds arbitrary account keys.
export const createAuthRateLimiters = (limit = 10) => [
  createAuthRateLimiter(limit),
  createAccountRateLimiter(limit),
];
