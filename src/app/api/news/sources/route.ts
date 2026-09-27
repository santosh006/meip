import { hostedNews, newsRpc } from '@/lib/ingestion/hosted';
import { NextResponse, type NextRequest } from 'next/server';
import { authorize, apiError, } from '@/lib/api/auth';
import { InputError } from '@/lib/api/validation';
import { db } from '@/lib/newsdb';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { supabase } = await authorize(req);
    if (hostedNews()) return NextResponse.json(await newsRpc(supabase, 'sources'));
    const row = db().prepare('SELECT payload FROM source_catalogue WHERE id=1').get() as {payload: string} | undefined;
    if (!row) throw new InputError('News worker is not ready. Start the worker and retry.', 503);
    return NextResponse.json(JSON.parse(row.payload));
  } catch (error) { return apiError(error); }
}
