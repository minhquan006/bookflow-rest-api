import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../shared/errors.js";

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Bad Request",
      "The request contains invalid data.",
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  return result.data;
}

// Validated input is kept off Express's getter-only query property.
export function validateBody<T>(schema: z.ZodType<T>): RequestHandler {
  return (req, res, next) => {
    res.locals.body = parseInput(schema, req.body);
    next();
  };
}

export function validateQuery<T>(schema: z.ZodType<T>): RequestHandler {
  return (req, res, next) => {
    res.locals.query = parseInput(schema, req.query);
    next();
  };
}
