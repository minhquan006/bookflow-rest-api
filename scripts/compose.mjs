import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

// Optional CA trust for managed/corporate proxies, mounted at build time only.
// Certificate verification remains enabled. Never copy proxy credentials into images.
const root = resolve(import.meta.dirname, "..");
const ca = process.env.NODE_EXTRA_CA_CERTS || process.env.SSL_CERT_FILE;
const args = [
  "compose",
  "--project-directory",
  root,
  "-f",
  resolve(root, "compose.yaml"),
];
const temporary = mkdtempSync(join(tmpdir(), "bookflow-compose-"));
if (ca && existsSync(ca)) {
  const override = resolve(temporary, "ca.json");
  writeFileSync(
    override,
    JSON.stringify({
      services: {
        api: { build: { secrets: ["npm_ca"] } },
        web: { build: { secrets: ["npm_ca"] } },
      },
      secrets: { npm_ca: { file: ca } },
    }),
  );
  args.push("-f", override);
}
args.push(...process.argv.slice(2));
const buildx = process.env.BUILDX_CONFIG ?? resolve(root, ".cache/buildx");
mkdirSync(buildx, { recursive: true });
const child = spawn("docker", args, {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, BUILDX_CONFIG: buildx },
});
try {
  await new Promise((accept, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
      accept();
    });
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
