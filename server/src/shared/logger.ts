import pino from "pino";
import type { DestinationStream } from "pino";
import type { AppConfig } from "../config/env.js";

export function createLogger(
  config: Pick<AppConfig, "logLevel">,
  destination?: DestinationStream,
) {
  return pino(
    {
      level: config.logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [
          "authorization",
          "cookie",
          "password",
          "passwordHash",
          "token",
          "accessToken",
          "refreshToken",
          "databaseUrl",
          "jwtSecret",
          "req.headers.authorization",
          "req.headers.cookie",
        ],
        censor: "[REDACTED]",
      },
    },
    destination,
  );
}
