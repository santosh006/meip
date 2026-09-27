import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';
import PageControls, { SearchForm } from '@/components/PageControls';
import { pagination, PAGE_SIZE, type SearchParams } from '@/lib/queries';
import { reconcileAcceptedNews } from '@/lib/ingestion/reconcile-news';
import { newsQuery } from '@/lib/news-query';
import NewsFinderClient from './NewsFinderClient';
export const dynamic = 'force-dynamic';
export default async function NewsFinderPage({ searchParams }: {searchParams: SearchParams}) {
  const { page, q, search, from, to } = await pagination(searchParams);
  const supabase = await createSupabaseServer();
  let importWarning = '';
  try {
    const { remaining } = await reconcileAcceptedNews(supabase);
    if (remaining) importWarning = 'Older accepted news is being restored. Refresh to load the next batch.';
  } catch (error) {
    console.error('Accepted news reconciliation failed', error);
    importWarning = 'Some older accepted news could not be restored. Please retry.';
  }
  const { data, error, count } = await newsQuery(supabase, { search, from, to });
  const entities = new Map((data ?? []).flatMap(e => [e.entity, ...e.impact_preview.map(r => r.entity)]).filter(e => e !== null).map(e => [e.id, e]));
  if (error) console.error('News Market query failed', error);
  return <Shell>
    <h1 className="text-2xl font-bold mb-4">News Market</h1>
    {importWarning && <p role="status" className="mb-4 text-sm text-[#e3b341]">{importWarning}</p>}
    <SearchForm q={q} placeholder="Search events, company, or ticker" />
    {error ? <p role="alert">Unable to load events.</p> : <NewsFinderClient key={`${page}:${q}`} events={data ?? []} impactRecords={(data ?? []).flatMap(e => e.impact_preview)} entities={[...entities.values()]} counts={Object.fromEntries((data ?? []).map(e => [e.id, e.impact_count[0]?.count ?? 0]))} />}
    <PageControls page={page} q={q} hasMore={page * PAGE_SIZE < (count ?? 0)} />
  </Shell>;
}
