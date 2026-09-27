import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';
import type { ArticleRow, Decision } from '@/lib/newsdb';
import { InputError } from '@/lib/api/validation';
import { articleEvent } from './news-event';

export function hostedNews() {
  return process.env.NEWS_STORAGE === 'supabase' || process.env.VERCEL === '1';
}
export async function newsRpc<T>(supabase: SupabaseClient<Database>, action: string, args: Json = {}): Promise<T> {
  const { data, error } = await supabase.rpc('news_workspace', { action, args });
  if (error) {
    if (/^PT(400|404|409|503)$/.test(error.code)) throw new InputError(error.message, Number(error.code.slice(2)));
    if (error.code === 'PGRST202') throw new InputError('Hosted news storage is not installed. Apply the hosted news ingestion migration, then retry.', 503);
    throw error;
  }
  return data as T;
}
export async function hostedReview(supabase: SupabaseClient<Database>, reviewerId: string, body: {articleId: string; ticker?: string; reason?: string; summary?: string; eventType?: string}, decision: Decision) {
  const { article, decision: prior } = await newsRpc<{article: ArticleRow; decision: Decision | null}>(supabase, 'article', { id: body.articleId });
  if (prior && prior !== decision) throw new InputError('Article already reviewed with a different decision', 409);
  const reason = body.reason ?? body.summary ?? '';
  const tickers = [...new Set((body.ticker ? [body.ticker] : (article.tickers ?? '').split(',')).map(t => t.trim().toUpperCase()).filter(Boolean))];
  let entityId: string | null = null;
  if (decision === 'accepted' && !prior && tickers.length) {
    const { data, error } = await supabase.from('entities').select('id,ticker').in('ticker', tickers);
    if (error) console.error('Optional news entity lookup failed', error);
    else entityId = tickers.map(t => data?.find(e => e.ticker === t)?.id).find(Boolean) ?? null;
  }
  return newsRpc(supabase, 'review', {
    id: body.articleId, decision, reason,
    event: decision === 'accepted' && !prior ? articleEvent(article, { entityId, tickers, reason, reviewerId, eventType: body.eventType }) : null,
  });
}
