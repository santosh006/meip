import { NextResponse, type NextRequest } from 'next/server';
import { authorize, apiError } from '@/lib/api/auth';
import { integer, text, ticker } from '@/lib/api/validation';
import { listArticles } from '@/lib/newsdb';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    await authorize(req);
    const p = req.nextUrl.searchParams;
    const limit = integer(p.get('limit'), 'limit', 50, 200);
    const offset = integer(p.get('offset'), 'offset', 0, 1000000, 0);
    const articles = listArticles({ limit: limit + 1, offset, ticker: ticker(p.get('ticker') ?? undefined), source: text(p.get('source') ?? undefined, 'source', 40), unmappedOnly: p.get('unmappedOnly') === 'true' });
    return NextResponse.json({ ok: true, articles: articles.slice(0, limit), hasMore: articles.length > limit, offset });
  } catch (error) { return apiError(error); }
}
