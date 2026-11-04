import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import type { Pool } from "pg";
import { createApp } from "../src/app.js";
import { createApiRouter } from "../src/routes.js";
import {
  API_RESOURCES,
  FOUNDATION_RESOURCES,
} from "../src/routes.resources.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/shared/logger.js";
import { createAccessTokens } from "../src/shared/tokens.js";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/bookflow_test",
  JWT_SECRET: "method-test-secret-at-least-thirty-two-characters",
  LOG_LEVEL: "silent",
});
const id = randomUUID();
function application(role = "ADMIN", status = "ACTIVE") {
  const pool = {
    query: async (sql: string) => {
      if (sql !== "SELECT id, role, status FROM users WHERE id = $1")
        throw new Error("Unexpected business query");
      return { rows: [{ id, role, status }] };
    },
  } as unknown as Pool;
  return createApp({
    config,
    logger: createLogger(config),
    checkReadiness: async () => true,
    apiRouter: createApiRouter({ pool, config }),
  });
}
const token = () => createAccessTokens(config).sign(id);

describe("method negotiation on the composed application", () => {
  it.each([
    ...FOUNDATION_RESOURCES,
    ...API_RESOURCES.map((resource) => ({
      ...resource,
      path: `/api/v1${resource.path}`,
    })),
  ])("returns correlated 405 and exact Allow on $path", async (resource) => {
    const path = resource.path.replace(/:id/g, id);
    const response = await request(application())
      .trace(`${path}?secret=hidden`)
      .auth(await token(), { type: "bearer" });
    const methods = resource.methods.flatMap((method) =>
      method === "GET" ? ["GET", "HEAD"] : [method],
    );
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe([...methods, "OPTIONS"].join(", "));
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.body).toMatchObject({
      status: 405,
      code: "METHOD_NOT_ALLOWED",
      instance: path,
      requestId: response.headers["x-request-id"],
    });
    expect(response.text).not.toContain("hidden");
  });
  it("requires live authentication and resource role before advertising protected methods", async () => {
    expect(
      (await request(application()).delete("/api/v1/dashboard")).status,
    ).toBe(401);
    const bearer = await token();
    for (const path of [
      "/dashboard",
      "/audit-logs",
      "/loans/example/return",
      "/books/example/copies",
      "/copies/example",
    ]) {
      const denied = await request(application("MEMBER"))
        .trace(`/api/v1${path}`)
        .auth(bearer, { type: "bearer" });
      expect(denied.status).toBe(403);
      expect(denied.headers.allow).toBeUndefined();
    }
    expect(
      (
        await request(application("ADMIN", "DISABLED"))
          .delete("/api/v1/dashboard")
          .auth(bearer, { type: "bearer" })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(application("MEMBER"))
          .delete("/api/v1/loans/example")
          .auth(bearer, { type: "bearer" })
      ).status,
    ).toBe(405);
  });
  it("prioritizes users/me over the dynamic admin route", async () => {
    const response = await request(application("MEMBER"))
      .patch("/api/v1/users/me")
      .auth(await token(), { type: "bearer" })
      .send({ role: "ADMIN" });
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("GET, HEAD, OPTIONS");
  });
  it("retains 404 for unknown paths and longer unmatched subpaths", async () => {
    for (const path of [
      "/api/v1/unknown",
      "/api/v1/books/example/unknown",
      "/health/live/extra",
      "/docs/not-a-resource",
      "/api/v2/books",
    ]) {
      const response = await request(application()).delete(path);
      expect(response.status).toBe(404);
      expect(response.headers.allow).toBeUndefined();
    }
  });
  it.each([
    "/docs/not-a-resource/swagger-ui-init.js",
    "/docs/a/b/swagger-ui-init.js",
  ])(
    "does not serve Swagger initialization from an unknown nested path %s",
    async (path) => {
      const response = await request(application()).get(`${path}?cache=1`);
      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toContain(
        "application/problem+json",
      );
      expect(response.body.code).toBe("RESOURCE_NOT_FOUND");
    },
  );
  it("serves real Swagger assets and restricts initialization to GET/HEAD", async () => {
    const app = application();
    for (const asset of [
      "swagger-ui.css",
      "swagger-ui-bundle.js",
      "swagger-ui-standalone-preset.js",
      "favicon-32x32.png",
    ]) {
      expect((await request(app).get(`/docs/${asset}`)).status).toBe(200);
    }
    const init = await request(app).get("/docs/swagger-ui-init.js?cache=1");
    expect(init.status).toBe(200);
    expect(init.headers["content-type"]).toContain("javascript");
    expect(init.text).toContain("/openapi.yaml");
    const head = await request(app).head("/docs/swagger-ui-init.js");
    expect(head.status).toBe(200);
    expect(head.text).toBeUndefined();
    const unsupported = await request(app).post("/docs/swagger-ui-init.js");
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.allow).toBe("GET, HEAD, OPTIONS");
    expect(unsupported.body.code).toBe("METHOD_NOT_ALLOWED");
    expect(
      (await request(app).post("/docs/a/b/swagger-ui-init.js")).status,
    ).toBe(404);
    expect((await request(app).get("/docs").redirects(1)).text).toContain(
      "swagger-ui",
    );
  });
  it("keeps GET, implicit HEAD, CORS OPTIONS and operation permissions", async () => {
    const app = application("MEMBER");
    expect((await request(app).get("/health/live")).status).toBe(200);
    const head = await request(app).head("/health/live");
    expect(head.status).toBe(200);
    expect(head.text).toBeUndefined();
    const authHead = await request(app).head("/api/v1/auth/login");
    expect(authHead.status).toBe(405);
    expect(authHead.text).toBeUndefined();
    const options = await request(app)
      .options("/api/v1/books")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "DELETE");
    expect(options.status).toBe(204);
    expect(options.headers["access-control-allow-methods"]).toContain("DELETE");
    expect(options.headers.allow).toBeUndefined();
    const method = await request(app)
      .delete("/api/v1/books")
      .set("Origin", "http://localhost:5173");
    expect(method.headers.allow).toBe("GET, HEAD, POST, OPTIONS");
    expect(method.headers["access-control-expose-headers"]).toContain("Allow");
    expect(
      (
        await request(app)
          .post("/api/v1/books")
          .auth(await token(), { type: "bearer" })
          .send({})
      ).status,
    ).toBe(403);
    expect((await request(app).get("/api/v1/books/not-a-uuid")).status).toBe(
      400,
    );
  });
});
