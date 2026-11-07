import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("JSON request bodies on the composed HTTP application", () => {
  let child: ChildProcess;
  let origin: string;
  let stderr = "";
  const payload = { title: "BookFlow parser regression" };
  const json = JSON.stringify(payload);

  beforeAll(async () => {
    child = fork(
      new URL("./fixtures/request-body-server.ts", import.meta.url),
      {
        execArgv: ["--import", "tsx"],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    child.stderr!.on("data", (chunk) => (stderr += chunk));
    const port = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) =>
        reject(new Error(`Parser fixture exited ${code}: ${stderr}`)),
      );
      child.once("message", (message) => {
        if (typeof message === "object" && message && "port" in message)
          resolve(Number(message.port));
        else reject(new Error("Parser fixture did not report its port."));
      });
    });
    origin = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit");
      child.kill("SIGTERM");
      await stopped;
    }
  });

  async function post(body: string | Buffer, encoding?: string) {
    return fetch(`${origin}/api/v1/body-parser-probe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(encoding ? { "Content-Encoding": encoding } : {}),
      },
      body: new Uint8Array(Buffer.from(body)),
      signal: AbortSignal.timeout(3_000),
    });
  }

  it("continues to accept ordinary JSON", async () => {
    const response = await post(json);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: payload });
  });

  it.each([
    ["gzip", gzipSync],
    ["deflate", deflateSync],
    ["br", brotliCompressSync],
  ] as const)(
    "continues to accept valid %s JSON",
    async (encoding, compress) => {
      const response = await post(compress(json), encoding);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: payload });
    },
  );

  it("keeps malformed compressed JSON as correlated Problem Details", async () => {
    const response = await post(gzipSync('{"private":"hidden"'), "gzip");
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toMatch(
      /application\/problem\+json/,
    );
    const problem = await response.json();
    expect(problem.code).toBe("VALIDATION_ERROR");
    expect(problem.requestId).toBe(response.headers.get("x-request-id"));
    expect(JSON.stringify(problem)).not.toContain("hidden");
  });

  it("enforces the decoded size limit on compressed JSON", async () => {
    const response = await post(
      gzipSync(JSON.stringify({ text: "a".repeat(110_000) })),
      "gzip",
    );
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("finishes a request whose deflate decoder ends before the HTTP body", async () => {
    const first = Buffer.concat([deflateSync(json), Buffer.from([0])]);
    const trailing = Buffer.alloc(2_048);
    const response = await new Promise<{ status?: number; body: string }>(
      (resolve, reject) => {
        const pending = request(
          `${origin}/api/v1/body-parser-probe`,
          {
            method: "POST",
            agent: false,
            headers: {
              "Content-Type": "application/json",
              "Content-Encoding": "deflate",
              "Content-Length": first.length + trailing.length,
              "X-Test-Wait-For-End": "1",
            },
          },
          (incoming) => {
            let body = "";
            incoming.setEncoding("utf8");
            incoming.on("data", (chunk) => (body += chunk));
            incoming.once("error", reject);
            incoming.once("end", () =>
              resolve({ status: incoming.statusCode, body }),
            );
          },
        );
        const sendTrailing = (message: unknown) => {
          if (
            typeof message === "object" &&
            message &&
            "event" in message &&
            message.event === "body-parsed"
          )
            pending.end(trailing);
        };
        child.on("message", sendTrailing);
        pending.once("close", () => child.off("message", sendTrailing));
        pending.once("error", reject);
        pending.setTimeout(3_000, () =>
          pending.destroy(new Error("Compressed request did not finish.")),
        );
        pending.write(first);
      },
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ data: payload });
  });

  it("keeps the API alive after trailing bytes behind a completed gzip frame", async () => {
    const response = await post(
      Buffer.concat([
        gzipSync(json),
        Buffer.from([0]),
        Buffer.alloc(128 * 1_024, 0x58),
      ]),
      "gzip",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: payload });
    // Decoder errors can arrive after the successful response has finished.
    await delay(200);
    expect(child.exitCode, stderr).toBeNull();
    const live = await fetch(`${origin}/health/live`, {
      signal: AbortSignal.timeout(3_000),
    });
    expect(live.status).toBe(200);
  });
});
