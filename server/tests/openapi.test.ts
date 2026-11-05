import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/shared/logger.js";
import { expectOpenApi } from "./helpers/openapi.js";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/bookflow_test",
  JWT_SECRET: "test-signing-secret-at-least-thirty-two-characters",
  LOG_LEVEL: "silent",
});
const app = createApp({
  config,
  logger: createLogger(config),
  checkReadiness: async () => true,
});
describe("OpenAPI response validator", () => {
  it("checks actual HTTP responses and rejects missing/wrong fields, headers, media types and statuses", async () => {
    const response = await request(app).get("/health/live");
    expectOpenApi("getLiveness", 200, response);
    for (const body of [
      { status: "ok" },
      { ...response.body, service: 12 },
      { ...response.body, extra: true },
    ]) {
      expect(() =>
        expectOpenApi("getLiveness", 200, { ...response, body }),
      ).toThrow();
    }
    expect(() => expectOpenApi("getLiveness", 201, response)).toThrow(/status/);
    expect(() =>
      expectOpenApi("getLiveness", 200, {
        ...response,
        headers: { "content-type": "application/json" },
      }),
    ).toThrow(/header/);
    expect(() =>
      expectOpenApi("getLiveness", 200, {
        ...response,
        headers: { ...response.headers, "content-type": "text/html" },
      }),
    ).toThrow(/Content-Type/);
    expect(() => expectOpenApi("missingOperation", 200, response)).toThrow(
      /Unknown/,
    );
    expect(() =>
      expectOpenApi("getLiveness", 299, { ...response, status: 299 }),
    ).toThrow(/undocumented/);
    expect(() =>
      expectOpenApi("deleteCategory", 204, { ...response, status: 204 }),
    ).toThrow(/body/);
  });
});
