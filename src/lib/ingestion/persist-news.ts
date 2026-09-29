import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/lib/database.types';
import { InputError } from '@/lib/api/validation';

export async function persistAcceptedNews(supabase: SupabaseClient<Database>, event: TablesInsert<'events'>) {
  const { error } = await supabase.from('events').upsert(event, { onConflict: 'id', ignoreDuplicates: true });
  if (error?.code === '42501') {
    throw new InputError(
      'Supabase has not enabled accepted-news inserts. Apply the accepted_news_insert policy on public.events, then retry. The article remains in the review queue.',
      403,
    );
  }
  if (error) throw error;
}
