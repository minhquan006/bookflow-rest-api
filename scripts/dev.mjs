import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { readDevConfig, repositoryRoot } from "./dev-config.ts";

const config = readDevConfig();
// Probe before starting either child; never kill a process to claim a port.
for (const [port, host] of [
  [config.apiPort, config.host],
  [config.webPort, "127.0.0.1"],
]) {
  await new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `BookFlow port ${port} is unavailable. Choose PORT/WEB_PORT in .env; existing services were left running.`,
        ),
      ),
    );
    probe.listen(port, host, () => probe.close(resolvePort));
  });
}
const processes = [
  spawn("npm", ["run", "dev"], {
    cwd: resolve(repositoryRoot, "server"),
    env: config.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  }),
  spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    cwd: resolve(repositoryRoot, "client"),
    env: config.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  }),
];
console.log(
  `BookFlow web ${config.webOrigin}; API ${config.apiOrigin}; docs ${config.webOrigin}/docs/`,
);
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.pid) continue;
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") console.error(error.message);
    }
  }
  process.exitCode = code;
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
for (const child of processes) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
}
