import { SignJWT, jwtVerify } from "jose";
import type { AppConfig } from "../config/env.js";

export function createAccessTokens(
  config: Pick<
    AppConfig,
    "jwtSecret" | "jwtIssuer" | "jwtAudience" | "accessTokenTtlSeconds"
  >,
) {
  const secret = new TextEncoder().encode(config.jwtSecret);
  return {
    async sign(userId: string) {
      return new SignJWT({})
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(userId)
        .setIssuer(config.jwtIssuer)
        .setAudience(config.jwtAudience)
        .setIssuedAt()
        .setExpirationTime(`${config.accessTokenTtlSeconds}s`)
        .sign(secret);
    },
    async verify(token: string) {
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        requiredClaims: ["sub", "iat", "exp", "iss", "aud"],
        typ: "JWT",
      });
      if (!payload.sub) throw new Error("Missing token subject");
      return payload.sub;
    },
  };
}
