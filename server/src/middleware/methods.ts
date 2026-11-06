import { Router } from "express";
import type { RequestHandler } from "express";
import type { Resource } from "../routes.resources.js";
import { AppError } from "../shared/errors.js";
import { requireRoles } from "./auth.js";

export function allowedMethods(resource: Resource) {
  return [
    ...resource.methods.flatMap((method) =>
      method === "GET" ? ["GET", "HEAD"] : [method],
    ),
    "OPTIONS",
  ];
}

export function createMethodGuard(
  resources: readonly Resource[],
  authenticate?: RequestHandler,
) {
  const router = Router();
  for (const resource of resources) {
    const permissions: RequestHandler[] = [];
    if (resource.visibility !== "public") {
      if (!authenticate)
        throw new Error(
          "Protected resources require authentication middleware.",
        );
      permissions.push(authenticate);
      if (resource.visibility === "staff")
        permissions.push(requireRoles("LIBRARIAN", "ADMIN"));
      if (resource.visibility === "admin")
        permissions.push(requireRoles("ADMIN"));
    }
    const methods = allowedMethods(resource);
    router.all(
      resource.path,
      (req, _res, next) => {
        // Exit this guard at the first matching resource, including static paths.
        if (methods.includes(req.method)) next("router");
        else next();
      },
      ...permissions,
      (_req, res) => {
        res.setHeader("Allow", methods.join(", "));
        res.setHeader("Cache-Control", "no-store");
        throw new AppError(
          405,
          "METHOD_NOT_ALLOWED",
          "Method Not Allowed",
          "This resource does not support the requested HTTP method.",
        );
      },
    );
  }
  return router;
}
