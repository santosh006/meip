import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';

interface AnalysisPageProps {
  params: Promise<{ entityId: string }>;
}

export default async function EntityAnalysisPage({ params }: AnalysisPageProps) {
  const supabase = await createSupabaseServer();
  const { entityId } = await params;

  const { data: entity, error: entityError } = await supabase
    .from('entities')
    .select('id, name, ticker, sector')
    .eq('id', entityId)
    .maybeSingle();

  if (entityError) {
    return <p className="p-8 text-red-600">Failed to load entity: {entityError.message}</p>;
  }

  if (!entity) return notFound();

  const { data: impactRecords, error: recordsError } = await supabase
    .from('impact_records')
    .select('*')
    .eq('company', entity.name)
    .order('created_at', { ascending: false, nullsFirst: false });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">{entity.sector ?? 'Unknown sector'}</p>
        <h1 className="text-2xl font-bold text-gray-900">{entity.name}</h1>
        <p className="text-sm text-gray-500">{entity.ticker ?? 'No ticker'}</p>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-4">Impact Records</h2>
        {recordsError ? (
          <p className="text-sm text-red-600">Failed to load impact records: {recordsError.message}</p>
        ) : !impactRecords || impactRecords.length === 0 ? (
          <p className="text-sm text-gray-500">No impact records found for this stock.</p>
        ) : (
          <div className="space-y-4">
            {impactRecords.map((record) => (
              <article key={record.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{record.event_type ?? 'Impact event'}</h3>
                    <p className="text-sm text-gray-600">{record.summary ?? 'No summary available.'}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                    {record.direction ?? 'neutral'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                  <span>Materiality: {record.materiality ?? '—'}</span>
                  <span>Confidence: {record.confidence === null ? '—' : `${Math.round(record.confidence * 100)}%`}</span>
                  <span>Horizon: {record.horizon ?? '—'}</span>
                  <span>Status: {record.event_status ?? '—'}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
