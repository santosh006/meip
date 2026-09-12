'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { Tables } from '@/lib/database.types';

type Entity = Pick<Tables<'entities'>, 'id' | 'name' | 'ticker' | 'sector'>;
type ImpactRecord = Tables<'impact_records'>;

type CustomerAppClientProps = {
  entities: Entity[];
  records: ImpactRecord[];
};

export default function CustomerAppClient({ entities, records }: CustomerAppClientProps) {
  const [query, setQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const isSearching = query.trim().toLowerCase() !== deferredQuery;

  const suggestions = useMemo(() => {
    if (!deferredQuery) return [];

    return entities
      .filter((entity) =>
        [entity.name, entity.ticker, entity.sector]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(deferredQuery)),
      )
      .slice(0, 8);
  }, [deferredQuery, entities]);

  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);
  const entityByName = useMemo(
    () => new Map(entities.map((entity) => [entity.name, entity])),
    [entities],
  );
  const visibleRecords = selectedEntity
    ? records.filter((record) => record.company === selectedEntity.name)
    : records;

  function clearSelection() {
    setSelectedEntityId(null);
    setIsOverlayOpen(false);
    setQuery('');
  }

  function openAnalysis(entityId: string) {
    setSelectedEntityId(entityId);
    setIsOverlayOpen(true);
    setQuery('');
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedEntityId(null);
        setIsOverlayOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <div className="relative mb-6 ml-auto w-full max-w-md">
        <div className="flex gap-2">
          <input
            id="stock-search"
            aria-label="Search stocks by company or ticker"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedEntityId(null);
            }}
            placeholder="Search company or ticker"
            autoComplete="off"
            className="min-w-0 flex-1 rounded border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm outline-none focus:border-[#4ea1ff]"
          />
          {(query || selectedEntityId) && (
            <button
              type="button"
              onClick={clearSelection}
              className="rounded border border-[#2b333d] px-3 py-2 text-sm text-[#9aa7b4] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {isSearching && (
          <p className="mt-2 text-sm text-[#9aa7b4]" role="status">
            Searching…
          </p>
        )}

        {!isSearching && deferredQuery && suggestions.length === 0 && (
          <p className="mt-2 text-sm text-[#9aa7b4]" role="status">
            No stocks found.
          </p>
        )}

        {!isSearching && suggestions.length > 0 && !selectedEntityId && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded border border-[#2b333d] bg-[#161b22] shadow-lg" role="listbox">
            {suggestions.map((entity) => (
              <li key={entity.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => openAnalysis(entity.id)}
                  className="block w-full px-3 py-3 text-left hover:bg-[#1c2430] focus:bg-[#1c2430] focus:outline-none"
                >
                  <span className="block font-medium">{entity.name}</span>
                  <span className="text-xs text-[#9aa7b4]">
                    {entity.ticker ?? 'No ticker'}{entity.sector ? ` · ${entity.sector}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedEntity && (
        <div className="mb-6 flex items-center justify-between rounded border border-[#4ea1ff66] bg-[#161b22] px-4 py-3 text-sm">
          <span>Showing analysis for <strong>{selectedEntity.name}</strong></span>
          <button type="button" onClick={clearSelection} className="text-[#4ea1ff] hover:underline">
            Clear selection
          </button>
        </div>
      )}

      <div className="grid gap-3">
        {visibleRecords.map((record) => {
          const entity = entityByName.get(record.company);
          const sentiment = record.direction?.toLowerCase() ?? 'uncertain';
          const sentimentColor = sentiment === 'positive'
            ? 'text-[#3fb950]'
            : sentiment === 'negative'
              ? 'text-[#f85149]'
              : 'text-[#e3b341]';
          const card = (
            <div className="rounded-xl border border-[#2b333d] bg-[#161b22] p-5 transition-colors hover:border-[#4ea1ff]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{record.company}</div>
                  {entity && <div className="mt-1 text-xs text-[#4ea1ff]">Open analysis →</div>}
                </div>
                <span className={`text-sm font-medium ${sentimentColor}`}>
                  {record.direction ?? 'uncertain'}
                </span>
              </div>
              <div className="mt-1 text-sm text-[#9aa7b4]">
                  {record.security ?? '—'} · {record.sector ?? '—'}
              </div>
            </div>
          );

          return entity ? (
            <button
              key={record.id}
              type="button"
              onClick={() => openAnalysis(entity.id)}
              className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#4ea1ff]"
            >
              {card}
            </button>
          ) : (
            <div key={record.id}>{card}</div>
          );
        })}
      </div>

      {visibleRecords.length === 0 && (
        <p className="text-sm text-[#9aa7b4]" role="status">No impact records found.</p>
      )}

      {isOverlayOpen && selectedEntity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-analysis-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) clearSelection();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[#2b333d] bg-[#161b22] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#2b333d] pb-4">
              <div>
                <p className="text-xs uppercase text-[#9aa7b4]">{selectedEntity.sector ?? 'Stock analysis'}</p>
                <h2 id="stock-analysis-title" className="text-2xl font-bold">{selectedEntity.name}</h2>
                <p className="text-sm text-[#9aa7b4]">{selectedEntity.ticker ?? 'No ticker'}</p>
              </div>
              <button type="button" onClick={clearSelection} className="text-2xl text-[#9aa7b4] hover:text-white" aria-label="Close analysis">×</button>
            </div>
            <div className="mt-5 grid gap-4">
              {visibleRecords.length === 0 ? (
                <p className="text-sm text-[#9aa7b4]">No impact records found for this stock.</p>
              ) : (
                visibleRecords.map((record) => (
                  <article key={record.id} className="rounded-lg border border-[#2b333d] bg-[#0d1117] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{record.event_type ?? 'Impact event'}</h3>
                        <p className="mt-2 text-sm text-[#c9d1d9]">{record.summary ?? 'No summary available.'}</p>
                      </div>
                      <span className={`text-sm font-medium ${record.direction === 'positive' ? 'text-[#3fb950]' : record.direction === 'negative' ? 'text-[#f85149]' : 'text-[#e3b341]'}`}>
                        {record.direction ?? 'uncertain'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#9aa7b4]">
                      <span>Materiality: {record.materiality ?? '—'}</span>
                      <span>Confidence: {record.confidence === null ? '—' : `${Math.round(record.confidence * 100)}%`}</span>
                      <span>Horizon: {record.horizon ?? '—'}</span>
                      <span>Status: {record.event_status ?? '—'}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
