import { createSupabaseServer } from '@/lib/supabase-server';
import Shell from '@/components/Shell';
import DevPortalClient from './DevPortalClient';

export const dynamic = 'force-dynamic'; // always fetch fresh data

export default async function DevPortalPage() {
  const supabase = await createSupabaseServer();
  const { data: items } = await supabase
    .from('workspace_items')
    .select('*')
    .order('updated_at', { ascending: false });

  return (
    <Shell>
      <DevPortalClient initialItems={items ?? []} />
    </Shell>
  );
}
