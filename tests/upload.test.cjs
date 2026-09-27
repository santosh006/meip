const {test} = require('node:test');
const assert = require('node:assert/strict');
const server = require('../src/lib/supabase-server.ts');
const r2 = require('../src/lib/ingestion/r2.ts');
let row = null;
let objectWrites = 0;
let failFinalize = true;
server.createSupabaseServer = async () => ({ from: () => ({
  upsert: async data => { row ??= {...data}; return {error:null}; },
  select: () => ({eq: () => ({single: async () => ({data:row,error:null})})}),
  update: patch => ({eq: async () => { if (failFinalize) return {error: new Error('Temporary DB failure')}; Object.assign(row,patch); return {error:null}; }}),
}) });
r2.getR2Bucket = () => 'test';
r2.getR2Client = () => ({send: async command => { assert.ok(row, 'Object must have a durable index first'); assert.equal(command.input.Key,row.r2_object_key); objectWrites++; }});
const {ingestDocument} = require('../src/lib/ingestion/ingest.ts');
test('upload retries recover finalization failure and subsequent duplicates skip R2', async () => {
  const file = new File(['same bytes'], 'sample.txt', {type:'text/plain'});
  await assert.rejects(ingestDocument(file,{created_by:'user'}));
  assert.equal(row.status,'uploading');
  const id = row.doc_id;
  failFinalize = false;
  assert.equal((await ingestDocument(file,{created_by:'user'})).status,'success');
  assert.equal(row.doc_id,id);
  assert.equal(row.status,'available');
  const writes = objectWrites;
  assert.equal((await ingestDocument(file,{created_by:'user'})).status,'duplicate');
  assert.equal(objectWrites,writes);
});
