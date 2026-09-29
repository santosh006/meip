import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { IMPACT_COLUMNS } from './queries';

/** One paginated query; does not require a database search function. */
export function newsQuery(
  supabase: SupabaseClient<Database>,
  { search, from, to }: { search: string; from: number; to: number },
) {
  let query = supabase.from('events').select(
    `id,title,summary,source_url,occurred_at,reported_tickers:raw->tickers,news_source:raw->>source,event_type,detected_at,entity_id,impact_direction,impact_score,confidence,affected_metrics,entity:entities(id,name,ticker),search_entity:entities(),impact_count:impact_records(count),impact_preview:impact_records(${IMPACT_COLUMNS},entity:entities(id,name,ticker))`,
    { count: 'exact' },
  );
  if (search) {
    // A separate empty embed filters by company/ticker without filtering the
    // entity displayed on events that match only their title or event type.
    query = query
      .or(`name.ilike.%${search}%,ticker.ilike.%${search}%`, { referencedTable: 'search_entity' })
      .or(`title.ilike.%${search}%,event_type.ilike.%${search}%,search_entity.not.is.null`);
  }
  return query.order('detected_at', { ascending: false }).order('id').range(from, to)
    .order('created_at', { referencedTable: 'impact_preview', ascending: false })
    .limit(5, { referencedTable: 'impact_preview' });
}
