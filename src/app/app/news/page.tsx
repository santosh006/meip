import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';
import NewsFinderClient from './NewsFinderClient';

export const dynamic = 'force-dynamic';

export default async function NewsFinderPage() {
  const supabase = await createSupabaseServer();

  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .order('detected_at', { ascending: false });

  const { data: impactRecords, error: impactError } = await supabase
    .from('impact_records')
    .select('*');

  const { data: entities, error: entitiesError } = await supabase
    .from('entities')
    .select('id, name, ticker');

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-1">NewsFinder</h1>
      <p className="text-[#9aa7b4] mb-6">
        Market-moving events. Instant impact analysis.
      </p>
      {eventsError ? (
        <p className="text-sm text-[#f85149]">Failed to load events: {eventsError.message}</p>
      ) : impactError ? (
        <p className="text-sm text-[#f85149]">Failed to load impact records: {impactError.message}</p>
      ) : entitiesError ? (
        <p className="text-sm text-[#f85149]">Failed to load entities: {entitiesError.message}</p>
      ) : (
        <NewsFinderClient
          events={events ?? []}
          impactRecords={impactRecords ?? []}
          entities={entities ?? []}
        />
      )}
    </Shell>
  );
}
