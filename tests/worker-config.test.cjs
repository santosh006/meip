const { test } = require('node:test');
const assert = require('node:assert/strict');
const { workerConfig } = require('../scripts/worker-config.cjs');
test('worker uses configured Python and resolves the same database path as Next', () => {
  const config = workerConfig({ NEWSLOADER_PYTHON: '/venv/bin/python', NEWS_DB_PATH: 'data/news.sqlite' }, '/project');
  assert.equal(config.command, '/venv/bin/python');
  assert.deepEqual(config.args, ['-u', '/project/news_loader/worker.py']);
  assert.equal(config.options.env.NEWS_DB_PATH, '/project/data/news.sqlite');
  assert.equal(config.options.env.DATA_DIR, '/project/data');
});
test('default worker and app use news_loader/data while preserving explicit archive path', () => {
  const config = workerConfig({ DATA_DIR: '/archive' }, '/project');
  assert.equal(config.command, 'python3');
  assert.equal(config.options.env.NEWS_DB_PATH, '/project/news_loader/data/news.sqlite');
  assert.equal(config.options.env.DATA_DIR, '/archive');
});
