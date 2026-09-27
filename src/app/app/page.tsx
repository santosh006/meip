import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';
import PageControls, { SearchForm } from '@/components/PageControls';
import { pagination, IMPACT_COLUMNS, PAGE_SIZE, type SearchParams } from '@/lib/queries';
import CustomerAppClient from './CustomerAppClient';
export const dynamic = 'force-dynamic';
export default async function AppPreview({ searchParams }: { searchParams: SearchParams }) {
  const { page, q, search, from, to } = await pagination(searchParams);
  const supabase = await createSupabaseServer();
  let query = supabase.from('entities').select(`id,name,ticker,sector,impact_count:impact_records(count),impact_preview:impact_records(${IMPACT_COLUMNS})`, { count: 'exact' });
  if (search) query = query.or(`name.ilike.%${search}%,ticker.ilike.%${search}%,sector.ilike.%${search}%`);
  const { data, error, count } = await query.order('name').order('id').range(from, to)
    .order('created_at', { referencedTable: 'impact_preview', ascending: false }).limit(5, { referencedTable: 'impact_preview' });
  if (error) console.error('StockFinder query failed', error);
  return <Shell>
    <h1 className="text-2xl font-bold mb-4">StockFinder</h1>
    <SearchForm q={q} placeholder="Search company, ticker, or sector" />
    {error ? <p role="alert">Unable to load stocks.</p> : <CustomerAppClient key={`${page}:${q}`} entities={data ?? []} records={(data ?? []).flatMap(e => e.impact_preview)} counts={Object.fromEntries((data ?? []).map(e => [e.id, e.impact_count[0]?.count ?? 0]))} />}
    <PageControls page={page} hasMore={page * PAGE_SIZE < (count ?? 0)} q={q} />
  </Shell>;
}
