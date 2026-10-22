import { Router, type Request } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../../config/env.js";
import { createAuthentication, requireRoles } from "../../middleware/auth.js";
import { parseInput } from "../../middleware/validation.js";
import { bookEtag, createCatalogService } from "./service.js";
import * as schema from "./schemas.js";
export function createCatalogRouter(config: AppConfig, pool: Pool) {
  const router = Router();
  const service = createCatalogService(pool);
  const { authenticate } = createAuthentication(config, pool);
  const staff = [authenticate, requireRoles("LIBRARIAN", "ADMIN")];
  const optionalAuth: typeof authenticate = (req, res, next) =>
    req.get("authorization") ? authenticate(req, res, next) : next();
  const id = (req: Request) => parseInput(schema.idSchema, req.params.id);
  const actor = (req: Request) => ({
    ...req.principal!,
    requestId: req.requestId,
  });
  router.get("/categories", async (req, res) => {
    res.json(
      await service.listCategories(parseInput(schema.pageQuery, req.query)),
    );
  });
  router.post("/categories", ...staff, async (req, res) => {
    const value = await service.createCategory(
      parseInput(schema.categoryInput, req.body),
      actor(req),
    );
    res
      .location(`/api/v1/categories/${value.id}`)
      .status(201)
      .json({ data: value });
  });
  router.put("/categories/:id", ...staff, async (req, res) => {
    res.json({
      data: await service.replaceCategory(
        id(req),
        parseInput(schema.categoryInput, req.body),
        actor(req),
      ),
    });
  });
  router.delete("/categories/:id", ...staff, async (req, res) => {
    await service.deleteCategory(id(req), actor(req));
    res.status(204).end();
  });
  router.get("/books", optionalAuth, async (req, res) => {
    res.json(
      await service.listBooks(
        parseInput(schema.bookQuery, req.query),
        req.principal,
      ),
    );
  });
  router.post("/books", ...staff, async (req, res) => {
    const value = await service.createBook(
      parseInput(schema.bookInput, req.body),
      actor(req),
    );
    res
      .location(`/api/v1/books/${value.id}`)
      .set("ETag", bookEtag(value))
      .status(201)
      .json({ data: value });
  });
  router.get("/books/:id", optionalAuth, async (req, res) => {
    const value = await service.getBook(id(req), req.principal);
    const etag = bookEtag(value);
    res.set("ETag", etag);
    const matches = (req.get("if-none-match") ?? "")
      .split(",")
      .map((v) => v.trim().replace(/^W\//, ""));
    if (matches.includes(etag) || matches.includes("*")) {
      res.status(304).end();
      return;
    }
    res.json({ data: value });
  });
  for (const method of ["put", "patch"] as const)
    router[method]("/books/:id", ...staff, async (req, res) => {
      const input =
        method === "put"
          ? parseInput(schema.bookInput, req.body)
          : parseInput(schema.bookPatch, req.body);
      const value = await service.updateBook(
        id(req),
        input,
        req.get("if-match"),
        actor(req),
      );
      res.set("ETag", bookEtag(value)).json({ data: value });
    });
  router.delete("/books/:id", ...staff, async (req, res) => {
    await service.archiveBook(id(req), req.get("if-match"), actor(req));
    res.status(204).end();
  });
  router.get("/books/:id/availability", async (req, res) => {
    // Availability is always a fresh operational result, never a conditional metadata response.
    res
      .type("application/json")
      .end(JSON.stringify({ data: await service.availability(id(req)) }));
  });
  router.get("/books/:id/copies", ...staff, async (req, res) => {
    res.json(
      await service.listCopies(
        id(req),
        parseInput(schema.pageQuery, req.query),
        req.principal!,
      ),
    );
  });
  router.post("/books/:id/copies", ...staff, async (req, res) => {
    const value = await service.createCopy(
      id(req),
      parseInput(schema.copyInput, req.body).barcode,
      actor(req),
    );
    res
      .location(`/api/v1/copies/${value.id}`)
      .status(201)
      .json({ data: value });
  });
  router.patch("/copies/:id", ...staff, async (req, res) => {
    res.json({
      data: await service.updateCopy(
        id(req),
        parseInput(schema.copyPatch, req.body).conditionStatus,
        actor(req),
      ),
    });
  });
  return router;
}
