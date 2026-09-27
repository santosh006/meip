// lib/impact.ts
// Maps a NewsLoader article onto a Supabase impact_records row.

import { v5 as uuidv5 } from 'uuid';
import type { Json, TablesInsert } from './database.types';
import { splitList, type ArticleRow } from '@/lib/newsdb';

export const NEWS_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function newsIdFor(dedupeKey: string): string {
  return uuidv5(dedupeKey, NEWS_UUID_NAMESPACE);
}

// Open vocabularies — impact_records has no CHECK constraints.
// These mirror the existing column defaults. Adjust here only.
export const DIRECTION = {
  positive: 'positive',
  negative: 'negative',
  neutral: 'neutral',
  uncertain: 'uncertain',
} as const;

export const EVENT_STATUS_DEFAULT = 'reported';
export const HORIZON_DEFAULT = 'short';
export const MATERIALITY_DEFAULT = 'medium';
export const CONFIDENCE_DEFAULT = 0.5;

function mapDirection(label: string | null): string {
  switch ((label ?? '').toLowerCase()) {
    case 'positive':
    case 'bullish':
      return DIRECTION.positive;
    case 'negative':
    case 'bearish':
      return DIRECTION.negative;
    case 'neutral':
      return DIRECTION.neutral;
    default:
      return DIRECTION.uncertain;
  }
}

function mapConfidence(sentiment: number | null): number {
  if (sentiment === null || Number.isNaN(sentiment)) return CONFIDENCE_DEFAULT;
  const magnitude = Math.abs(sentiment);
  const scaled = magnitude > 1 ? magnitude / 100 : magnitude;
  return Math.min(1, Math.max(0, Number(scaled.toFixed(3))));
}

function mapEventType(categories: string | null): string | null {
  const first = splitList(categories)[0];
  return first ? first.toLowerCase() : null;
}

function parseRaw(raw: string | null): Json {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { _unparsed: raw };
  }
}

export type ImpactRecordInsert = TablesInsert<'impact_records'>;

/** One row per article; ticker selects the primary affected security. */
export function toImpactRecord(
  article: ArticleRow,
  ticker: string,
): ImpactRecordInsert {
  const symbol = ticker.toUpperCase();

  return {
    id: newsIdFor(article.dedupe_key),
    dedupe_key: article.dedupe_key,

    company: symbol, // TODO: resolve to display name once entities is wired
    security: symbol,
    sector: null,

    event_type: mapEventType(article.categories),
    event_status: EVENT_STATUS_DEFAULT,
    direction: mapDirection(article.sentiment_label),
    horizon: HORIZON_DEFAULT,
    materiality: MATERIALITY_DEFAULT,
    confidence: mapConfidence(article.sentiment),

    headline: article.title?.trim() || null,
    summary:
      article.summary?.trim() || (article.body ?? '').slice(0, 400) || null,
    evidence_url: article.url || article.attachment_url || null,
    publisher: article.publisher?.trim() || null,
    source: article.source,
    kind: article.kind,
    sentiment_label: article.sentiment_label,
    published_at: article.published_at ?? article.fetched_at ?? null,
    tickers: splitList(article.tickers),
    raw: parseRaw(article.raw),

    // uuid columns with FK constraints — NULL is permitted, free text is not.
    entity_id: null,
    event_id: null,
  };
}
