'use client';

import { reportedTickers, safeSourceUrl } from '@/lib/news-presentation';
import type { Tables } from '@/lib/database.types';

type Entity = Pick<Tables<'entities'>, 'id' | 'name' | 'ticker' | 'sector'>;
type ImpactRecord = import('@/lib/queries').ImpactRecord & { entity: Entity | null };
type Event = Tables<'events'> & { entity?: Entity | null };

type Props = {
  event: Event;
  impactRecords: ImpactRecord[];
};

const DIRECTION_COLOR: Record<string, string> = {
  positive: 'border-green-500 text-green-400',
  negative: 'border-red-500 text-red-400',
  neutral:  'border-yellow-500 text-yellow-400',
};

const MATERIALITY_COLOR: Record<string, string> = {
  high:   'border-red-500 text-red-400',
  medium: 'border-yellow-500 text-yellow-400',
  low:    'border-green-500 text-green-400',
};

export default function NewsAnalysisClient({ event, impactRecords }: Props) {
  const materiality = event.materiality?.toLowerCase() ?? 'low';
  const direction   = event.impact_direction?.toLowerCase() ?? 'neutral';

  const raw = event.raw && typeof event.raw === 'object' && !Array.isArray(event.raw) ? event.raw : null;
  const tickers = reportedTickers(raw?.tickers);
  const sourceUrl = safeSourceUrl(event.source_url);

  return (
    <>
      <div className="mb-8 rounded-xl border border-[#2b333d] bg-[#161b22] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase text-[#9aa7b4]">
                {event.event_type}
              </span>

              {event.materiality && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                    MATERIALITY_COLOR[materiality] ?? 'border-[#2b333d] text-[#9aa7b4]'
                  }`}
                >
                  {event.materiality}
                </span>
              )}

              {event.impact_direction && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                    DIRECTION_COLOR[direction] ?? 'border-[#2b333d] text-[#9aa7b4]'
                  }`}
                >
                  {event.impact_direction}
                </span>
              )}
            </div>

            <h1 className="mt-1 text-2xl font-bold">{event.title}</h1>
          </div>

          {event.occurred_at && (
            <span className="text-sm text-[#9aa7b4]">
              {new Date(event.occurred_at).toLocaleDateString()}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm text-[#9aa7b4]">{event.entity ? `Linked ticker: ${event.entity.ticker ?? event.entity.name}` : 'No ticker link — available for post-processing.'}</p>
        {!event.entity && tickers.length > 0 && <p className="mt-2 text-sm text-[#9aa7b4]">Reported tickers: {tickers.join(', ')}</p>}
        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[#4ea1ff]">Read original source ↗</a>}
        {event.summary && (
          <p className="mt-4 text-sm text-[#9aa7b4]">{event.summary}</p>
        )}

        {event.impact_score !== null && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-[#9aa7b4]">Impact Score:</span>
            <span className="text-sm font-semibold">{event.impact_score}</span>
          </div>
        )}
      </div>

      {impactRecords.length === 0 && <p className="text-sm text-[#9aa7b4]">No impact analysis yet. News is retained independently of stock relationships.</p>}
      {/* Affected stocks */}
      <div className="space-y-3">
        {impactRecords.map((record) => (
          <div
            key={record.id}
            className="rounded-lg border border-[#2b333d] bg-[#161b22] p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">{record.entity?.ticker ?? '—'}</span>
                <span className="ml-2 text-sm text-[#9aa7b4]">{record.entity?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {record.materiality && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                      MATERIALITY_COLOR[record.materiality.toLowerCase()] ?? 'border-[#2b333d] text-[#9aa7b4]'
                    }`}
                  >
                    {record.materiality}
                  </span>
                )}
                <span className="text-sm text-[#9aa7b4]">{record.entity?.sector}</span>
              </div>
            </div>

            {record.summary && (
              <p className="mt-2 text-xs text-[#9aa7b4]">{record.summary}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
