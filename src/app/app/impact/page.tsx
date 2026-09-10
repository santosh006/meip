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

export default async function ImpactPage() {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('impact_records')
    .select('*')
    .order('occurred_on', { ascending: false, nullsFirst: false });

  if (error) {
    return (
      <div className="text-[#f85149] text-sm">
        Failed to load Impact Records: {error.message}
      </div>
    );
  }

  const records: ImpactRecord[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.headline,
    category: row.direction,
    description: row.rationale ?? '',
    metric_label: 'Impact score',
    metric_value: String(row.impact_score),
    occurred_on: row.occurred_at,
    created_at: row.created_at ?? '',
  }));

  return <ImpactClient records={records} />;
}
