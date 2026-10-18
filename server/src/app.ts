import express from "express";
import helmet from "helmet";
import type { ErrorRequestHandler } from "express";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.get("/health/live", (_req, res) => {
  res.json({
    status: "ok",
    service: "bookflow-api",
  });
});

app.get("/api/v1", (_req, res) => {
  res.json({
    data: {
      name: "BookFlow API",
      version: "v1",
      message: "Frontend and backend are connected.",
    },
  });
});

app.use((req, res) => {
  res.status(404).type("application/problem+json").json({
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: "The requested endpoint does not exist.",
    instance: req.path,
  });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status =
    error?.type === "entity.parse.failed"
      ? 400
      : error?.type === "entity.too.large"
        ? 413
        : 500;

  const title =
    status === 400
      ? "Bad Request"
      : status === 413
        ? "Content Too Large"
        : "Internal Server Error";

  if (status === 500) {
    console.error("Unhandled request error:", error);
  }

  res.status(status).type("application/problem+json").json({
    type: "about:blank",
    title,
    status,
    detail:
      status === 400
        ? "The request body contains invalid JSON."
        : status === 413
          ? "The request body exceeds the size limit."
          : "An unexpected error occurred.",
    instance: req.path,
  });
};

app.use(errorHandler);