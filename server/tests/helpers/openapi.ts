import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";
import {
  Ajv2020,
  type AnySchema,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { Response } from "supertest";

type ResponseSpec = {
  headers?: Record<string, { schema: AnySchema }>;
  content?: Record<string, { schema: AnySchema }>;
};
type Operation = {
  operationId: string;
  responses: Record<string, ResponseSpec>;
};
const spec = (await SwaggerParser.dereference(
  fileURLToPath(new URL("../../../docs/openapi.yaml", import.meta.url)),
  { resolve: { external: false } },
)) as unknown as { paths: Record<string, Record<string, Operation>> };
const operations = new Map<string, Operation>();
for (const path of Object.values(spec.paths)) {
  for (const operation of Object.values(path)) {
    if (operation.operationId) operations.set(operation.operationId, operation);
  }
}
// OpenAPI annotations are allowed; JSON Schema 2020-12 validation, formats,
// required fields and additionalProperties remain enforced. No coercion/defaults.
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats.default(ajv);
const compiled = new Map<AnySchema, ValidateFunction>();
function validate(schema: AnySchema, value: unknown, label: string) {
  let validator = compiled.get(schema);
  if (!validator) {
    validator = ajv.compile(schema);
    compiled.set(schema, validator);
  }
  assert.ok(validator(value), `${label}: ${ajv.errorsText(validator.errors)}`);
}

/** Validate an actual response against one exact operation/status, without logging its body. */
export function expectOpenApi(
  operationId: string,
  status: number,
  response: Pick<Response, "status" | "headers" | "body" | "text">,
  options: { method?: string } = {},
) {
  assert.equal(response.status, status, `${operationId}: unexpected status`);
  const operation = operations.get(operationId);
  assert.ok(operation, `Unknown OpenAPI operation ${operationId}`);
  const expected = operation.responses[String(status)];
  assert.ok(expected, `${operationId}: undocumented status ${status}`);
  for (const [name, header] of Object.entries(expected.headers ?? {})) {
    const value: unknown = response.headers[name.toLowerCase()];
    assert.ok(value !== undefined, `${operationId}: missing header ${name}`);
    // Node exposes Set-Cookie separately, as required for multiple cookies.
    for (const item of Array.isArray(value) ? value : [value]) {
      validate(header.schema, item, `${operationId}: header ${name}`);
    }
  }
  if (!expected.content) {
    assert.ok(!response.text, `${operationId}: body must be empty`);
    assert.ok(
      !response.headers["content-type"],
      `${operationId}: unexpected Content-Type`,
    );
    return;
  }
  const mediaType = String(response.headers["content-type"] ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  const content = expected.content[mediaType];
  assert.ok(content, `${operationId}: undocumented Content-Type`);
  if (options.method?.toUpperCase() === "HEAD") {
    assert.ok(!response.text, `${operationId}: HEAD body must be empty`);
    assert.deepEqual(
      response.body ?? {},
      {},
      `${operationId}: HEAD body must be empty`,
    );
    return;
  }
  validate(content.schema, response.body, `${operationId} ${status} body`);
  if (mediaType === "application/problem+json") {
    assert.equal(
      response.body.status,
      status,
      "Problem status must match HTTP status",
    );
    assert.equal(
      response.body.requestId,
      response.headers["x-request-id"],
      "Problem requestId must match header",
    );
  }
}
