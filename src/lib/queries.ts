import type { Tables } from './database.types';
export const PAGE_SIZE = 25;
export const IMPACT_COLUMNS = 'id,company,confidence,created_at,dedupe_key,direction,entity_id,event_id,event_status,event_type,evidence_url,horizon,materiality,sector,security,summary' as const;
export const EVENT_COLUMNS = 'id,title,event_type,detected_at,occurred_at,entity_id,impact_direction,impact_score,confidence,materiality,summary,affected_metrics,rationale,significance,source_id,source_url,raw' as const;
export type ImpactRecord = Omit<Tables<'impact_records'>, 'headline' | 'publisher' | 'published_at' | 'source' | 'kind' | 'tickers' | 'sentiment_label' | 'raw'>;
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export async function pagination(searchParams: SearchParams) {
  const p = await searchParams;
  const page = typeof p.page === 'string' && /^\d+$/.test(p.page) ? Math.min(100000, Math.max(1, Number(p.page))) : 1;
  const q = typeof p.q === 'string' ? p.q.trim().slice(0, 100) : '';
  // Exclude PostgREST grammar and LIKE wildcards from search fragments.
  const search = q.replace(/[^\p{L}\p{N} .&_-]/gu, '').replace(/_/g, '');
  return { page, q, search, from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 };
}
export function groupBy<T>(rows: T[], key: (row: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const row of rows) { const id = key(row); if (id) { const group = groups.get(id) ?? []; group.push(row); groups.set(id, group); } }
  return groups;
}
