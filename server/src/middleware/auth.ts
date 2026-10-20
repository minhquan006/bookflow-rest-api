import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../config/env.js";
import { createAccessTokens } from "../shared/tokens.js";
import { z } from "zod";
import { forbidden, unauthenticated } from "../shared/errors.js";
import type { Principal, Role } from "./context.js";

type AuthDependencies = {
  verifyAccessToken: (token: string) => Promise<string>;
  findUser: (
    id: string,
  ) => Promise<(Principal & { status: "ACTIVE" | "DISABLED" }) | null>;
};

export function requireAuth({
  verifyAccessToken,
  findUser,
}: AuthDependencies): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get("authorization") ?? "");
    if (!match) throw unauthenticated();
    let subject: string;
    try {
      subject = await verifyAccessToken(match[1]!);
    } catch {
      throw unauthenticated();
    }
    if (!z.uuid().safeParse(subject).success) throw unauthenticated();
    // Database failures must remain server failures, not misleading invalid-token errors.
    const user = await findUser(subject);
    if (!user || user.status !== "ACTIVE") throw unauthenticated();
    req.principal = { id: user.id, role: user.role };
    next();
  };
}

export function requireRoles(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.principal) throw unauthenticated();
    if (!roles.includes(req.principal.role)) throw forbidden();
    next();
  };
}

/** Token verification and a live DB read are shared by all protected modules. */
export function createAuthentication(config: AppConfig, pool: Pool) {
  const accessTokens = createAccessTokens(config);
  const authenticate = requireAuth({
    verifyAccessToken: accessTokens.verify,
    async findUser(id) {
      const result = await pool.query<
        Principal & { status: "ACTIVE" | "DISABLED" }
      >("SELECT id, role, status FROM users WHERE id = $1", [id]);
      return result.rows[0] ?? null;
    },
  });
  return { accessTokens, authenticate };
}
