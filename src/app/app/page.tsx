import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';

export default async function AppPreview() {
  const supabase = await createSupabaseServer();
  const { data: records } = await supabase
    .from('impact_records')
    .select('*')
    .order('created_at', { ascending: false });

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
        {(records ?? []).map((r: any) => (
          <div key={r.id} className="bg-[#161b22] border border-[#2b333d] rounded-xl p-5">
            <div className="flex justify-between">
              <div className="font-semibold">{r.company}</div>
              <span className={`text-sm font-medium ${dirColor(r.direction)}`}>
                {r.direction}
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
        ))}
      </div>
    </Shell>
  );
}
