const {test}=require('node:test');const assert=require('node:assert/strict');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const ReviewClient=require('../src/app/app/news-review/[article]/ReviewClient.tsx').default;
const Summary=require('../src/components/ReviewSummary.tsx').default;
const fixture=require('./fixtures/structured-review.cjs');
test('review page renders accessible verification fields and draft controls',()=>{const doc=fixture.document();const initial={article:{title:'Crude supply'},canReview:true,articleDecision:null,draft:null,versions:[],entities:[],securities:[],horizons:[],events:[],scores:[],observations:[],audit:[]};const html=renderToStaticMarkup(React.createElement(ReviewClient,{articleKey:'f'.repeat(40),initial,initialDocument:doc}));for(const label of ['Verify news','Map entities','Assess impact','Horizons','Preview','Verified headline','Save draft'])assert.ok(html.includes(label),label);assert.match(html,/for="[^"]+-headline"/);assert.ok(!html.includes('dangerouslySetInnerHTML'));});
test('evidence escapes content and suppresses unsafe links',()=>{const doc=fixture.document();doc.verification.headline='<script>alert(1)</script>';doc.evidence[0].fields.url='javascript:alert(1)';const html=renderToStaticMarkup(React.createElement(Summary,{document:doc}));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('uncalibrated heuristics'));});
const Guide=require('../src/components/ReviewGuide.tsx').default;
const {reviewGuide}=require('../src/lib/reviews/guide.ts');
const {specifications}=require('../src/lib/reviews/fields.ts');
test('acceptance guide covers every review field with a meaning and example',()=>{
 for(const [name,fields] of Object.entries(specifications)){
  if(name==='observation')continue;
  const group=reviewGuide.flat().find(group=>group.fields===fields);
  assert.ok(group,`Missing guide for ${name}`);
  for(const key of Object.keys(fields))assert.ok(group.help[key]?.every(text=>text.trim().length>10),`${name}.${key}`);
 }
 for(const group of reviewGuide.flat())for(const key of Object.keys(group.fields))assert.equal(group.help[key]?.length,2,`${group.title}.${key}`);
});
test('guide is collapsed by default and shows only the current step when opened',()=>{
 const closed=renderToStaticMarkup(React.createElement(Guide,{step:0,open:false,onToggle:()=>{}}));
 assert.match(closed,/aria-expanded="false"/);assert.ok(!closed.includes('Example:'));
 for(let step=0;step<reviewGuide.length;step++){
  const html=renderToStaticMarkup(React.createElement(Guide,{step,open:true,onToggle:()=>{}}));
  assert.match(html,/aria-expanded="true"/);assert.ok(html.includes('Example:'));
  assert.ok(html.includes(reviewGuide[step][0].title.replaceAll('&','&amp;')));
  if(step!==0)assert.ok(!html.includes('Verified headline'));
 }
});
test('guide is limited to editable acceptance, not rejected or read-only articles or accepted history',()=>{
 const doc=fixture.document();const initial={article:{},canReview:true,articleDecision:null,draft:null,versions:[],entities:[],securities:[],horizons:[],events:[],scores:[],observations:[],audit:[]};
 const render=overrides=>renderToStaticMarkup(React.createElement(ReviewClient,{articleKey:'f'.repeat(40),initial:{...initial,...overrides},initialDocument:doc}));
 assert.ok(render({}).includes('News acceptance guide'));
 assert.ok(!render({canReview:false}).includes('News acceptance guide'));
 assert.ok(!render({articleDecision:'rejected'}).includes('News acceptance guide'));
 assert.ok(!render({versions:[{id:'v1',version_no:1,outcome:'accepted_pending_enrichment',snapshot:doc}]}).includes('News acceptance guide'));
});
