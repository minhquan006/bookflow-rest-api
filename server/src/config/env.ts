import { z } from "zod";

const positiveInteger = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: positiveInteger(3000).pipe(z.number().max(65535)),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(1).default(0),
  DATABASE_URL: z
    .url()
    .refine(
      (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      "Must be a PostgreSQL URL",
    ),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) =>
        !/change.?me|replace.?me|your.?secret|placeholder/i.test(value),
      "Generate a random signing secret",
    ),
  JWT_ISSUER: z.string().min(1).default("bookflow-api"),
  JWT_AUDIENCE: z.string().min(1).default("bookflow-client"),
  ACCESS_TOKEN_TTL_SECONDS: positiveInteger(900),
  REFRESH_TOKEN_TTL_DAYS: positiveInteger(7),
  MAX_ACTIVE_LOANS: positiveInteger(3),
  LOAN_DURATION_DAYS: positiveInteger(14),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
) {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    // Values can contain credentials; report field names and messages only.
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  }
  const env = result.data;
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin)
        throw new Error();
    } catch {
      throw new Error(
        "Invalid configuration: ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths or trailing slashes",
      );
    }
  }
  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    jwtSecret: env.JWT_SECRET,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    maxActiveLoans: env.MAX_ACTIVE_LOANS,
    loanDurationDays: env.LOAN_DURATION_DAYS,
    allowedOrigins,
    logLevel: env.LOG_LEVEL,
  });
}
