import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

export const repositoryRoot = resolve(import.meta.dirname, "..");

function port(value: string | undefined, fallback: number, name: string) {
  const parsed = value === undefined ? fallback : Number(value);
  if (
    !/^\d+$/.test(String(value ?? fallback)) ||
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 65535
  )
    throw new Error(`${name} must be an integer port from 1 to 65535.`);
  return parsed;
}

/** Read ignored root settings without exposing private values to the browser. */
export function readDevConfig(overrides: NodeJS.ProcessEnv = process.env) {
  const path = resolve(repositoryRoot, ".env");
  const env = {
    ...(existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {}),
    ...overrides,
  };
  const apiPort = port(env.PORT, 3000, "PORT");
  const webPort = port(env.WEB_PORT, 5173, "WEB_PORT");
  if (apiPort === webPort)
    throw new Error("PORT and WEB_PORT must be different.");
  const host = env.HOST ?? "127.0.0.1";
  // A wildcard bind address is not a usable proxy destination.
  const targetHost = ["0.0.0.0", "::"].includes(host) ? "127.0.0.1" : host;
  const apiOrigin = new URL(
    `http://${targetHost.includes(":") ? `[${targetHost}]` : targetHost}:${apiPort}`,
  ).origin;
  return {
    env,
    host,
    apiPort,
    webPort,
    apiOrigin,
    webOrigin: `http://127.0.0.1:${webPort}`,
  };
}
