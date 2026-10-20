import { createRequire } from "node:module";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const root = resolve(import.meta.dirname, "..");
try {
  loadEnvFile(resolve(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const require = createRequire(resolve(root, "server/package.json"));
const { Client } = require("pg");
if (!process.env.TEST_DATABASE_URL)
  throw new Error("TEST_DATABASE_URL required");
const testUrl = new URL(process.env.TEST_DATABASE_URL);
const name = decodeURIComponent(testUrl.pathname.slice(1));
if (!/^[a-z][a-z0-9_]*_test$/.test(name)) {
  throw new Error(
    "Test database name must end in _test (letters/digits/underscore only)",
  );
}
testUrl.pathname = "/postgres";
const admin = new Client({ connectionString: testUrl.toString() });
try {
  await admin.connect();
  const result = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [name],
  );
  if (!result.rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  console.log(`Test database ${name} is available; no existing data removed.`);
} finally {
  await admin.end();
}
