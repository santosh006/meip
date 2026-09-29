const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { newsQuery } = require('../src/lib/news-query.ts');

function client(requests) {
  return createClient('https://example.supabase.co', 'test-key', {
    auth: { persistSession: false },
    global: { fetch: async (url, options) => {
      requests.push({ url: new URL(url), headers: new Headers(options.headers) });
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '25-49/75' } });
    } },
  });
}
test('news search uses table filters, preserving global pagination without an RPC', async () => {
  const requests = [];
  const { error, count } = await newsQuery(client(requests), { search: 'TCS', from: 25, to: 49 });
  assert.equal(error, null);
  assert.equal(count, 75);
  assert.equal(requests.length, 1);
  const { url, headers } = requests[0];
  assert.equal(url.pathname, '/rest/v1/events');
  assert.equal(url.searchParams.get('offset'), '25');
  assert.equal(url.searchParams.get('limit'), '25');
  assert.equal(url.searchParams.get('search_entity.or'), '(name.ilike.%TCS%,ticker.ilike.%TCS%)');
  assert.equal(url.searchParams.get('or'), '(title.ilike.%TCS%,event_type.ilike.%TCS%,search_entity.not.is.null)');
  assert.ok(headers.get('Prefer').includes('count=exact'));
  assert.equal(url.searchParams.get('entity.or'), null);
  assert.equal(url.searchParams.get('impact_preview.order'), 'created_at.desc');
  assert.equal(url.searchParams.get('impact_count.order'), null);
  assert.equal(url.searchParams.get('impact_records.order'), null);
});
test('empty news search lists events without excluding rows with no entity', async () => {
  const requests = [];
  await newsQuery(client(requests), { search: '', from: 0, to: 24 });
  assert.equal(requests[0].url.searchParams.get('or'), null);
  assert.equal(requests[0].url.searchParams.get('search_entity.or'), null);
  assert.ok(!requests[0].url.searchParams.get('select').includes('!inner'));
});
