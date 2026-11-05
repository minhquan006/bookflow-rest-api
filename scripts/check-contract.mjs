import SwaggerParser from "@apidevtools/swagger-parser";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  API_RESOURCES,
  FOUNDATION_RESOURCES,
} from "../server/src/routes.resources.ts";

const root = resolve(import.meta.dirname, "..");
const spec = await SwaggerParser.validate(resolve(root, "docs/openapi.yaml"));
const operations = Object.values(spec.paths).flatMap((path) =>
  Object.entries(path).filter(([method]) =>
    ["get", "post", "put", "patch", "delete", "options", "head"].includes(
      method,
    ),
  ),
);
const declared = [
  ...FOUNDATION_RESOURCES,
  ...API_RESOURCES.map((resource) => ({
    ...resource,
    path: `/api/v1${resource.path}`,
  })),
].flatMap((resource) =>
  resource.methods.map(
    (method) =>
      `${method.toLowerCase()} ${resource.path.replace(/:([a-zA-Z]+)/g, "{$1}")}`,
  ),
);
const documented = Object.entries(spec.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([method]) =>
      ["get", "post", "put", "patch", "delete"].includes(method),
    )
    .map(([method, operation]) => {
      if (!operation.responses?.[405]?.headers?.Allow)
        throw new Error(`Missing 405/Allow contract: ${method} ${path}`);
      return `${method} ${path}`;
    }),
);
if (JSON.stringify(declared.sort()) !== JSON.stringify(documented.sort()))
  throw new Error("Resource methods and OpenAPI operations differ");
const ids = operations.map(([, operation]) => operation.operationId);
if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
  throw new Error("Every API operation needs a unique operationId");
}
for (const filename of [
  "BookFlow.postman_collection.json",
  "BookFlow.catalog.postman_collection.json",
  "BookFlow.business.postman_collection.json",
  "BookFlow.local.postman_environment.json",
]) {
  JSON.parse(await readFile(resolve(root, "postman", filename), "utf8"));
}
console.log(
  `OpenAPI ${spec.openapi}: ${operations.length} operations validated; Postman JSON valid.`,
);
