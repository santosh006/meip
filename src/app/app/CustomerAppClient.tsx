'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { groupBy } from '@/lib/queries';
import type { Tables } from '@/lib/database.types';

type Entity = Pick<Tables<'entities'>, 'id' | 'name' | 'ticker' | 'sector'>;
type ImpactRecord = import('@/lib/queries').ImpactRecord;

type CustomerAppClientProps = {
  entities: Entity[];
  records: ImpactRecord[];
  counts: Record<string, number>;
};

export default function CustomerAppClient({ entities, records, counts }: CustomerAppClientProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const recordsByEntity = useMemo(() => groupBy(records, record => record.entity_id), [records]);
  const selectedEntity = entities.find(entity => entity.id === selectedEntityId);
  const visibleRecords = selectedEntityId ? recordsByEntity.get(selectedEntityId) ?? [] : [];
  const visibleEntities = selectedEntityId ? [] : entities;

  function clearSelection() {
    setSelectedEntityId(null);
    setIsOverlayOpen(false);
  }

  function openAnalysis(entityId: string) {
    setSelectedEntityId(entityId);
    setIsOverlayOpen(true);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedEntityId(null);
        setIsOverlayOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {selectedEntity && (
        <div className="mb-6 flex items-center justify-between rounded border border-[#4ea1ff66] bg-[#161b22] px-4 py-3 text-sm">
          <span>
            Showing analysis for <strong>{selectedEntity.name}</strong>
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[#4ea1ff] hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="grid gap-3">
        {visibleEntities.map((entity) => {
          const recordCount = counts[entity.id] ?? 0;
          return (
            <button
              key={entity.id}
              type="button"
              onClick={() => openAnalysis(entity.id)}
              className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#4ea1ff]"
            >
              <div className="rounded-xl border border-[#2b333d] bg-[#161b22] p-5 transition-colors hover:border-[#4ea1ff]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{entity.name}</div>
                    <div className="mt-1 text-xs text-[#9aa7b4]">
                      {entity.ticker ?? 'No ticker'}
                      {entity.sector ? ` · ${entity.sector}` : ''}
                    </div>
                  </div>
                  <span className="text-xs text-[#9aa7b4]">
                    {recordCount} {recordCount === 1 ? 'record' : 'records'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-[#4ea1ff]">Open analysis →</div>
              </div>
            </button>
          );
        })}
      </div>

      {visibleEntities.length === 0 && !selectedEntityId && (
        <p className="text-sm text-[#9aa7b4]" role="status">
          No stocks found.
        </p>
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
                <p className="text-xs uppercase text-[#9aa7b4]">
                  {selectedEntity.sector ?? 'Stock analysis'}
                </p>
                <h2 id="stock-analysis-title" className="text-2xl font-bold">
                  {selectedEntity.name}
                </h2>
                <p className="text-sm text-[#9aa7b4]">{selectedEntity.ticker ?? 'No ticker'}</p>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="text-2xl text-[#9aa7b4] hover:text-white"
                aria-label="Close analysis"
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid gap-4">
              <Link className="text-[#4ea1ff]" href={`/app/analysis/${selectedEntity.id}`}>View all {counts[selectedEntity.id] ?? 0} impact records →</Link>
              <p className="text-xs text-[#9aa7b4]">Latest impact records</p>
              {visibleRecords.length === 0 ? (
                <p className="text-sm text-[#9aa7b4]">
                  No impact records found for this stock.
                </p>
              ) : (
                visibleRecords.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-lg border border-[#2b333d] bg-[#0d1117] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{record.event_type ?? 'Impact event'}</h3>
                        <p className="mt-2 text-sm text-[#c9d1d9]">
                          {record.summary ?? 'No summary available.'}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          record.direction === 'positive'
                            ? 'text-[#3fb950]'
                            : record.direction === 'negative'
                              ? 'text-[#f85149]'
                              : 'text-[#e3b341]'
                        }`}
                      >
                        {record.direction ?? 'uncertain'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#9aa7b4]">
                      <span>Materiality: {record.materiality ?? '—'}</span>
                      <span>
                        Confidence:{' '}
                        {record.confidence === null
                          ? '—'
                          : `${Math.round(record.confidence * 100)}%`}
                      </span>
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
