import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";

export const REFRESH_COOKIE = "bookflow_refresh";
export const CSRF_COOKIE = "bookflow_csrf";
const csrfError = () =>
  new AppError(
    403,
    "CSRF_REJECTED",
    "Forbidden",
    "The session request could not be verified.",
  );

export function readCookies(req: Request): Record<string, string> {
  const result: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  for (const part of (req.get("cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name !== REFRESH_COOKIE && name !== CSRF_COOKIE) continue;
    if (Object.hasOwn(result, name)) throw csrfError();
    try {
      result[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      throw csrfError();
    }
  }
  return result;
}

function signature(config: AppConfig, payload: string) {
  return createHmac("sha256", config.jwtSecret)
    .update(`bookflow-csrf:${payload}`)
    .digest("base64url");
}

export function createCsrfToken(config: AppConfig, sessionId: string) {
  const payload = `${sessionId}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${signature(config, payload)}`;
}

export function verifyCsrfToken(
  config: AppConfig,
  token: string,
  sessionId?: string,
) {
  if (token.length > 256) return false;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    !/^[0-9a-f-]{36}$/.test(parts[0]!) ||
    !/^[A-Za-z0-9_-]{24}$/.test(parts[1]!)
  )
    return false;
  if (sessionId && parts[0] !== sessionId) return false;
  const actual = Buffer.from(parts[2]!);
  const expected = Buffer.from(signature(config, `${parts[0]}.${parts[1]}`));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Double-submit alone is insufficient: the signature is checked here and the DB token ID in service. */
export function verifySessionRequest(config: AppConfig, req: Request) {
  const origin = req.get("origin");
  if (!origin || !config.allowedOrigins.includes(origin)) throw csrfError();
  const cookies = readCookies(req);
  const header = req.get("x-csrf-token");
  if (
    !header ||
    header !== cookies[CSRF_COOKIE] ||
    !verifyCsrfToken(config, header)
  )
    throw csrfError();
  return { rawToken: cookies[REFRESH_COOKIE], csrfToken: header };
}

export function setSessionCookies(
  config: AppConfig,
  res: Response,
  rawToken: string,
  csrfToken: string,
) {
  const base = {
    secure: config.nodeEnv === "production" || res.req.secure,
    sameSite: "strict" as const,
    maxAge: config.refreshTokenTtlDays * 86_400_000,
  };
  res.cookie(REFRESH_COOKIE, rawToken, {
    ...base,
    path: "/api/v1/auth",
    httpOnly: true,
  });
  res.cookie(CSRF_COOKIE, csrfToken, { ...base, path: "/", httpOnly: false });
}

export function clearSessionCookies(config: AppConfig, res: Response) {
  const base = {
    secure: config.nodeEnv === "production" || res.req.secure,
    sameSite: "strict" as const,
  };
  res.clearCookie(REFRESH_COOKIE, {
    ...base,
    path: "/api/v1/auth",
    httpOnly: true,
  });
  res.clearCookie(CSRF_COOKIE, { ...base, path: "/", httpOnly: false });
}
