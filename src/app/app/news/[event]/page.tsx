import PageControls from '@/components/PageControls';
import { pagination, IMPACT_COLUMNS, EVENT_COLUMNS, PAGE_SIZE, type SearchParams } from '@/lib/queries';
import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import NewsAnalysisClient from './NewsAnalysisClient';

type Props = {
  searchParams: SearchParams;
  params: Promise<{ event: string }>;
};

export default async function NewsAnalysisPage({ params, searchParams }: Props) {
  const supabase = await createSupabaseServer();
  const { event: eventId } = await params;

  const { page, from, to } = await pagination(searchParams);
  const [eventResult, recordsResult] = await Promise.all([
    supabase.from('events').select(`${EVENT_COLUMNS},entity:entities(id,name,ticker,sector)`).eq('id', eventId).maybeSingle(),
    supabase.from('impact_records').select(`${IMPACT_COLUMNS},entity:entities(id,name,ticker,sector)`, { count: 'exact' }).eq('event_id', eventId)
      .order('confidence', { ascending: false }).order('id').range(from, to),
  ]);
  const { data: event, error } = eventResult;
  if (error || recordsResult.error) return <p>Unable to load event analysis.</p>;
  if (!event) notFound();
  const impactRecords = recordsResult.data;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Back nav */}
      <Link
        href="/app/news"
        className="mb-8 inline-flex items-center gap-1 text-sm text-[#9aa7b4] hover:text-white"
      >
        ← Back to NewsFinder
      </Link>

      <NewsAnalysisClient event={event} impactRecords={impactRecords ?? []} />
      <PageControls page={page} hasMore={page * PAGE_SIZE < (recordsResult.count ?? 0)} />
    </main>
  );
}
