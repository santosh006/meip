import { persistAcceptedNews } from './persist-news';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/lib/database.types';
import { markNewsExported, unexportedAcceptedReviews } from '@/lib/newsdb';
import { newsEventId } from './news-event';

/** Materialize older, already-approved decisions once, without changing review status. */
export async function reconcileAcceptedNews(supabase: SupabaseClient<Database>) {
  const reviews = unexportedAcceptedReviews();
  for (const review of reviews) {
    const { data: impact, error } = await supabase.from('impact_records')
      .select('event_id,entity_id,evidence_url,security').eq('dedupe_key', review.dedupe_key).maybeSingle();
    if (error) throw error;
    if (impact?.event_id) {
      markNewsExported(review.dedupe_key, impact.event_id);
      continue;
    }
    const eventId = newsEventId(review.dedupe_key);
    const reviewedAt = Number.isFinite(Date.parse(review.reviewed_at))
      ? new Date(review.reviewed_at.includes('T') ? review.reviewed_at : `${review.reviewed_at.replace(' ', 'T')}Z`).toISOString()
      : new Date().toISOString();
    const event: TablesInsert<'events'> = {
      id: eventId,
      title: review.headline || 'Accepted news',
      event_type: 'news',
      occurred_at: reviewedAt,
      detected_at: reviewedAt,
      entity_id: impact?.entity_id ?? null,
      source_url: impact?.evidence_url ?? null,
      summary: null,
      raw: {
        dedupe_key: review.dedupe_key,
        source: review.source,
        tickers: review.ticker ? [review.ticker] : [],
        review: { decision: 'accepted', reason: review.reason, reviewer_id: review.reviewer_id },
        // Old review cleanup deleted the full source. Do not present the review
        // reason or review timestamp as an original article summary/publication.
        legacy_review: true,
        published_at: null,
      },
    };
    await persistAcceptedNews(supabase, event);
    markNewsExported(review.dedupe_key, eventId);
  }
  return { remaining: unexportedAcceptedReviews(1).length > 0 };
}
