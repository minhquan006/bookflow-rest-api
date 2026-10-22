import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import type { AppConfig } from "../../config/env.js";
import { createAuthentication } from "../../middleware/auth.js";
import {
  createAuthRateLimiter,
  createAuthRateLimiters,
} from "../../middleware/rate-limit.js";
import { parseInput } from "../../middleware/validation.js";
import { createAuthService } from "./service.js";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const registerInput = z.strictObject({
  fullName: z.string().trim().min(1).max(120),
  email,
  password: z.string().min(12).max(128),
});
const loginInput = z.strictObject({
  email,
  password: z.string().min(1).max(128),
});

export function createAuthRouter(config: AppConfig, pool: Pool) {
  const router = Router();
  const service = createAuthService(config, pool);
  const { authenticate } = createAuthentication(config, pool);
  router.post("/auth/register", createAuthRateLimiter(), async (req, res) => {
    const user = await service.register(
      parseInput(registerInput, req.body),
      req.requestId,
    );
    res.location("/api/v1/users/me").status(201).json({ data: user });
  });
  router.post("/auth/login", ...createAuthRateLimiters(), async (req, res) => {
    const session = await service.login(
      parseInput(loginInput, req.body),
      req.requestId,
    );
    const options = {
      sameSite: "strict" as const,
      secure: req.secure || config.nodeEnv === "production",
      maxAge: config.refreshTokenTtlDays * 86_400_000,
    };
    res.cookie("bookflow_refresh", session.refreshToken, {
      ...options,
      httpOnly: true,
      path: "/api/v1/auth",
    });
    res.cookie("bookflow_csrf", session.data.csrfToken, {
      ...options,
      httpOnly: false,
      path: "/",
    });
    res.json({ data: session.data });
  });
  router.get("/users/me", authenticate, async (req, res) => {
    res.json({ data: await service.me(req.principal!.id) });
  });
  return router;
}
