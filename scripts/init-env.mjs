import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const rootEnv = resolve(root, ".env");
if (!existsSync(rootEnv)) {
  const password = randomBytes(24).toString("hex");
  const jwt = randomBytes(48).toString("hex");
  const demoPassword = randomBytes(18).toString("base64url");
  writeFileSync(
    rootEnv,
    `NODE_ENV=development\nHOST=127.0.0.1\nPORT=3000\nPOSTGRES_USER=bookflow\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=bookflow\nDATABASE_URL=postgresql://bookflow:${password}@127.0.0.1:5432/bookflow\nTEST_DATABASE_URL=postgresql://bookflow:${password}@127.0.0.1:5432/bookflow_test\nJWT_SECRET=${jwt}\nJWT_ISSUER=bookflow-api\nJWT_AUDIENCE=bookflow-client\nALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\nLOG_LEVEL=info\nSEED_DEMO_PASSWORD=${demoPassword}\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log("Created ignored .env with random local credentials.");
} else {
  console.log("Preserved existing .env.");
}

const serverEnv = resolve(root, "server/.env");
if (!existsSync(serverEnv)) {
  writeFileSync(serverEnv, readFileSync(rootEnv), { mode: 0o600, flag: "wx" });
  console.log("Created server/.env from local configuration.");
} else {
  console.log(
    "Preserved existing server/.env; keep it consistent with root .env.",
  );
}

const clientEnv = resolve(root, "client/.env.local");
if (!existsSync(clientEnv)) {
  writeFileSync(clientEnv, "VITE_API_BASE_URL=/api/v1\n", { flag: "wx" });
  console.log("Created client/.env.local.");
}
