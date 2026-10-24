import SwaggerParser from "@apidevtools/swagger-parser";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const spec = await SwaggerParser.validate(resolve(root, "docs/openapi.yaml"));
const operations = Object.values(spec.paths).flatMap((path) =>
  Object.entries(path).filter(([method]) =>
    ["get", "post", "put", "patch", "delete", "options", "head"].includes(
      method,
    ),
  ),
);
const ids = operations.map(([, operation]) => operation.operationId);
if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
  throw new Error("Every API operation needs a unique operationId");
}
for (const filename of [
  "BookFlow.postman_collection.json",
  "BookFlow.planned.postman_collection.json",
  "BookFlow.catalog.postman_collection.json",
  "BookFlow.business.postman_collection.json",
  "BookFlow.local.postman_environment.json",
]) {
  JSON.parse(await readFile(resolve(root, "postman", filename), "utf8"));
}
console.log(
  `OpenAPI ${spec.openapi}: ${operations.length} operations validated; Postman JSON valid.`,
);
