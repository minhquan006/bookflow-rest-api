import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  cpus,
  availableParallelism,
  totalmem,
  platform,
  arch,
  release,
} from "node:os";
import type { AddressInfo } from "node:net";
import { Pool } from "pg";
import { createApp } from "../app.js";
import { createApiRouter } from "../routes.js";
import { loadConfig } from "../config/env.js";
import { createLogger } from "../shared/logger.js";
import { hashPassword } from "../shared/passwords.js";
import { runMigrations } from "./migrate.js";

function budget(value: string | undefined, fallback: number, maximum: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum)
    throw new Error("Invalid benchmark budget.");
  return number;
}

/** Synthetic read benchmark in a disposable schema of a dedicated test database. */
export async function benchmark() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
    throw new Error("Use a TEST_DATABASE_URL ending _test.");
  const schema = `benchmark_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const pool = new Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema}`,
    max: 10,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await runMigrations(pool);
    const hash = await hashPassword(randomBytes(32).toString("base64url"));
    const users = await pool.query<{ id: string; role: string }>(
      `INSERT INTO users(full_name,email,password_hash,role,status) VALUES
      ('Benchmark Member','benchmark-member@bookflow.test',$1,'MEMBER','DISABLED'),
      ('Benchmark Librarian','benchmark-staff@bookflow.test',$1,'LIBRARIAN','DISABLED') RETURNING id,role`,
      [hash],
    );
    const member = users.rows.find((row) => row.role === "MEMBER")!.id;
    const staff = users.rows.find((row) => row.role === "LIBRARIAN")!.id;
    await pool.query(
      `INSERT INTO categories(name,slug) SELECT 'Benchmark category '||i,'benchmark-'||i FROM generate_series(1,10) s(i)`,
    );
    await pool.query(`WITH cats AS (SELECT id,row_number() OVER(ORDER BY slug) n FROM categories)
      INSERT INTO books(category_id,title,author,description)
      SELECT c.id,'Benchmark Book '||lpad(s.i::text,4,'0'),'Synthetic Author','Synthetic benchmark metadata.'
      FROM generate_series(1,1000) s(i) JOIN cats c ON c.n=((s.i-1)%10)+1`);
    await pool.query(`WITH catalog AS (SELECT id,row_number() OVER(ORDER BY title) n FROM books)
      INSERT INTO book_copies(book_id,barcode)
      SELECT c.id,'BENCH-'||lpad(s.i::text,5,'0') FROM generate_series(1,3000) s(i)
      JOIN catalog c ON c.n=((s.i-1)/3)+1`);
    await pool.query(
      `WITH copies AS (SELECT id,row_number() OVER(ORDER BY barcode) n FROM book_copies)
      INSERT INTO loans(user_id,copy_id,borrowed_at,due_at,returned_at,returned_by)
      SELECT $1,c.id,now()-interval '90 days'+s.i*interval '1 minute',
      now()-interval '76 days'+s.i*interval '1 minute',now()-interval '80 days'+s.i*interval '1 minute',$2
      FROM generate_series(1,10000) s(i) JOIN copies c ON c.n=((s.i-1)%3000)+1`,
      [member, staff],
    );
    await pool.query("ANALYZE");
    const counts = (
      await pool.query(`SELECT (SELECT count(*)::int FROM books) books,
      (SELECT count(*)::int FROM book_copies) copies,(SELECT count(*)::int FROM loans) historical_loans`)
    ).rows[0];
    const config = loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: randomBytes(48).toString("hex"),
      LOG_LEVEL: "silent",
    });
    const app = createApp({
      config,
      logger: createLogger(config),
      checkReadiness: async () => true,
      rateLimit: 100000,
      apiRouter: createApiRouter({ pool, config }),
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((accept, reject) => {
      server!.once("listening", accept);
      server!.once("error", reject);
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (let i = 0; i < 20; i++) {
      const response = await fetch(`${base}/api/v1/books?limit=20`);
      await response.arrayBuffer();
    }
    const requests = budget(process.env.BENCHMARK_REQUESTS, 500, 10000);
    const concurrency = budget(process.env.BENCHMARK_CONCURRENCY, 20, 100);
    const latencies: number[] = [];
    const statuses: Record<string, number> = {};
    let next = 0;
    const cpuStart = process.cpuUsage();
    const started = performance.now();
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (next < requests) {
          const index = next++;
          const at = performance.now();
          try {
            const query =
              index % 2
                ? `q=Benchmark%20Book&page=${(index % 50) + 1}&limit=20`
                : `page=${(index % 50) + 1}&limit=20&sort=title`;
            const response = await fetch(`${base}/api/v1/books?${query}`);
            await response.arrayBuffer();
            statuses[response.status] = (statuses[response.status] ?? 0) + 1;
          } catch {
            statuses.network_error = (statuses.network_error ?? 0) + 1;
          }
          latencies.push(performance.now() - at);
        }
      }),
    );
    const elapsed = performance.now() - started;
    const cpu = process.cpuUsage(cpuStart);
    latencies.sort((a, b) => a - b);
    const percentile = (p: number) =>
      Number(latencies[Math.ceil(latencies.length * p) - 1]!.toFixed(2));
    const errors = Object.entries(statuses).reduce(
      (total, [code, count]) => (code === "200" ? total : total + count),
      0,
    );
    const result = {
      recordedAt: new Date().toISOString(),
      kind: "Synthetic catalog read benchmark; not a production capacity claim",
      dataset: counts,
      workload: {
        requests,
        concurrency,
        poolMax: 10,
        warmupRequests: 20,
        endpoints: ["GET /api/v1/books page/sort", "GET /api/v1/books q/page"],
      },
      environment: {
        node: process.version,
        platform: platform(),
        arch: arch(),
        kernel: release(),
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        availableParallelism: availableParallelism(),
        hostMemoryBytes: totalmem(),
      },
      results: {
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
        p99Ms: percentile(0.99),
        durationMs: Number(elapsed.toFixed(2)),
        requestsPerSecond: Number(((requests * 1000) / elapsed).toFixed(2)),
        errors,
        errorRate: errors / requests,
        statuses,
        processCpuMicros: cpu,
        processMemoryBytes: process.memoryUsage(),
      },
      target: {
        p95Below500Ms: percentile(0.95) < 500,
        noRequestErrors: errors === 0,
      },
      limits:
        "Local ephemeral HTTP server and PostgreSQL on this cloud host; measures catalog reads only, not password hashing or loan writes. Database fixture is generated directly and does not represent real users.",
    };
    const output = resolve(
      process.env.BENCHMARK_OUTPUT ||
        fileURLToPath(
          new URL("../../../docs/evidence/benchmark.json", import.meta.url),
        ),
    );
    await mkdir(resolve(output, ".."), { recursive: true });
    await writeFile(output, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
    if (errors > 0) process.exitCode = 1;
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((done) => server!.close(() => done()));
    }
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await benchmark().catch(() => {
    console.error(
      "Benchmark failed; verify dedicated test database, build, and workload settings.",
    );
    process.exitCode = 1;
  });
}
