import { Router } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { validateBody } from "../../middleware/validation.js";
import { createAuthRateLimiters } from "../../middleware/rate-limit.js";
import {
  clearSessionCookies,
  setSessionCookies,
  verifySessionRequest,
} from "./auth.cookies.js";
import {
  emptyAuthBodySchema,
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "./auth.schema.js";
import { createAuthService } from "./auth.service.js";
import { AppError } from "../../shared/errors.js";

export function createAuthRouter({
  pool,
  config,
}: {
  pool: Pool;
  config: AppConfig;
}) {
  const router = Router();
  const service = createAuthService(pool, config);
  router.post(
    "/auth/register",
    ...createAuthRateLimiters(),
    validateBody(registerSchema),
    async (req, res) => {
      const user = await service.register(
        res.locals.body as RegisterInput,
        req.requestId,
      );
      res.location("/api/v1/users/me").status(201).json({ data: user });
    },
  );
  router.post(
    "/auth/login",
    ...createAuthRateLimiters(),
    validateBody(loginSchema),
    async (req, res) => {
      const result = await service.login(
        res.locals.body as LoginInput,
        req.requestId,
      );
      setSessionCookies(config, res, result.rawToken, result.data.csrfToken);
      res.json({ data: result.data });
    },
  );
  router.post(
    "/auth/refresh",
    validateBody(emptyAuthBodySchema),
    async (req, res) => {
      const input = verifySessionRequest(config, req);
      try {
        const result = await service.refresh(
          input.rawToken,
          input.csrfToken,
          req.requestId,
        );
        setSessionCookies(config, res, result.rawToken, result.data.csrfToken);
        res.json({ data: result.data });
      } catch (error) {
        if (error instanceof AppError && error.status === 401)
          clearSessionCookies(config, res);
        throw error;
      }
    },
  );
  router.post(
    "/auth/logout",
    validateBody(emptyAuthBodySchema),
    async (req, res) => {
      const input = verifySessionRequest(config, req);
      await service.logout(input.rawToken, input.csrfToken, req.requestId);
      clearSessionCookies(config, res);
      res.status(204).end();
    },
  );
  return router;
}
