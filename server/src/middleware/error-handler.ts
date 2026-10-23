import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { AppError } from "../shared/errors.js";

const unavailableCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "08001",
  "08003",
  "08006",
  "53300",
  "57P01",
  "57P02",
  "57P03",
]);

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    let problem: AppError;
    if (error instanceof AppError) problem = error;
    else if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    )
      problem = new AppError(
        400,
        "VALIDATION_ERROR",
        "Bad Request",
        "The request body contains invalid JSON.",
      );
    else if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.too.large"
    )
      problem = new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Content Too Large",
        "The request body exceeds the size limit.",
      );
    else if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      (error.type === "charset.unsupported" ||
        error.type === "encoding.unsupported")
    )
      problem = new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Unsupported Media Type",
        "The request body uses an unsupported charset or content encoding.",
      );
    else if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "request.size.invalid"
    )
      problem = new AppError(
        400,
        "VALIDATION_ERROR",
        "Bad Request",
        "The request body length does not match its declared size.",
      );
    else if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      unavailableCodes.has(error.code)
    )
      problem = new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "Service Unavailable",
        "A required service is temporarily unavailable. Please try again later.",
      );
    else
      problem = new AppError(
        500,
        "INTERNAL_ERROR",
        "Internal Server Error",
        "An unexpected error occurred.",
      );
    if (problem.status >= 500) {
      // Error messages/stacks can include SQL, connection URLs, tokens and user input.
      logger.error(
        {
          requestId: req.requestId,
          code: problem.code,
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
        "request failed",
      );
    }
    if (problem.status === 401) res.setHeader("WWW-Authenticate", "Bearer");
    res
      .status(problem.status)
      .type("application/problem+json")
      .json({
        type: `urn:bookflow:problem:${problem.code.toLowerCase().replaceAll("_", "-")}`,
        title: problem.title,
        status: problem.status,
        detail: problem.detail,
        instance: req.path,
        code: problem.code,
        requestId: req.requestId,
        ...(problem.errors ? { errors: problem.errors } : {}),
      });
  };
}
