'use client';
import {reviewGuide} from '@/lib/reviews/guide';

export default function ReviewGuide({step,open,onToggle}:{step:number;open:boolean;onToggle:()=>void}) {
 return <aside aria-label="News acceptance guide" className="sticky top-4 z-10 order-first self-start lg:order-last rounded-lg border border-[#30363d] bg-[#161b22] text-sm">
  <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="news-review-guide-content" className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left font-medium hover:bg-[#21262d] focus-visible:outline-2 focus-visible:outline-[#58a6ff]">
   <span>{open?'Review guide':'Guide'}</span><span aria-hidden="true">{open?'−':'+'}</span>
  </button>
  {open&&<div id="news-review-guide-content" className="max-h-[35dvh] lg:max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain border-t border-[#30363d] px-3 pb-3" tabIndex={0} aria-label="Field explanations">
   <p className="py-3 text-xs text-[#9aa7b4]">Help for this step. Expand a field for its meaning and example. Examples are illustrative; use your evidence. * marks a required field for the relevant outcome.</p>
   {reviewGuide[step]?.map(group=><section key={group.title} className="mb-4"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9aa7b4]">{group.title}</h2>{Object.entries(group.fields).map(([key,field])=><details key={key} className="border-b border-[#30363d] py-2"><summary className="cursor-pointer text-xs leading-5">{field.label}{field.required?' *':''}</summary><p className="mt-2 text-xs leading-5">{group.help[key][0]}</p><p className="mt-1 text-xs leading-5 text-[#9aa7b4]"><span className="font-medium">Example:</span> {group.help[key][1]}</p></details>)}</section>)}
  </div>}
 </aside>;
}
