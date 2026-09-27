import PageControls, { SearchForm } from '@/components/PageControls';
import { pagination, PAGE_SIZE, type SearchParams } from '@/lib/queries';
import Shell from '@/components/Shell';
import { createSupabaseServer } from '@/lib/supabase-server';
import ImpactClient from './ImpactClient';

export const dynamic = 'force-dynamic';

export type ImpactRecord = {
  id: string;
  title: string;
  category: string;
  description: string;
  metric_label: string | null;
  metric_value: string | null;
  occurred_on: string | null;
  created_at: string;
};

export default async function ImpactPage({ searchParams }: {searchParams: SearchParams}) {
  const supabase = await createSupabaseServer();

  const { page, q, search, from, to } = await pagination(searchParams);
  let query = supabase.from('impact_records').select('id,company,direction,summary,materiality,confidence,created_at', { count: 'exact' });
  if (search) query = query.or(`company.ilike.%${search}%,direction.ilike.%${search}%,summary.ilike.%${search}%`);
  const { data, error, count } = await query.order('created_at', { ascending: false, nullsFirst: false }).order('id').range(from, to);

  if (error) {
    return (
      <div className="text-[#f85149] text-sm">
        Failed to load Impact Records: {error.message}
      </div>
    );
  }

  const records: ImpactRecord[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.company,
    category: row.direction ?? 'neutral',
    description: row.summary ?? '',
    metric_label: row.materiality ? 'Materiality' : 'Confidence',
    metric_value: row.materiality ?? (
      row.confidence === null ? null : `${Math.round(row.confidence * 100)}%`
    ),
    occurred_on: row.created_at,
    created_at: row.created_at ?? '',
  }));

  return <Shell><SearchForm q={q} placeholder="Search company, direction, or summary" /><ImpactClient records={records} /><PageControls page={page} q={q} hasMore={page * PAGE_SIZE < (count ?? 0)} /></Shell>;
}
