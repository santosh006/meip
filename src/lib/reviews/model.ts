import { InputError } from '@/lib/api/validation';
import { specifications, type Fields } from './fields';
export type Values = Record<string, string | number | null>;
export type Evidence = {id:string; added_at:string; fields:Values};
export type Mapping = {id:string; fields:Values; chain:string[]; impact:Values; metrics:Values[]; horizons:Values[]; advanced:Values};
export type ReviewDocument = {verification:Values; evidence:Evidence[]; mappings:Mapping[]; event_ids:string[]};
export type Outcome = 'accepted_pending_enrichment'|'accepted_analysis_ready';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function emptyDocument(article: Record<string, unknown>): ReviewDocument {
 return {verification:{headline:String(article.title ?? ''),summary:String(article.summary ?? article.body ?? ''),category:'',verification_status:'unverified_claim',source_classification:String(article.source ?? ''),source_credibility:null,occurrence_certainty:'unknown',occurrence_at:'',novelty:'new'},evidence: article.url ? [{id:crypto.randomUUID(),added_at:new Date().toISOString(),fields:{url:String(article.url),label:String(article.title ?? ''),classification:String(article.source ?? '')}}] : [],mappings:[],event_ids:[]};
}
export function safeUrl(value: string) {
 try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;} catch {return false;}
}
export function fieldErrors(value: unknown, spec: Fields, prefix: string, complete = false): string[] {
 if (!value || typeof value!=='object'||Array.isArray(value)) return [`${prefix}: expected an object`];
 const data=value as Values; const errors:string[]=[];
 for(const key of Object.keys(data)) if(!spec[key])errors.push(`${prefix}.${key}: unsupported field`);
 for(const [key,rule] of Object.entries(spec)) {
  const v=data[key];const label=`${prefix}: ${rule.label}`;const missing=v===undefined||v===null||v==='';
  if(missing){if(complete&&rule.required)errors.push(`${label} is required`);continue;}
  if(rule.kind==='number') {if(typeof v!=='number'||!Number.isFinite(v)||(rule.min!==undefined&&v<rule.min)||(rule.max!==undefined&&v>rule.max))errors.push(`${label} is outside the permitted range`);}
  else if(typeof v!=='string'||v.length>10000) errors.push(`${label} must be text (maximum 10000 characters)`);
  else if(rule.options&&!rule.options.includes(v))errors.push(`${label}: choose a supported value`);
  else if(rule.kind==='url'&&!safeUrl(v))errors.push(`${label}: use an HTTP/HTTPS URL without credentials`);
  else if((rule.kind==='date'||rule.kind==='datetime-local')&&(!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v.slice(0,10)))errors.push(`${label}: invalid date`);
  else if(complete&&rule.required&&!v.trim())errors.push(`${label} is required`);
 }
 return errors;
}
function list(value:unknown,label:string,max=20): unknown[] {if(!Array.isArray(value)||value.length>max)throw new InputError(`${label}: expected a list of at most ${max} entries`);return value;}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new InputError('Invalid review structure');return value as Record<string,unknown>;}
export function validateDocument(value:unknown): ReviewDocument {
 const d=record(value);let errors=fieldErrors(d.verification,specifications.verification,'Verification');
 const evidence=list(d.evidence,'Evidence');const mappings=list(d.mappings,'Mappings');const eventIds=list(d.event_ids,'Related events');
 for(const id of eventIds)if(typeof id!=='string'||!UUID.test(id))errors.push('Invalid related event ID');
 const evidenceIds=new Set<string>(),mappingIds=new Set<string>();
 for(const row of evidence){const e=record(row);if(typeof e.id!=='string'||!UUID.test(e.id)||evidenceIds.has(e.id))errors.push('Evidence IDs must be unique UUIDs');else evidenceIds.add(e.id);if(typeof e.added_at!=='string'||!Number.isFinite(Date.parse(e.added_at)))errors.push('Invalid evidence timestamp');errors=errors.concat(fieldErrors(e.fields,specifications.evidence,'Evidence'));}
 for(const row of mappings){const m=record(row);if(typeof m.id!=='string'||!UUID.test(m.id)||mappingIds.has(m.id))errors.push('Mapping IDs must be unique UUIDs');else mappingIds.add(m.id);
  errors.push(...fieldErrors(m.fields,specifications.mapping,'Mapping'),...fieldErrors(m.impact,specifications.impact,'Impact'),...fieldErrors(m.advanced,specifications.advanced,'Advanced'));
  for(const step of list(m.chain,'Causal chain'))if(typeof step!=='string'||step.length>2000)errors.push('Invalid causal chain step');
  for(const metric of list(m.metrics,'Metrics')){record(metric);errors.push(...fieldErrors(metric,specifications.metric,'Metric'));const ref=(metric as Values).evidence_id;if(ref&&!evidenceIds.has(String(ref)))errors.push('Metric references missing evidence');}
  for(const horizon of list(m.horizons,'Horizons'))errors.push(...fieldErrors(horizon,specifications.horizon,'Horizon'));
  const mappingFields=record(m.fields);
  for(const key of ['entity_id','security_id']) {const id=mappingFields[key];if(id&&!UUID.test(String(id)))errors.push(`Invalid ${key}`);}
 }
 if(errors.length)throw new InputError(errors.join('\n'));
 return value as ReviewDocument;
}
export function acceptanceErrors(d:ReviewDocument,outcome:Outcome):string[]{
 const errors=fieldErrors(d.verification,specifications.verification,'Verification',true);const v=d.verification;
 if(v.occurrence_certainty!=='unknown'&&!v.occurrence_at)errors.push('Occurrence time is required unless explicitly unknown');
 if(v.occurrence_certainty==='unknown'&&v.occurrence_at)errors.push('Clear occurrence time when it is unknown');
 if(v.novelty!=='new'&&!v.related_event_id)errors.push('Related existing event is required for updates, corrections, and repeated coverage');
 if(v.related_event_id&&!UUID.test(String(v.related_event_id)))errors.push('Invalid related event ID');
 if(v.verification_status==='disputed'&&!String(v.concerns??'').trim())errors.push('Disputed claims require review concerns');
 if(!d.evidence.length)errors.push('At least one supporting source reference is required');
 d.evidence.forEach(e=>{errors.push(...fieldErrors(e.fields,specifications.evidence,'Evidence',true));if(!e.fields.url&&!e.fields.document_ref)errors.push('Evidence needs a URL or document/page reference');});
 if(outcome==='accepted_pending_enrichment')return errors;
 if(!d.mappings.length)errors.push('At least one affected entity is required');
 d.mappings.forEach((m,i)=>{const prefix=`Entity ${i+1}`;errors.push(...fieldErrors(m.fields,specifications.mapping,prefix,true),...fieldErrors(m.impact,specifications.impact,prefix,true));
  if(m.fields.exposure==='indirect'&&!m.chain.some(s=>s.trim()))errors.push(`${prefix}: indirect exposure requires an ordered causal chain`);
  if(typeof m.fields.exposure_value==='number'&&!m.fields.exposure_basis)errors.push(`${prefix}: numeric exposure needs units/basis`);
  if(m.impact.surprise!=='unknown'&&!m.impact.expectations_evidence)errors.push(`${prefix}: expectations evidence is required`);
  if(m.impact.metrics_status==='specified'&&!m.metrics.length)errors.push(`${prefix}: add affected metrics or select unknown`);
  if(m.impact.metrics_status==='unknown'&&m.metrics.length)errors.push(`${prefix}: remove metrics or select specified`);
  if((typeof m.impact.range_low==='number'||typeof m.impact.range_high==='number')&&!m.impact.range_basis)errors.push(`${prefix}: numeric magnitude needs units/supporting basis`);
  if(typeof m.impact.range_low==='number'&&typeof m.impact.range_high==='number'&&m.impact.range_low>m.impact.range_high)errors.push(`${prefix}: magnitude range is reversed`);
  m.metrics.forEach(metric=>{errors.push(...fieldErrors(metric,specifications.metric,'Metric',true));if((typeof metric.value_low==='number'||typeof metric.value_high==='number')&&(!metric.unit||!metric.baseline||!metric.period||!metric.evidence_id))errors.push('Numeric metrics require units, baseline, period, and evidence');if(typeof metric.value_low==='number'&&typeof metric.value_high==='number'&&metric.value_low>metric.value_high)errors.push('Metric range is reversed');});
  if(!m.horizons.length)errors.push(`${prefix}: at least one horizon is required`);
  const seen=new Set();m.horizons.forEach(h=>{errors.push(...fieldErrors(h,specifications.horizon,'Horizon',true));if(seen.has(h.horizon))errors.push(`${prefix}: duplicate horizon`);seen.add(h.horizon);if(h.catalyst_date&&!['exact','estimated'].includes(String(h.date_certainty)))errors.push('Catalyst date requires date certainty');if(['exact','estimated'].includes(String(h.date_certainty))&&!h.catalyst_date)errors.push('Known catalyst date certainty requires a date');});
 });return errors;
}
