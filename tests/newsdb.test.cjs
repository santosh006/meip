const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meip-test-'));
process.env.NEWS_DB_PATH = path.join(dir, 'news.sqlite');
const { db, reserveReview, tombstoneAndDelete, isReviewed, listArticles, computeDedupeKey } = require('../src/lib/newsdb.ts');
const conn = db();
conn.exec(`CREATE TABLE articles(dedupe_key TEXT PRIMARY KEY, source TEXT, title TEXT, url TEXT, published_at TEXT, tickers TEXT);
CREATE TABLE article_tickers(dedupe_key TEXT,ticker TEXT,PRIMARY KEY(dedupe_key,ticker));`);
after(() => { conn.close(); fs.rmSync(dir, {recursive:true, force:true}); });
function add(id) {
  conn.prepare('INSERT INTO articles VALUES(?,?,?,?,?,?)').run(id,'test','Example','https://example.com','2026-09-27','TCS');
  conn.prepare('INSERT INTO article_tickers VALUES(?,?)').run(id,'TCS');
}
test('a retry reuses the original payload and cannot replace a pending decision', () => {
  add('pending');
  const first = reserveReview('pending','accepted','user1',{summary:'original'});
  const retry = reserveReview('pending','accepted','user2',{summary:'changed'});
  assert.equal(retry.intent.payload, first.intent.payload);
  assert.equal(retry.intent.reviewer_id, 'user1');
  assert.equal(reserveReview('pending','rejected','user2',{}).intent.decision, 'accepted');
  assert.equal(listArticles().some(a => a.id === 'pending'), true);
});
test('cleanup is atomic, removes mappings, and records durable review', () => {
  tombstoneAndDelete('pending','accepted',{reviewerId:'user1'});
  assert.equal(isReviewed('pending'), 'accepted');
  tombstoneAndDelete('pending','accepted',{reviewerId:'other'});
  assert.equal(conn.prepare('SELECT reviewer_id FROM article_reviews WHERE dedupe_key=?').get('pending').reviewer_id, 'user1');
  for (const table of ['articles','article_tickers','review_intents']) assert.equal(conn.prepare(`SELECT count(*) n FROM ${table} WHERE dedupe_key=?`).get('pending').n, 0);
  assert.throws(() => tombstoneAndDelete('pending','rejected'));
  assert.equal(reserveReview('pending','accepted','user1',{}).prior, 'accepted');
});
test('reviewed articles are excluded even if a stale importer reintroduces them', () => {
  add('pending');
  assert.equal(listArticles().some(a => a.id === 'pending'), false);
});
test('ticker filter matches whole symbols', () => {
  add('other');
  conn.prepare('UPDATE articles SET tickers=? WHERE dedupe_key=?').run('HDFCBANK','other');
  conn.prepare('UPDATE article_tickers SET ticker=? WHERE dedupe_key=?').run('HDFCBANK','other');
  assert.equal(listArticles({ticker:'HDFC'}).length, 0);
  assert.equal(listArticles({ticker:'HDFCBANK'}).length, 1);
});
test('Node dedupe identity matches Python vendor-id-first SHA1 contract', () => {
  const {createHash} = require('node:crypto');
  const expected = createHash('sha1').update('test|vendor-1').digest('hex');
  assert.equal(computeDedupeKey({source:'test',title:'Headline',external_id:'vendor-1',url:'https://example.com'}), expected);
});

test('fallback dedupe matches Python for missing publication dates', () => {
  const {createHash} = require('node:crypto');
  assert.equal(computeDedupeKey({source:'test',title:'Headline'}), createHash('sha1').update('test|Headline|None').digest('hex'));
});
