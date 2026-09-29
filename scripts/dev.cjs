const { spawn } = require('node:child_process');
const path = require('node:path');
const devArgs = process.argv.slice(2);
// Avoid Turbopack's recurring merged-chunk HMR crash; allow explicit opt-in.
if (!devArgs.some(arg => ['--webpack', '--turbopack', '--turbo'].includes(arg))) {
  devArgs.unshift('--webpack');
}
const children = [
  spawn(process.execPath, [path.join(__dirname, 'worker.cjs')], { stdio: 'inherit' }),
  spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...devArgs], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
children.forEach((child, index) => {
  child.on('error', () => stop(1));
  child.on('exit', code => {
    // A worker that finds an existing owner exits successfully; keep Next running.
    if (index === 0 && code === 0) return;
    stop(code ?? 1);
  });
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
