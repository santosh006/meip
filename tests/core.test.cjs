const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreEvent } = require('../src/lib/scoring/index.ts');
const { reviewBody, ingestBody, integer } = require('../src/lib/api/validation.ts');
const { validateUpload, MAX_UPLOAD_BYTES } = require('../src/lib/ingestion/upload-validation.ts');
const { groupBy, pagination } = require('../src/lib/queries.ts');

test('scoring preserves direction and bounds confidence for invalid credibility', () => {
  for (const credibility of [-10, 10, NaN, Infinity, 0, 1]) {
    const score = scoreEvent({ title: 'Earnings', eventType: 'earnings', metrics: { revenue: '-' }, sourceCredibility: credibility });
    assert.equal(score.direction, 'negative');
    assert.ok(score.impactScore < 0 && score.impactScore >= -100);
    assert.ok(score.confidence >= 0 && score.confidence <= 1);
  }
  assert.equal(scoreEvent({ title: 'Mixed', eventType: 'earnings', metrics: { revenue: '+', margin: '-' } }).direction, 'mixed');
});
test('review validation supports existing Python IDs and rejects malformed input', () => {
  for (const length of [40, 64]) assert.equal(reviewBody({ articleId: 'a'.repeat(length), ticker: 'tcs' }, 'accepted').ticker, 'TCS');
  for (const body of [null, [], { articleId: 'x' }, { articleId: 'a'.repeat(40), confidence: 2 }, { articleId: 'a'.repeat(40), direction: 'invented' }]) assert.throws(() => reviewBody(body, 'accepted'));
  assert.throws(() => reviewBody({ articleId: 'a'.repeat(40) }, 'rejected'));
});
test('job validation rejects option injection, fractional windows, and overlarge limits', () => {
  for (const value of [{ticker:'--help'}, {ticker:'TCS', days:1.5}, {ticker:'TCS', limit:201}, {ticker:'TCS', sources:['../../main']}]) assert.throws(() => ingestBody(value));
  assert.deepEqual(ingestBody({ticker:'tcs'}), {ticker:'TCS', days:1, limit:50, sources:[]});
  assert.throws(() => integer('1e4', 'page', 1, 100000));
});
test('upload validation rejects empty, oversized, and mismatched files', () => {
  assert.ok(validateUpload({name:'a.pdf', type:'application/pdf', size:0}));
  assert.ok(validateUpload({name:'a.pdf', type:'application/pdf', size:MAX_UPLOAD_BYTES+1}));
  assert.ok(validateUpload({name:'a.exe', type:'', size:10}));
  assert.ok(validateUpload({name:'a.pdf', type:'text/html', size:10}));
  assert.equal(validateUpload({name:'a.pdf', type:'', size:10}), null);
});
test('grouping uses UUIDs, keeping companies with identical names separate', () => {
  const rows = [{entity_id:'1', company:'Same'}, {entity_id:'2', company:'Same'}, {entity_id:'1', company:'Renamed'}, {entity_id:null}];
  const grouped = groupBy(rows, r => r.entity_id);
  assert.equal(grouped.get('1').length, 2);
  assert.equal(grouped.get('2').length, 1);
  assert.equal(grouped.size, 2);
});
test('pagination bounds offsets and removes PostgREST control characters', async () => {
  const result = await pagination(Promise.resolve({page:'2', q:'TCS%,id.neq.*'}));
  assert.equal(result.from, 25);
  assert.equal(result.to, 49);
  assert.ok(!/[%,*]/.test(result.search));
  assert.equal((await pagination(Promise.resolve({page:'-1'}))).page, 1);
});
