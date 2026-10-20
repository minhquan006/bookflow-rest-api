import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8080";
for (const [path, validate] of [
  [
    "/health/live",
    (body) =>
      assert.deepEqual(JSON.parse(body), {
        status: "ok",
        service: "bookflow-api",
      }),
  ],
  ["/health/ready", (body) => assert.equal(JSON.parse(body).status, "ready")],
  [
    "/api/v1",
    (body) => assert.equal(JSON.parse(body).data.name, "BookFlow API"),
  ],
  ["/docs/", (body) => assert.match(body, /swagger-ui/)],
  ["/docs/swagger-ui-init.js", (body) => assert.match(body, /SwaggerUIBundle/)],
  ["/openapi.yaml", (body) => assert.match(body, /openapi: 3\.1\.0/)],
]) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, path);
  validate(await response.text());
  console.log(`PASS ${path}`);
}
for (const [headers, body, status, code] of [
  [{ "Content-Type": "application/json" }, "{", 400, "VALIDATION_ERROR"],
  [
    { "Content-Type": "application/json" },
    JSON.stringify({ large: "x".repeat(105_000) }),
    413,
    "PAYLOAD_TOO_LARGE",
  ],
  [{ "Content-Type": "text/plain" }, "{}", 415, "UNSUPPORTED_MEDIA_TYPE"],
  [
    { "Content-Type": "application/json; charset=iso-8859-1" },
    "{}",
    415,
    "UNSUPPORTED_MEDIA_TYPE",
  ],
  [
    { "Content-Type": "application/json", "Content-Encoding": "madeup" },
    "{}",
    415,
    "UNSUPPORTED_MEDIA_TYPE",
  ],
]) {
  const response = await fetch(`${base}/api/v1/does-not-exist`, {
    method: "POST",
    headers,
    body,
  });
  assert.equal(response.status, status);
  assert.match(
    response.headers.get("content-type"),
    /application\/problem\+json/,
  );
  const problem = await response.json();
  assert.equal(problem.code, code);
  assert.ok(problem.requestId);
  assert.equal(problem.requestId, response.headers.get("X-Request-Id"));
  console.log(`PASS error ${status} ${code}`);
}
