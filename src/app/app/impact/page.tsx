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
    .order('created_at', { ascending: false, nullsFirst: false });

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

  return <ImpactClient records={records} />;
}
