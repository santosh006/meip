import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AppPreview() {
  const supabase = await createSupabaseServer();
  const { data: records } = await supabase
    .from('impact_records')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: entities } = await supabase
    .from('entities')
    .select('name, ticker');

  const tickerByCompany = new Map(
    (entities ?? [])
      .filter((entity) => entity.ticker)
      .map((entity) => [entity.name, entity.ticker as string]),
  );

  const dirColor = (d: string) =>
    d === 'positive' ? 'text-[#3fb950]'
    : d === 'negative' ? 'text-[#f85149]'
    : 'text-[#e3b341]';

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-1">Impact Records</h1>
      <p className="text-[#9aa7b4] mb-6">
        Live preview of the customer-facing product — real data
      </p>
      <div className="grid gap-3">
        {(records ?? []).map((r) => {
          const ticker = tickerByCompany.get(r.company) ?? r.security?.trim() ?? null;
          const card = (
            <div className="bg-[#161b22] border border-[#2b333d] rounded-xl p-5 transition-colors hover:border-[#4ea1ff]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{r.company}</div>
                {ticker && <div className="mt-1 text-xs text-[#4ea1ff]">View analysis →</div>}
              </div>
              <span className={`text-sm font-medium ${dirColor(r.direction ?? '')}`}>
                {r.direction ?? 'neutral'}
              </span>
            </div>
            <div className="text-sm text-[#9aa7b4] mt-1">
              {r.security} · {r.sector} · {r.event_type}
            </div>
            {r.summary && <p className="text-sm text-[#c9d1d9] mt-2">{r.summary}</p>}
            <div className="flex gap-2 mt-3 flex-wrap text-xs">
              <span className="px-2 py-1 rounded-full bg-[#21262d] border border-[#2b333d]">{r.event_status}</span>
              <span className="px-2 py-1 rounded-full bg-[#21262d] border border-[#2b333d]">horizon: {r.horizon}</span>
              <span className="px-2 py-1 rounded-full bg-[#21262d] border border-[#2b333d]">materiality: {r.materiality}</span>
              <span className="px-2 py-1 rounded-full bg-[#21262d] border border-[#2b333d]">confidence: {r.confidence}</span>
            </div>
            </div>
          );

          return ticker ? (
            <Link
              key={r.id}
              href={`/app/analysis1/${encodeURIComponent(ticker)}`}
              className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4ea1ff]"
            >
              {card}
            </Link>
          ) : (
            <div key={r.id}>{card}</div>
          );
        })}
      </div>
    </Shell>
  );
}
