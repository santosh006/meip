const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
process.env.NEWS_STORAGE = 'supabase';
const server = require('../src/lib/supabase-server.ts');
let calls = [];
let fail = null;
const client = {
 auth: { getUser: async () => ({ data: { user: {id: 'reviewer'} }, error: null }) },
 rpc: async (name, args) => {
  calls.push([name, args]);
  if (fail) return {data:null,error:fail};
  const responses = { sources: {sources:[]}, preview: [], enqueue: {jobId:'job',status:'queued'}, job: {job:null},
    article: { article: {dedupe_key:'a'.repeat(40), title:'Unmapped', tickers:null, fetched_at:'2026-09-28T00:00:00Z'}, decision:null },
    review: {ok:true} };
  return {data:responses[args.action], error:null};
 },
 from: () => { throw new Error('Unmapped news must not need an entity lookup'); },
};
server.createSupabaseServer = async () => client;
const sources = require('../src/app/api/news/sources/route.ts');
const preview = require('../src/app/api/news/preview/route.ts');
const ingest = require('../src/app/api/news/ingest/route.ts');
const accept = require('../src/app/api/news/accept/route.ts');
const { reconcileAcceptedNews } = require('../src/lib/ingestion/reconcile-news.ts');
const req = (path, body) => new NextRequest('http://localhost/api/news/'+path, body ? {method:'POST',body:JSON.stringify(body)} : {});
test('hosted routes use Supabase without opening local SQLite', async () => {
 calls=[];
 assert.equal((await sources.GET(req('sources'))).status,200);
 assert.equal((await preview.GET(req('preview'))).status,200);
 assert.equal((await ingest.POST(req('ingest',{ticker:'TCS'}))).status,202);
 assert.equal((await ingest.GET(req('ingest'))).status,200);
 assert.equal((await accept.POST(req('accept',{articleId:'a'.repeat(40)}))).status,409);
 await require('../src/lib/ingestion/hosted.ts').hostedReview(client,'reviewer',{articleId:'a'.repeat(40)},'accepted');
 const review = calls.find(([,args]) => args.action==='review')[1];
 assert.equal(review.args.event.entity_id,null);
 assert.equal(review.args.event.raw.review.decision,'accepted');
 assert.deepEqual(await reconcileAcceptedNews(client),{remaining:false});
 assert.deepEqual(calls.map(([,args]) => args.action),['sources','preview','enqueue','job','article','review']);
});
test('missing migration and offline worker produce actionable responses', async () => {
 fail={code:'PGRST202'};
 let response=await sources.GET(req('sources'));
 assert.equal(response.status,503);
 assert.match((await response.json()).error,/migration/);
 fail={code:'PT503',message:'News worker is offline'};
 response=await sources.GET(req('sources'));
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,fail.message);
 fail=null;
});
