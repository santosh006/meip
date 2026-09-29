const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NextRequest } = require('next/server');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meip-review-'));
process.env.NEWS_DB_PATH = path.join(dir, 'news.sqlite');
const storage = require('../src/lib/newsdb.ts');
const conn = storage.db();
conn.exec(`CREATE TABLE articles(
 dedupe_key TEXT PRIMARY KEY,source TEXT,title TEXT,url TEXT,published_at TEXT,tickers TEXT,
 summary TEXT,body TEXT,fetched_at TEXT,publisher TEXT,raw TEXT,categories TEXT,attachment_url TEXT);
 CREATE TABLE article_tickers(dedupe_key TEXT,ticker TEXT,PRIMARY KEY(dedupe_key,ticker));`);
after(() => { conn.close(); fs.rmSync(dir, {recursive:true,force:true}); });
const events = new Map();
const impacts = new Map();
let failWrite = false;
let writeErrorCode = 'TEST_FAILURE';
let entityReads = 0;
const supabase = {
 auth: {getUser: async () => ({data:{user:{id:'reviewer'}},error:null})},
 from: table => {
  if (table === 'entities') return {select: () => ({in: async () => {
   entityReads++;
   return {data:[{id:'entity-tcs',ticker:'TCS'}],error:null};
  }})};
  if (table === 'events') return {upsert: async (event, options) => {
   assert.equal(options.onConflict,'id');
   assert.equal(options.ignoreDuplicates,true);
   if (failWrite) return {error:{code:writeErrorCode}};
   if (!events.has(event.id)) events.set(event.id,event);
   return {error:null};
  }};
  if (table === 'impact_records') return {select: () => ({eq: (_key,id) => ({maybeSingle: async () => ({data:impacts.get(id) ?? null,error:null})})})};
  throw new Error(`Unexpected table ${table}`);
 },
};
require('../src/lib/supabase-server.ts').createSupabaseServer = async () => supabase;
const { review } = require('../src/lib/ingestion/review.ts');
const { newsEventId } = require('../src/lib/ingestion/news-event.ts');
const { reconcileAcceptedNews } = require('../src/lib/ingestion/reconcile-news.ts');
function article(char, tickers=null) {
 const id = char.repeat(40);
 conn.prepare('INSERT INTO articles VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'source','Original headline','https://example.com/news','2026-09-27T00:00:00Z',tickers,'Original summary','Original body','2026-09-27T01:00:00Z','Publisher','{"provider":"original"}','macro',null);
 return id;
}
function decide(id, decision='accepted', extra={}) {
 return review(new NextRequest('http://localhost/api/news/accept',{method:'POST',body:JSON.stringify({articleId:id,reason:'Reviewed for relevance',...extra})}),decision);
}
test('accept news without a ticker, retain content, and do not manufacture an impact record',async () => {
 const id=article('a');
 const response=await decide(id,'accepted',{ticker:null});
 assert.equal(response.status,200);
 assert.equal(entityReads,0);
 const event=events.get(newsEventId(id));
 assert.equal(event.title,'Original headline');
 assert.equal(event.summary,'Original summary');
 assert.equal(event.entity_id,null);
 assert.equal(event.impact_score,null);
 assert.equal(event.raw.body,'Original body');
 assert.equal(event.raw.review.reason,'Reviewed for relevance');
 assert.deepEqual(event.raw.tickers,[]);
 assert.equal(impacts.size,0);
 assert.equal(storage.isReviewed(id),'accepted');
 assert.equal(storage.getArticleById(id),undefined);
});
test('accept an unknown ticker without requiring an entity',async () => {
 const id=article('b','UNKNOWN');
 assert.equal((await decide(id)).status,200);
 const event=events.get(newsEventId(id));
 assert.equal(event.entity_id,null);
 assert.deepEqual(event.raw.tickers,['UNKNOWN']);
});
test('mark an existing ticker relationship when present',async () => {
 const id=article('c','TCS');
 assert.equal((await decide(id)).status,200);
 assert.equal(events.get(newsEventId(id)).entity_id,'entity-tcs');
});
test('reject unmapped news without exporting it to NewsFinder',async () => {
 const id=article('d');
 assert.equal((await decide(id,'rejected')).status,200);
 assert.equal(events.has(newsEventId(id)),false);
 assert.equal(storage.isReviewed(id),'rejected');
});
test('failed event persistence leaves article and intent retryable, with original review data',async () => {
 const id=article('e');
 failWrite=true;
 assert.equal((await decide(id)).status,500);
 assert.ok(storage.getArticleById(id));
 assert.equal(storage.isReviewed(id),null);
 failWrite=false;
 assert.equal((await decide(id,'accepted',{reason:'Changed on retry'})).status,200);
 assert.equal(events.get(newsEventId(id)).raw.review.reason,'Reviewed for relevance');
 const size=events.size;
 assert.equal((await decide(id)).status,200);
 assert.equal(events.size,size);
});
test('recover an older pending impact decision as a standalone news event',async () => {
 const id=article('f');
 storage.reserveReview(id,'accepted','original-reviewer',{record:{company:'Legacy',entity_id:null},reason:'Original legacy reason'});
 assert.equal((await decide(id)).status,200);
 const event=events.get(newsEventId(id));
 assert.equal(event.entity_id,null);
 assert.equal(event.raw.review.reviewer_id,'original-reviewer');
 assert.equal(event.raw.review.reason,'Original legacy reason');
});
test('previously accepted reviews are restored once; rejected reviews remain excluded',async () => {
 conn.prepare('INSERT INTO article_reviews(dedupe_key,decision,headline,reason) VALUES(?,?,?,?)').run('1'.repeat(40),'accepted','Legacy headline','Legacy reason');
 conn.prepare('INSERT INTO article_reviews(dedupe_key,decision,headline,reason) VALUES(?,?,?,?)').run('2'.repeat(40),'rejected','Rejected headline','Rejected reason');
 await reconcileAcceptedNews(supabase);
 const restored=events.get(newsEventId('1'.repeat(40)));
 assert.equal(restored.title,'Legacy headline');
 assert.equal(restored.entity_id,null);
 assert.equal(restored.summary,null);
 assert.equal(events.has(newsEventId('2'.repeat(40))),false);
 const size=events.size;
 await reconcileAcceptedNews(supabase);
 assert.equal(events.size,size);
});

test('RLS rejection returns an actionable 403 and leaves the article retryable', async () => {
 const id=article('3');
 failWrite=true;
 writeErrorCode='42501';
 const response=await decide(id);
 assert.equal(response.status,403);
 assert.match((await response.json()).error,/accepted_news_insert/);
 assert.ok(storage.getArticleById(id));
 assert.equal(storage.isReviewed(id),null);
 failWrite=false;
 writeErrorCode='TEST_FAILURE';
 assert.equal((await decide(id)).status,200);
});
