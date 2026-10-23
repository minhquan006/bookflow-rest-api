import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const clientRequire = createRequire(resolve(root, 'client/package.json'));
const { createServer } = await import(pathToFileURL(clientRequire.resolve('vite')).href);
const apiTarget = 'http://127.0.0.1:3100';
const proxy = Object.fromEntries(
  ['/api', '/docs', '/openapi.yaml', '/health'].map(path => [
    path, { target: apiTarget, changeOrigin: true },
  ]),
);
const web = await createServer({
  configFile: resolve(root, 'client/vite.config.ts'),
  root: resolve(root, 'client'),
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy },
});
await web.listen();
const api = spawn('npm', ['--prefix', 'server', 'run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  detached: true,
  env: {
    ...process.env,
    HOST: '127.0.0.1', PORT: '3100', AUTH_RATE_LIMIT_MAX: '100',
    ALLOWED_ORIGINS: 'http://127.0.0.1:5174,http://localhost:5174',
  },
});
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (api.pid) {
    try { process.kill(-api.pid, 'SIGTERM'); }
    catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
  }
  await web.close();
  process.exitCode = code;
}
api.on('error', error => { console.error(error.message); void stop(1); });
api.on('exit', code => { void stop(code ?? 1); });
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
console.log('BookFlow: web 5174; API 3100. Keep this terminal open.');
