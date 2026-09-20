'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';

// ── Types (aligned to actual DB schema) ───────────────────────────────────────

type Entity = {
  id: string;
  name: string;
  ticker: string | null;
};

type ImpactRecord = {
  id: string;
  event_id: string | null;
  entity_id: string | null;
  direction: string | null;
  materiality: string | null;
  confidence: number | null;
  horizon: string | null;
  event_status: string | null;
  summary: string | null;
  company: string | null;
  security: string | null;
};

type Event = {
  id: string;
  event_type: string;
  detected_at: string | null;
  entity_id: string | null;
  impact_direction: string | null;
  impact_score: number | null;
  confidence: number | null;
  affected_metrics: unknown;
};

interface NewsFinderClientProps {
  events: Event[];
  impactRecords: ImpactRecord[];
  entities: Entity[];
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NewsFinderClient({ events, impactRecords, entities }: NewsFinderClientProps) {
  const [query, setQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const isSearching = query.trim().toLowerCase() !== deferredQuery;

  const entityMap = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const enrichedEvents = useMemo(() =>
    events.map((event) => ({
      ...event,
      entity: event.entity_id ? (entityMap.get(event.entity_id) ?? null) : null,
      records: impactRecords.filter((r) => r.event_id === event.id),
    })),
    [events, impactRecords, entityMap],
  );

  const suggestions = useMemo(() => {
    if (!deferredQuery) return [];
    return enrichedEvents
      .filter((event) =>
        [event.event_type, event.entity?.name, event.entity?.ticker]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(deferredQuery)),
      )
      .slice(0, 8);
  }, [deferredQuery, enrichedEvents]);

  const selectedEvent = enrichedEvents.find((e) => e.id === selectedEventId) ?? null;

  const visibleEvents = useMemo(() => {
    if (selectedEventId) return [];
    if (deferredQuery) return suggestions;
    return enrichedEvents;
  }, [selectedEventId, deferredQuery, suggestions, enrichedEvents]);

  function clearSelection() {
    setSelectedEventId(null);
    setIsOverlayOpen(false);
    setQuery('');
  }

  function openAnalysis(eventId: string) {
    setSelectedEventId(eventId);
    setIsOverlayOpen(true);
    setQuery('');
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Search Bar */}
      <div className="relative mb-6 ml-auto w-full max-w-md">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedEventId(null); }}
            placeholder="Search events or entities"
            autoComplete="off"
            className="min-w-0 flex-1 rounded border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm outline-none focus:border-[#4ea1ff]"
          />
          {(query || selectedEventId) && (
            <button type="button" onClick={clearSelection}
              className="rounded border border-[#2b333d] px-3 py-2 text-sm text-[#9aa7b4] hover:text-white">
              Clear
            </button>
          )}
        </div>

        {isSearching && <p className="mt-2 text-sm text-[#9aa7b4]">Searching…</p>}
        {!isSearching && deferredQuery && suggestions.length === 0 && (
          <p className="mt-2 text-sm text-[#9aa7b4]">No events found.</p>
        )}

        {!isSearching && suggestions.length > 0 && !selectedEventId && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-[#2b333d] bg-[#161b22] shadow-lg">
            {suggestions.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => openAnalysis(event.id)}
                  className="block w-full px-3 py-3 text-left hover:bg-[#1c2430]">
                  <span className="block font-medium">{event.event_type}</span>
                  <span className="text-xs text-[#9aa7b4]">
                    {event.detected_at?.slice(0, 10) ?? '—'}
                    {event.entity ? ` · ${event.entity.name}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selection Banner */}
      {selectedEvent && (
        <div className="mb-6 flex items-center justify-between rounded border border-[#4ea1ff66] bg-[#161b22] px-4 py-3 text-sm">
          <span>Showing analysis for <strong>{selectedEvent.event_type}</strong></span>
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
                  <div className="font-semibold">{event.event_type}</div>
                  <div className="mt-1 text-xs text-[#9aa7b4]">
                    {event.detected_at?.slice(0, 10) ?? '—'}
                    {event.entity ? ` · ${event.entity.name}` : ''}
                    {event.impact_direction ? ` · ${event.impact_direction}` : ''}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[#9aa7b4]">
                  {event.records.length} {event.records.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              <div className="mt-2 text-xs text-[#4ea1ff]">Open analysis →</div>
            </div>
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 && !deferredQuery && !selectedEventId && (
        <p className="text-sm text-[#9aa7b4]">No events found.</p>
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
                  {selectedEvent.entity?.name ?? 'Market Event'}
                </p>
                <h2 className="text-2xl font-bold">{selectedEvent.event_type}</h2>
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

            {/* Impact Records */}
            <div className="mt-5 grid gap-4">
              {selectedEvent.records.length === 0 ? (
                <p className="text-sm text-[#9aa7b4]">No impact records for this event.</p>
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
