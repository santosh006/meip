import { v5 as uuidv5 } from 'uuid';
import type { Json, TablesInsert } from '@/lib/database.types';
import type { ArticleRow } from '@/lib/newsdb';

const NEWS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export function newsEventId(dedupeKey: string) {
  return uuidv5(dedupeKey, NEWS_NAMESPACE);
}
function validDate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}
export function articleEvent(article: ArticleRow, options: {
  entityId?: string | null;
  tickers: string[];
  reason: string;
  reviewerId: string;
  eventType?: string;
}): TablesInsert<'events'> {
  let original: Json = article.raw ?? null;
  if (article.raw) {
    try { original = JSON.parse(article.raw) as Json; } catch { /* Preserve unparsed source text. */ }
  }
  return {
    id: newsEventId(article.dedupe_key),
    title: article.title,
    event_type: options.eventType ?? 'news',
    entity_id: options.entityId ?? null,
    occurred_at: validDate(article.published_at) ?? validDate(article.fetched_at) ?? new Date().toISOString(),
    summary: article.summary?.trim() || article.body?.trim() || null,
    source_url: article.url || article.attachment_url || null,
    // Acceptance is a review decision, not an impact assessment.
    impact_score: null,
    impact_direction: null,
    confidence: null,
    raw: {
      dedupe_key: article.dedupe_key,
      source: article.source,
      publisher: article.publisher ?? null,
      published_at: article.published_at,
      fetched_at: article.fetched_at ?? null,
      tickers: options.tickers,
      body: article.body ?? null,
      categories: article.categories ?? null,
      original,
      review: { decision: 'accepted', reason: options.reason, reviewer_id: options.reviewerId },
    },
  };
}
