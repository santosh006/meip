'use client';

import { useMemo, useState } from 'react';
import type { ImpactRecord } from './page';

const CATEGORY_COLORS: Record<string, string> = {
  growth: '#3fb950',
  revenue: '#e3b341',
  product: '#4ea1ff',
  community: '#bc8cff',
  ops: '#f85149',
};

export default function ImpactClient({ records }: { records: ImpactRecord[] }) {
  const [filter, setFilter] = useState<string>('all');

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(records.map((r) => r.category)))],
    [records]
  );

  const visible =
    filter === 'all' ? records : records.filter((r) => r.category === filter);

  const badge = (c: string) => {
    const color = CATEGORY_COLORS[c] ?? '#9aa7b4';
    return (
      <span
        className="text-[10px] uppercase px-2 py-0.5 rounded-full border"
        style={{ color, borderColor: color + '66' }}
      >
        {c}
      </span>
    );
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Impact Records</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-[#161b22] border border-[#2b333d] rounded px-2 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <p className="text-[#9aa7b4] mb-6">
        A running log of measurable outcomes and milestones.
      </p>

      {visible.length === 0 ? (
        <p className="text-[#9aa7b4] text-sm">
          No records{filter !== 'all' ? ` in “${filter}”` : ''} yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((r) => (
            <div
              key={r.id}
              className="bg-[#161b22] border border-[#2b333d] rounded-xl p-5"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  {badge(r.category)}
                  <span className="font-semibold">{r.title}</span>
                </div>
                <span className="text-xs text-[#9aa7b4] whitespace-nowrap">
                  {fmtDate(r.occurred_on)}
                </span>
              </div>

              {r.description && (
                <p className="text-sm text-[#9aa7b4] mt-2 whitespace-pre-wrap">
                  {r.description}
                </p>
              )}

              {(r.metric_label || r.metric_value) && (
                <div className="mt-3 inline-flex items-baseline gap-2 rounded-lg bg-[#0d1117] border border-[#2b333d] px-3 py-2">
                  <span className="text-lg font-bold text-[#4ea1ff]">
                    {r.metric_value ?? '—'}
                  </span>
                  <span className="text-xs text-[#9aa7b4]">
                    {r.metric_label}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
