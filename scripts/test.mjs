import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Start first, then probe readiness. This works even when a closed localhost
// port silently times out, and avoids touching the user's development server.
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3100'], {
  env: { ...process.env, LOCALPULSE_TEST_SERVER: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let exited = false;
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
server.on('exit', () => { exited = true; });
let runner;
const stop = () => { runner?.kill('SIGTERM'); server.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  const deadline = Date.now() + 60_000;
  while (!output.includes('Ready in')) {
    if (exited) throw new Error(`Test server exited before starting.\n${output}`);
    if (Date.now() > deadline) throw new Error(`Test server did not start.\n${output}`);
    await delay(200);
  }
  if (!output.includes('localhost:3100')) throw new Error(`Test server could not bind port 3100.\n${output}`);
  runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  const result = await new Promise((resolve, reject) => { runner.on('error', reject); runner.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0))); });
  process.exitCode = result;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stop();
}
