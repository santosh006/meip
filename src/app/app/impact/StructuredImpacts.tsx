import Link from 'next/link';
import {createSupabaseServer} from '@/lib/supabase-server';
import {reviewRpc,type Version} from '@/lib/reviews/api';
import ReviewSummary,{ReviewLink} from '@/components/ReviewSummary';
type Feed=Version&{entities:Record<string,string>;scores:{mapping_id:string;horizon_id:string|null;output:Record<string,unknown>}[]};
export default async function StructuredImpacts({mode,q,offset}:{mode:string;q:string;offset:number}){
 let rows:Feed[];
 try{rows=await reviewRpc<Feed[]>(await createSupabaseServer(),'feed',{mode,q,offset});}catch(error){return <p role="alert">{error instanceof Error?error.message:'Unable to load structured reviews'}</p>;}
 return <section className="mb-8 space-y-4"><h1 className="text-2xl font-semibold">Reviewed impact assessments</h1><nav className="flex gap-4"><Link href={`/app/impact?q=${encodeURIComponent(q)}`} className="text-[#58a6ff]">Analysis ready</Link><Link href={`/app/impact?mode=pending&q=${encodeURIComponent(q)}`} className="text-[#58a6ff]">Enrichment pending</Link></nav><p>{mode==='pending'?'Valid news awaiting complete analysis; these are not completed scored results.':'Latest analysis-ready review versions. Unscored outputs remain explicitly labeled.'}</p>{!rows.length&&<p>No {mode==='pending'?'enrichment-pending':'analysis-ready'} reviews yet.</p>}
 {rows.slice(0,25).map(v=><article key={v.id} className="space-y-3 rounded border border-[#30363d] p-4"><p>Version {v.version_no} · accepted {v.accepted_at} · {v.outcome.replaceAll('_',' ')}</p><ReviewSummary document={v.snapshot} entities={v.entities}/>{v.scores.filter(s=>!s.horizon_id).map(s=><p key={s.mapping_id}>Rules score: {String(s.output.status)} · magnitude {String(s.output.magnitude??'unknown')}/100 · significance {String(s.output.significance??'unknown')} · {String(s.output.version)}. {String(s.output.rationale)}</p>)}{mode==='pending'&&<details><summary>Missing analysis requirements</summary><ul>{v.missing_analysis.map((e,i)=><li key={i}>{e}</li>)}</ul></details>}<ReviewLink article={v.article_key}/></article>)}
 <nav className="flex gap-4">{offset>0&&<Link href={`/app/impact?mode=${mode}&q=${encodeURIComponent(q)}&page=${Math.max(1,offset/25)}`}>Previous reviews</Link>}{rows.length>25&&<Link href={`/app/impact?mode=${mode}&q=${encodeURIComponent(q)}&page=${offset/25+2}`}>Next reviews</Link>}</nav></section>;
}
