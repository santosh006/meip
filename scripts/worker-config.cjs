const path = require('node:path');

function workerConfig(env, root) {
  const loaderRoot = path.resolve(root, env.NEWSLOADER_ROOT || 'news_loader');
  const dbPath = path.resolve(root, env.NEWS_DB_PATH || path.join(loaderRoot, 'data', 'news.sqlite'));
  return {
    command: env.NEWSLOADER_PYTHON || 'python3',
    args: ['-u', path.join(loaderRoot, 'worker.py')],
    options: {
      cwd: root,
      stdio: 'inherit',
      env: { ...env, NEWS_DB_PATH: dbPath, ...(env.DATA_DIR ? {} : { DATA_DIR: path.dirname(dbPath) }) },
    },
  };
}
module.exports = { workerConfig };
