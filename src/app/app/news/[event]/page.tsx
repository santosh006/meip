import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import NewsAnalysisClient from './NewsAnalysisClient';

type Props = {
  params: { eventId: string };
};

export default async function NewsAnalysisPage({ params }: Props) {
  const supabase = await createSupabaseServer();
  const { eventId } = params;

  // Fetch the event
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (!event) notFound();

  // Fetch all impact records for this event, joined to entities
  const { data: impactRecords } = await supabase
    .from('impact_records')
    .select(`
      *,
      entity:entities (
        id,
        name,
        ticker,
        sector
      )
    `)
    .eq('event_id', eventId)
    .order('confidence', { ascending: false });

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
    </main>
  );
}
