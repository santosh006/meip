import PageControls, { SearchForm } from '@/components/PageControls';
import { pagination, PAGE_SIZE, type SearchParams } from '@/lib/queries';
import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';
import DevPortalClient from './DevPortalClient';

export const dynamic = 'force-dynamic'; // always fetch fresh data

export default async function DevPortalPage({ searchParams }: {searchParams: SearchParams}) {
  const supabase = await createSupabaseServer();
  const { page, q, search, from, to } = await pagination(searchParams);
  let query = supabase.from('workspace_items').select('id,kind,title,content,tags,data,pinned,created_at,updated_at', { count: 'exact' });
  if (search) query = query.ilike('title', `%${search}%`);
  const { data: items, error, count } = await query.order('updated_at', { ascending: false }).order('id').range(from, to);

  return (
    <Shell>
      <SearchForm q={q} placeholder="Search workspace titles" />
      {error ? <p role="alert">Unable to load workspace.</p> : <DevPortalClient key={`${page}:${q}`} initialItems={items ?? []} />}
      <PageControls page={page} q={q} hasMore={page * PAGE_SIZE < (count ?? 0)} />
    </Shell>
  );
}
