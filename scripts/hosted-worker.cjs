const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'news_loader/data');
const pidFile = path.join(dir, 'hosted-worker.pid');
const logFile = path.join(dir, 'hosted-worker.log');
const marker = 'meip-hosted-news-worker';

function currentWorker() {
  if (!fs.existsSync(pidFile)) return null;
  const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
  if (!Number.isSafeInteger(pid) || pid < 2) throw new Error('Invalid worker PID file. No process was signalled.');
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'pgid=', '-o', 'command='], { encoding: 'utf8' });
  if (result.error || result.stderr?.trim()) throw new Error('Unable to inspect worker process. Run this command from your Mac terminal.');
  if (result.status === 1 && !result.stdout.trim()) return null;
  if (result.status !== 0) throw new Error('Unable to inspect worker process.');
  const match = result.stdout.trim().match(/^(\d+)\s+(.+)$/);
  // Recognize both the managed command and the worker initially started by Codex.
  const command = match?.[2] ?? '';
  const isWorker = command.includes('from worker import main; main()') &&
    (command.includes(marker) || command.includes("load_env(Path('.env.worker'))"));
  if (!isWorker || Number(match[1]) !== pid) throw new Error('PID belongs to a different process. No process was signalled; inspect the PID file before continuing.');
  return pid;
}

async function main() {
  const action = process.argv[2];
  if (!['start', 'stop', 'status'].includes(action)) throw new Error('Usage: node scripts/hosted-worker.cjs start|stop|status');
  const pid = currentWorker();
  if (action === 'status') {
    console.log(pid ? `News worker is running (PID ${pid}).` : 'News worker is stopped.');
    console.log(`Logs: ${logFile}`);
    return;
  }
  if (action === 'stop') {
    if (!pid) { console.log('News worker is already stopped.'); return; }
    // Stop its fetch subprocess too; both belong to this detached process group.
    process.kill(-pid, 'SIGTERM');
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!currentWorker()) {
        fs.unlinkSync(pidFile);
        console.log('News worker stopped. Saved news remains in Supabase.');
        return;
      }
    }
    throw new Error('Stop requested, but the process is still exiting. Check worker:status before restarting.');
  }
  if (pid) { console.log(`News worker is already running (PID ${pid}).`); return; }
  if (!fs.existsSync(path.join(root, '.env.worker'))) throw new Error('Missing .env.worker. Configure it using .env.worker.example.');
  loadEnvConfig(root, true);
  const python = process.env.NEWSLOADER_PYTHON || 'python3';
  const code = "from pathlib import Path; import sys; sys.path.insert(0,str(Path.cwd()/'news_loader')); from config import load_env; load_env(Path('.env.worker'), override=True); from worker import main; main()";
  fs.mkdirSync(dir, { recursive: true });
  const log = fs.openSync(logFile, 'a', 0o600);
  try {
    const child = spawn(python, ['-u', '-c', code, marker], {
      cwd: root, detached: true, stdio: ['ignore', log, log], env: process.env,
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    fs.writeFileSync(pidFile, `${child.pid}\n`, { mode: 0o600 });
    child.unref();
    console.log(`News worker started in background (PID ${child.pid}).`);
    console.log(`Check readiness in: ${logFile}`);
  } finally { fs.closeSync(log); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
