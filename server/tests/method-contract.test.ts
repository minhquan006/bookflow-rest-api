import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";
import request from "supertest";
import type { Pool } from "pg";
import { createApp } from "../src/app.js";
import { createApiRouter } from "../src/routes.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/shared/logger.js";
import { createAccessTokens } from "../src/shared/tokens.js";
import { expectOpenApi } from "./helpers/openapi.js";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/bookflow_test",
  JWT_SECRET: "contract-test-signing-key-at-least-thirty-two-characters",
  LOG_LEVEL: "silent",
});
const id = randomUUID();
function application(role = "ADMIN") {
  const pool = {
    query: async (sql: string) => {
      assert.equal(sql, "SELECT id, role, status FROM users WHERE id = $1");
      return { rows: [{ id, role, status: "ACTIVE" }] };
    },
  } as unknown as Pool;
  return createApp({
    config,
    logger: createLogger(config),
    checkReadiness: async () => true,
    apiRouter: createApiRouter({ pool, config }),
  });
}
const bearer = await createAccessTokens(config).sign(id);
const spec = (await SwaggerParser.parse(
  fileURLToPath(new URL("../../docs/openapi.yaml", import.meta.url)),
)) as unknown as {
  paths: Record<string, Record<string, { operationId: string }>>;
};
// Derive the allowed method set from the published contract, independently of
// the runtime registry used by the method guard. Order is not significant in Allow.
const operations = Object.entries(spec.paths).flatMap(([path, item]) => {
  const methods = Object.keys(item).filter((method) =>
    ["get", "post", "put", "patch", "delete"].includes(method),
  );
  const allow = [
    ...methods.map((m) => m.toUpperCase()),
    ...(methods.includes("get") ? ["HEAD"] : []),
    "OPTIONS",
  ].sort();
  return methods.map((method) => ({
    path,
    operationId: item[method]!.operationId,
    allow,
  }));
});

describe("OpenAPI method response contracts on the composed application", () => {
  it.each(operations)(
    "validates $operationId / 405 and Allow",
    async ({ path, operationId, allow }) => {
      const response = await request(application())
        .trace(`${path.replace(/\{id\}/g, id)}?private=hidden`)
        .auth(bearer, { type: "bearer" });
      expectOpenApi(operationId, 405, response);
      expect(response.headers.allow.split(/,\s*/).sort()).toEqual(allow);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.code).toBe("METHOD_NOT_ALLOWED");
      expect(response.body.instance).toBe(path.replace(/\{id\}/g, id));
      expect(response.text).not.toContain("hidden");
    },
  );

  it("keeps unauthenticated and forbidden responses distinct from 405", async () => {
    const anonymous = await request(application()).delete(
      `/api/v1/loans/${id}`,
    );
    expectOpenApi("getLoan", 401, anonymous);
    expect(anonymous.headers.allow).toBeUndefined();
    const denied = await request(application("MEMBER"))
      .post(`/api/v1/loans/${id}/return`)
      .auth(bearer, { type: "bearer" })
      .send({});
    expectOpenApi("returnLoan", 403, denied);
    expect(denied.headers.allow).toBeUndefined();
  });

  it("validates unsupported HEAD headers with an empty body and rejects a body", async () => {
    const response = await request(application()).head("/api/v1/auth/login");
    expectOpenApi("login", 405, response, { method: "HEAD" });
    expect(response.headers.allow).toBe("POST, OPTIONS");
    expect(() =>
      expectOpenApi(
        "login",
        405,
        { ...response, text: "unexpected" },
        { method: "HEAD" },
      ),
    ).toThrow(/HEAD body/);
    expect(() =>
      expectOpenApi(
        "login",
        405,
        { ...response, body: { status: 405 } },
        { method: "HEAD" },
      ),
    ).toThrow(/HEAD body/);
  });

  it("rejects missing Allow and invalid or uncorrelated 405 Problem Details", async () => {
    const response = await request(application()).delete("/health/live");
    expectOpenApi("getLiveness", 405, response);
    const { allow: _allow, ...headers } = response.headers;
    expect(() =>
      expectOpenApi("getLiveness", 405, { ...response, headers }),
    ).toThrow(/header Allow/);
    for (const body of [
      { ...response.body, status: "405" },
      { ...response.body, status: 404 },
      { ...response.body, requestId: randomUUID() },
    ]) {
      expect(() =>
        expectOpenApi("getLiveness", 405, { ...response, body }),
      ).toThrow();
    }
  });
});
