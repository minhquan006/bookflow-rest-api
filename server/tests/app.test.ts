import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { Router } from "express";
import { z } from "zod";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/shared/logger.js";
import { validateBody, validateQuery } from "../src/middleware/validation.js";
import { paginationSchema } from "../src/shared/pagination.js";
import { requireAuth, requireRoles } from "../src/middleware/auth.js";
import { randomUUID } from "node:crypto";
import { createAccountRateLimiter } from "../src/middleware/rate-limit.js";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/bookflow_test",
  JWT_SECRET: "test-signing-secret-at-least-thirty-two-characters",
  LOG_LEVEL: "silent",
});
const logger = createLogger(config);
function app(options: Partial<Parameters<typeof createApp>[0]> = {}) {
  return createApp({
    config,
    logger,
    checkReadiness: async () => true,
    ...options,
  });
}

describe("HTTP foundation", () => {
  it("reports liveness independently of the database", async () => {
    const response = await request(
      app({
        checkReadiness: async () => {
          throw new Error("secret DB error");
        },
      }),
    ).get("/health/live");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "bookflow-api" });
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
  it("checks readiness and does not disclose database failures", async () => {
    expect((await request(app()).get("/health/ready")).body.status).toBe(
      "ready",
    );
    for (const checkReadiness of [
      async () => false,
      async () => {
        throw new Error("postgresql://user:password@host/db");
      },
    ]) {
      const response = await request(app({ checkReadiness })).get(
        "/health/ready",
      );
      expect(response.status).toBe(503);
      expect(response.body.code).toBe("SERVICE_UNAVAILABLE");
      expect(response.text).not.toContain("password");
    }
  });
  it("retains the shared API handshake", async () => {
    const response = await request(app()).get("/api/v1");
    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("BookFlow API");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
  it("serves the reviewed contract and interactive documentation", async () => {
    const application = app();
    const contract = await request(application).get("/openapi.yaml");
    expect(contract.status).toBe(200);
    expect(contract.text).toContain("openapi: 3.1.0");
    const docs = await request(application).get("/docs/");
    expect(docs.status).toBe(200);
    expect(docs.text).toContain("swagger-ui");
  });
  it("returns correlated Problem Details for unimplemented endpoints", async () => {
    const response = await request(app()).get("/api/v1/books?secret=hidden");
    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 404,
      code: "RESOURCE_NOT_FOUND",
      instance: "/api/v1/books",
      requestId: response.headers["x-request-id"],
    });
    expect(response.body).not.toHaveProperty("stack");
  });
  it("does not trust an externally supplied request ID", async () => {
    const response = await request(app())
      .get("/health/live")
      .set("X-Request-Id", "spoofed");
    expect(response.headers["x-request-id"]).not.toBe("spoofed");
  });
  it("normalizes malformed JSON before the router", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send('{"password":"secret"');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.text).not.toContain("secret");
  });
  it("rejects an oversized payload", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .send({ text: "a".repeat(110_000) });
    expect(response.status).toBe(413);
    expect(response.body.code).toBe("PAYLOAD_TOO_LARGE");
  });
  it("rejects unsupported content types", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .type("text")
      .send("hello");
    expect(response.status).toBe(415);
    expect(response.body.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
  it("rejects unsupported JSON charsets with Problem Details", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json; charset=iso-8859-1")
      .send('{"password":"secret"}');
    expect(response.status).toBe(415);
    expect(response.headers["content-type"]).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(response.text).not.toContain("secret");
  });
  it("rejects unsupported content encoding with Problem Details", async () => {
    const response = await request(app())
      .post("/api/v1/auth/register")
      .set("Content-Encoding", "madeup")
      .send({ password: "secret" });
    expect(response.status).toBe(415);
    expect(response.body.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(response.text).not.toContain("secret");
  });
  it("normalizes body-parser size mismatch without leaking raw errors", async () => {
    const router = Router();
    router.post("/size-error", () => {
      throw Object.assign(new Error("private parser input"), {
        type: "request.size.invalid",
        status: 400,
      });
    });
    const response = await request(app({ apiRouter: router }))
      .post("/api/v1/size-error")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.text).not.toContain("private parser input");
  });
  it("allows only explicitly configured cross-origin requests", async () => {
    const application = app();
    const allowed = await request(application)
      .get("/api/v1")
      .set("Origin", "http://localhost:5173");
    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
    const denied = await request(application)
      .get("/api/v1")
      .set("Origin", "https://untrusted.example");
    expect(denied.status).toBe(403);
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
  it("answers allowed CORS preflights", async () => {
    const response = await request(app())
      .options("/api/v1/books")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });
  it("enforces rate limits while keeping liveness available", async () => {
    const application = app({ rateLimit: 1 });
    expect((await request(application).get("/api/v1")).status).toBe(200);
    const limited = await request(application).get("/api/v1");
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeDefined();
    expect((await request(application).get("/health/live")).status).toBe(200);
  });
  it("ignores forwarded addresses from direct clients when no proxy is trusted", async () => {
    const router = Router();
    router.get("/source", (req, res) => res.json({ ip: req.ip }));
    const application = app({ rateLimit: 1, apiRouter: router });
    // express-rate-limit correctly warns about the unexpected header; assert the safe behavior too.
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const first = await request(application)
        .get("/api/v1/source")
        .set("X-Forwarded-For", "198.51.100.10");
      expect(first.status).toBe(200);
      expect(first.body.ip).not.toBe("198.51.100.10");
      expect(
        (
          await request(application)
            .get("/api/v1/source")
            .set("X-Forwarded-For", "198.51.100.11")
        ).status,
      ).toBe(429);
    } finally {
      diagnostic.mockRestore();
    }
  });
  it("limits proxy-forwarded client addresses independently when exactly one hop is trusted", async () => {
    const router = Router();
    router.get("/source", (req, res) => res.json({ ip: req.ip }));
    const application = app({
      config: { ...config, trustProxyHops: 1 },
      rateLimit: 1,
      apiRouter: router,
    });
    const first = await request(application)
      .get("/api/v1/source")
      .set("X-Forwarded-For", "198.51.100.10");
    const second = await request(application)
      .get("/api/v1/source")
      .set("X-Forwarded-For", "198.51.100.11");
    expect(first.status).toBe(200);
    expect(first.body.ip).toBe("198.51.100.10");
    expect(second.status).toBe(200);
    expect(second.body.ip).toBe("198.51.100.11");
    expect(
      (
        await request(application)
          .get("/api/v1/source")
          .set("X-Forwarded-For", "192.0.2.99, 198.51.100.10")
      ).status,
    ).toBe(429);
  });
  it("limits login attempts against the same normalized account", async () => {
    const router = Router();
    router.post("/login-example", createAccountRateLimiter(1), (_req, res) =>
      res.json({ status: "ok" }),
    );
    const application = app({ apiRouter: router });
    expect(
      (
        await request(application)
          .post("/api/v1/login-example")
          .send({ email: "Member@bookflow.test" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(application)
          .post("/api/v1/login-example")
          .send({ email: " member@bookflow.test " })
      ).status,
    ).toBe(429);
    expect(
      (
        await request(application)
          .post("/api/v1/login-example")
          .send({ email: "other@bookflow.test" })
      ).status,
    ).toBe(200);
  });
  it("composes strict schema validation with feature routers", async () => {
    const router = Router();
    router.post(
      "/example",
      validateBody(z.strictObject({ title: z.string().min(1) })),
      (_req, res) => res.status(201).json({ data: res.locals.body }),
    );
    router.get("/example", validateQuery(paginationSchema), (_req, res) =>
      res.json(res.locals.query),
    );
    const application = app({ apiRouter: router });
    expect(
      (
        await request(application)
          .post("/api/v1/example")
          .send({ title: "Book" })
      ).status,
    ).toBe(201);
    const invalid = await request(application)
      .post("/api/v1/example")
      .send({ title: "Book", role: "ADMIN" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors).toHaveLength(1);
    expect(
      (await request(application).get("/api/v1/example?page=2&limit=4")).body,
    ).toEqual({ page: 2, limit: 4 });
    expect(
      (await request(application).get("/api/v1/example?limit=101")).status,
    ).toBe(400);
  });
  it("conceals internal errors", async () => {
    const router = Router();
    router.get("/fail", () => {
      throw new Error("SELECT password_hash FROM users; secret-token");
    });
    const response = await request(app({ apiRouter: router })).get(
      "/api/v1/fail",
    );
    expect(response.status).toBe(500);
    expect(response.body.code).toBe("INTERNAL_ERROR");
    expect(response.text).not.toContain("password_hash");
  });
});

describe("authentication and role middleware", () => {
  const id = randomUUID();
  function secured(
    options: {
      role?: "MEMBER" | "LIBRARIAN" | "ADMIN";
      status?: "ACTIVE" | "DISABLED";
      missing?: boolean;
      failDb?: boolean;
    } = {},
  ) {
    const router = Router();
    router.get(
      "/staff",
      requireAuth({
        verifyAccessToken: async (token) => {
          if (token !== "valid") throw new Error("invalid");
          return id;
        },
        findUser: async () => {
          if (options.failDb) throw new Error("DB unavailable");
          return options.missing
            ? null
            : {
                id,
                role: options.role ?? "LIBRARIAN",
                status: options.status ?? "ACTIVE",
              };
        },
      }),
      requireRoles("LIBRARIAN", "ADMIN"),
      (req, res) => res.json({ data: req.principal }),
    );
    return app({ apiRouter: router });
  }
  it("requires a bearer token and includes the authentication challenge", async () => {
    const response = await request(secured()).get("/api/v1/staff");
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(
      (
        await request(secured())
          .get("/api/v1/staff")
          .auth("bad", { type: "bearer" })
      ).status,
    ).toBe(401);
  });
  it("reads live user status and role instead of trusting role claims", async () => {
    expect(
      (
        await request(secured())
          .get("/api/v1/staff")
          .auth("valid", { type: "bearer" })
      ).body.data,
    ).toEqual({ id, role: "LIBRARIAN" });
    expect(
      (
        await request(secured({ role: "MEMBER" }))
          .get("/api/v1/staff")
          .auth("valid", { type: "bearer" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(secured({ status: "DISABLED" }))
          .get("/api/v1/staff")
          .auth("valid", { type: "bearer" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(secured({ missing: true }))
          .get("/api/v1/staff")
          .auth("valid", { type: "bearer" })
      ).status,
    ).toBe(401);
  });
  it("does not disguise database failure as a bad token", async () => {
    expect(
      (
        await request(secured({ failDb: true }))
          .get("/api/v1/staff")
          .auth("valid", { type: "bearer" })
      ).status,
    ).toBe(500);
  });
});

describe("operational dependency failures", () => {
  it.each(["ECONNREFUSED", "ETIMEDOUT", "57P01", "53300"])(
    "returns safe 503 for %s",
    async (code) => {
      const router = Router();
      router.get("/dependency", () => {
        throw Object.assign(
          new Error("postgresql://private:credential@database/internal"),
          { code },
        );
      });
      const response = await request(app({ apiRouter: router })).get(
        "/api/v1/dependency",
      );
      expect(response.status).toBe(503);
      expect(response.body.code).toBe("SERVICE_UNAVAILABLE");
      expect(JSON.stringify(response.body)).not.toContain("credential");
      expect(response.body.requestId).toBeTruthy();
    },
  );
  it("keeps SQL programming failures as 500", async () => {
    const router = Router();
    router.get("/dependency", () => {
      throw Object.assign(new Error("query failure"), { code: "42601" });
    });
    const response = await request(app({ apiRouter: router })).get(
      "/api/v1/dependency",
    );
    expect(response.status).toBe(500);
    expect(response.body.code).toBe("INTERNAL_ERROR");
  });
});
