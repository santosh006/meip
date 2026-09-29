const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');
const { workerConfig } = require('./worker-config.cjs');
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
// Keep the server-only key in the worker process, not the Next.js environment.
if (process.env.NEWS_STORAGE === 'supabase' && fs.existsSync(path.join(process.cwd(), '.env.worker'))) {
  process.loadEnvFile(path.join(process.cwd(), '.env.worker'));
}
const config = workerConfig(process.env, process.cwd());
const worker = spawn(config.command, config.args, config.options);
worker.on('error', error => {
  console.error(`Unable to start news worker (${error.code}). Check NEWSLOADER_PYTHON in .env.local.`);
  process.exitCode = 1;
});
worker.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => worker.kill(signal));
