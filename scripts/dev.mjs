import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const processes = [
  spawn("npm", ["run", "dev"], {
    cwd: resolve(root, "server"),
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  }),
  spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    cwd: resolve(root, "client"),
    stdio: "inherit",
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  }),
];
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
