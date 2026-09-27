const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('../src/lib/newsdb.ts');
const { apiError } = require('../src/lib/api/auth.ts');

test('Vercel ingestion returns an actionable 503 before opening SQLite', async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    let failure;
    try { db(); } catch (error) { failure = error; }
    assert.ok(failure, 'SQLite must not be opened on Vercel');
    const response = apiError(failure);
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /shared persistent host/);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
