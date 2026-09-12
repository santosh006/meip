import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';
import CustomerAppClient from './CustomerAppClient';

export const dynamic = 'force-dynamic';

export default async function AppPreview() {
  const supabase = await createSupabaseServer();
  const { data: records, error: recordsError } = await supabase
    .from('impact_records')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: entities, error: entitiesError } = await supabase
    .from('entities')
    .select('id, name, ticker, sector');

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-1">StockFinder</h1>
      <p className="text-[#9aa7b4] mb-6">
        Live preview of the customer-facing product — real data
      </p>
      {recordsError ? (
        <p className="text-sm text-[#f85149]">Failed to load impact records: {recordsError.message}</p>
      ) : entitiesError ? (
        <p className="text-sm text-[#f85149]">Failed to load stocks: {entitiesError.message}</p>
      ) : (
        <CustomerAppClient entities={entities ?? []} records={records ?? []} />
      )}
    </Shell>
  );
}
