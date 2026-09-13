'use client';

import Link from 'next/link';
import type { Tables } from '@/lib/database.types';

type Entity = Pick<Tables<'entities'>, 'id' | 'name' | 'ticker' | 'sector'>;
type ImpactRecord = Tables<'impact_records'> & { entity: Entity | null };
type Event = Tables<'events'>;

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
