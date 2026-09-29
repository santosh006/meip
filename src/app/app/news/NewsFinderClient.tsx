'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { reportedTickers, safeSourceUrl } from '@/lib/news-presentation';
import { groupBy } from '@/lib/queries';
import type { Tables } from '@/lib/database.types';

// ── Types (aligned to actual DB schema) ───────────────────────────────────────

type Entity = Pick<Tables<'entities'>, 'id' | 'name' | 'ticker'>;
type ImpactRecord = import('@/lib/queries').ImpactRecord;
type Event = Pick<Tables<'events'>, 'id' | 'title' | 'summary' | 'source_url' | 'occurred_at' | 'event_type' | 'detected_at' | 'entity_id' | 'impact_direction' | 'impact_score' | 'confidence' | 'affected_metrics'> & { reported_tickers?: import('@/lib/database.types').Json; news_source?: string | null };

interface NewsFinderClientProps {
  events: Event[];
  impactRecords: ImpactRecord[];
  entities: Entity[];
  counts: Record<string, number>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewsFinderClient({ events, impactRecords, entities, counts }: NewsFinderClientProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const entityMap = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const recordsByEvent = useMemo(() => groupBy(impactRecords, record => record.event_id), [impactRecords]);

  const enrichedEvents = useMemo(() =>
    events.map((event) => ({
      ...event,
      entity: event.entity_id ? (entityMap.get(event.entity_id) ?? null) : null,
      records: recordsByEvent.get(event.id) ?? [],
      tickers: reportedTickers(event.reported_tickers),
    })),
    [events, recordsByEvent, entityMap],
  );

  const selectedEvent = enrichedEvents.find(e => e.id === selectedEventId) ?? null;
  const visibleEvents = selectedEventId ? [] : enrichedEvents;

  function clearSelection() {
    setSelectedEventId(null);
    setIsOverlayOpen(false);
  }

  function openAnalysis(eventId: string) {
    setSelectedEventId(eventId);
    setIsOverlayOpen(true);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Selection Banner */}
      {selectedEvent && (
        <div className="mb-6 flex items-center justify-between rounded border border-[#4ea1ff66] bg-[#161b22] px-4 py-3 text-sm">
          <span>Showing news: <strong>{selectedEvent.title}</strong></span>
          <button type="button" onClick={clearSelection} className="text-[#4ea1ff] hover:underline">
            Clear selection
          </button>
        </div>
      )}

      {/* Event Cards */}
      <div className="grid gap-3">
        {visibleEvents.map((event) => (
          <button key={event.id} type="button" onClick={() => openAnalysis(event.id)}
            className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#4ea1ff]">
            <div className="rounded-xl border border-[#2b333d] bg-[#161b22] p-5 transition-colors hover:border-[#4ea1ff]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{event.title}</div>
                  {event.summary && <p className="mt-2 text-sm text-[#9aa7b4] line-clamp-3">{event.summary}</p>}
                  <div className="mt-1 text-xs text-[#9aa7b4]">
                    {event.occurred_at?.slice(0, 10) ?? event.detected_at?.slice(0, 10) ?? '—'}
                    {event.entity ? ` · Linked: ${event.entity.ticker ?? event.entity.name}` : ' · No ticker link'}
                    {event.tickers.length > 0 && !event.entity && ` · Reported tickers: ${event.tickers.join(', ')}`}
                    {event.news_source && ` · ${event.news_source}`}
                    {event.impact_direction ? ` · ${event.impact_direction}` : ''}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[#9aa7b4]">
                  {(counts[event.id] ?? 0)} {(counts[event.id] ?? 0) === 1 ? 'impact' : 'impacts'}
                </span>
              </div>
              <div className="mt-2 text-xs text-[#4ea1ff]">Read news →</div>
            </div>
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 && !selectedEventId && (
        <p className="text-sm text-[#9aa7b4]">No accepted news found.</p>
      )}

      {/* Modal Overlay */}
      {isOverlayOpen && selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog" aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[#2b333d] bg-[#161b22] p-6 shadow-2xl">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#2b333d] pb-4">
              <div>
                <p className="text-xs uppercase text-[#9aa7b4]">
                  {selectedEvent.entity ? `Linked: ${selectedEvent.entity.ticker ?? selectedEvent.entity.name}` : 'No ticker link'}
                </p>
                <h2 className="text-2xl font-bold">{selectedEvent.title}</h2>
                <p className="text-sm text-[#9aa7b4]">
                  {selectedEvent.detected_at?.slice(0, 10) ?? '—'}
                  {selectedEvent.impact_direction ? ` · ${selectedEvent.impact_direction}` : ''}
                  {selectedEvent.confidence !== null ? ` · ${Math.round(selectedEvent.confidence * 100)}% confidence` : ''}
                </p>
              </div>
              <button type="button" onClick={clearSelection}
                className="text-2xl text-[#9aa7b4] hover:text-white" aria-label="Close">
                ×
              </button>
            </div>

            {selectedEvent.summary && <p className="mt-5 whitespace-pre-wrap text-sm">{selectedEvent.summary}</p>}
            {!selectedEvent.entity && selectedEvent.tickers.length > 0 && <p className="mt-3 text-sm text-[#9aa7b4]">Reported tickers: {selectedEvent.tickers.join(', ')}. Entity links can be added later.</p>}
            {safeSourceUrl(selectedEvent.source_url) && <a className="mt-4 inline-block text-[#4ea1ff]" href={safeSourceUrl(selectedEvent.source_url)!} target="_blank" rel="noopener noreferrer">Read original source ↗</a>}

            {/* Impact Records */}
            <div className="mt-5 grid gap-4">
              <Link className="text-[#4ea1ff]" href={`/app/news/${selectedEvent.id}`}>News details →</Link>
              <p className="text-xs text-[#9aa7b4]">Latest impact records</p>
              {selectedEvent.records.length === 0 ? (
                <p className="text-sm text-[#9aa7b4]">No impact analysis yet. This article is available for post-processing.</p>
              ) : (
                selectedEvent.records.map((record) => {
                  const entity = record.entity_id ? entityMap.get(record.entity_id) : null;
                  return (
                    <article key={record.id} className="rounded-lg border border-[#2b333d] bg-[#0d1117] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">
                            {entity?.name ?? record.company ?? record.security ?? 'Unknown entity'}
                          </h3>
                          <p className="mt-2 text-sm text-[#c9d1d9]">
                            {record.summary ?? 'No summary available.'}
                          </p>
                        </div>
                        <span className={`shrink-0 text-sm font-medium ${
                          record.direction === 'positive' ? 'text-[#3fb950]'
                          : record.direction === 'negative' ? 'text-[#f85149]'
                          : 'text-[#e3b341]'
                        }`}>
                          {record.direction ?? 'uncertain'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#9aa7b4]">
                        <span>Materiality: {record.materiality ?? '—'}</span>
                        <span>Confidence: {record.confidence !== null ? `${Math.round(record.confidence * 100)}%` : '—'}</span>
                        <span>Horizon: {record.horizon ?? '—'}</span>
                        <span>Status: {record.event_status ?? '—'}</span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
