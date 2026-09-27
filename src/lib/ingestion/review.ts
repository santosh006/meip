import { hostedNews, hostedReview } from './hosted';
import { persistAcceptedNews } from './persist-news';
import { NextResponse, type NextRequest } from 'next/server';
import { authorize, apiError, jsonBody } from '@/lib/api/auth';
import { InputError, reviewBody } from '@/lib/api/validation';
import { getArticleById, resolveTickers, reserveReview, isReviewed, tombstoneAndDelete, markNewsExported, type Decision } from '@/lib/newsdb';
import type { TablesInsert } from '@/lib/database.types';
import { articleEvent, newsEventId } from './news-event';

type Payload = {
  event?: TablesInsert<'events'>;
  // Older pending decisions stored an impact record. Recover them as news.
  record?: TablesInsert<'impact_records'>;
  ticker?: string;
  reason: string;
};
export async function review(req: NextRequest, decision: Decision) {
  try {
    const { supabase, user } = await authorize(req);
    const body = reviewBody(await jsonBody(req), decision);
    if (hostedNews()) return NextResponse.json(await hostedReview(supabase, user.id, body, decision));
    const prior = isReviewed(body.articleId);
    if (prior) {
      if (prior !== decision) throw new InputError('Article already reviewed with a different decision', 409);
      return NextResponse.json({ ok: true, alreadyReviewed: true, priorDecision: prior });
    }
    const article = getArticleById(body.articleId);
    if (!article) throw new InputError('Article not found', 404);
    const tickers = [...new Set((body.ticker ? [body.ticker] : resolveTickers(body.articleId)).map(t => t.toUpperCase()))];
    const payload: Payload = { ticker: tickers[0], reason: body.reason ?? body.summary ?? '' };
    if (decision === 'accepted') {
      let entityId: string | null = null;
      if (tickers.length) {
        const { data: entities, error } = await supabase.from('entities').select('id,ticker').in('ticker', tickers);
        if (error) console.error('Optional news entity lookup failed', error);
        else entityId = tickers.map(t => entities?.find(e => e.ticker === t)?.id).find(Boolean) ?? null;
      }
      payload.event = articleEvent(article, { entityId, tickers, reason: payload.reason, reviewerId: user.id, eventType: body.eventType });
    }
    const reservation = reserveReview(body.articleId, decision, user.id, payload);
    if (reservation.prior) {
      if (reservation.prior !== decision) throw new InputError('Article already reviewed with a different decision', 409);
      return NextResponse.json({ ok: true, alreadyReviewed: true });
    }
    const intent = reservation.intent!;
    if (intent.decision !== decision) throw new InputError('A different review decision is pending. Retry that decision to finish it.', 409);
    const saved = JSON.parse(intent.payload) as Payload;
    if (decision === 'accepted') {
      const event = saved.event ?? articleEvent(article, {
        entityId: saved.record?.entity_id ?? payload.event?.entity_id,
        tickers: saved.ticker ? [saved.ticker] : tickers,
        reason: saved.reason,
        reviewerId: intent.reviewer_id,
      });
      // Deterministic event ID makes write/cleanup retries safe using the
      // existing events primary key. No new columns or RPC are required.
      await persistAcceptedNews(supabase, event);
    }
    tombstoneAndDelete(body.articleId, decision, { reviewerId: intent.reviewer_id, ticker: saved.ticker, reason: saved.reason });
    if (decision === 'accepted') markNewsExported(body.articleId, newsEventId(body.articleId));
    return NextResponse.json({ ok: true, articleId: body.articleId, decision, eventId: decision === 'accepted' ? newsEventId(body.articleId) : null });
  } catch (error) { return apiError(error); }
}
