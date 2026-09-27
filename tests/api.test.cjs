const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const server = require('../src/lib/supabase-server.ts');
let user = null;
let calls = 0;
server.createSupabaseServer = async () => ({ auth: { getUser: async () => ({ data: {user}, error:null }) }, from: () => { calls++; throw new Error('Unexpected database write'); } });
const { authorize, jsonBody } = require('../src/lib/api/auth.ts');
const upload = require('../src/app/api/ingest/route.ts');
const ingest = require('../src/app/api/news/ingest/route.ts');
const preview = require('../src/app/api/news/preview/route.ts');
const sources = require('../src/app/api/news/sources/route.ts');
const accept = require('../src/app/api/news/accept/route.ts');
const reject = require('../src/app/api/news/reject/route.ts');
beforeEach(() => { user = null; calls = 0; });
test('every API rejects anonymous access before touching storage', async () => {
  for (const [handler, url, method] of [
    [upload.GET,'/api/ingest','GET'], [upload.POST,'/api/ingest','POST'],
    [ingest.GET,'/api/news/ingest','GET'], [ingest.POST,'/api/news/ingest','POST'],
    [preview.GET,'/api/news/preview','GET'], [sources.GET,'/api/news/sources','GET'],
    [accept.POST,'/api/news/accept','POST'], [reject.POST,'/api/news/reject','POST'],
  ]) {
    const response = await handler(new NextRequest(`http://localhost${url}`, {method}));
    assert.equal(response.status, 401, url);
  }
  assert.equal(calls,0);
});
test('authenticated mutations reject cross-site requests', async () => {
  user = {id:'user'};
  await assert.rejects(authorize(new NextRequest('http://localhost/api/ingest', {method:'POST', headers:{origin:'https://other.example'}})), {status:403});
});
test('JSON reader rejects oversized requests and malformed JSON', async () => {
  await assert.rejects(jsonBody(new NextRequest('http://localhost/api', {method:'POST', body:'x'.repeat(32769)})), {status:413});
  await assert.rejects(jsonBody(new NextRequest('http://localhost/api', {method:'POST', body:'{'})), {status:400});
});
test('invalid authenticated review input returns 400 rather than accessing storage', async () => {
  user = {id:'user'};
  const response = await accept.POST(new NextRequest('http://localhost/api/news/accept', {method:'POST', body:'null'}));
  assert.equal(response.status,400);
  assert.equal(calls,0);
});
