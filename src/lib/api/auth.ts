import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { InputError } from './validation';

export async function authorize(req: NextRequest) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== req.nextUrl.origin)) throw new InputError('Forbidden origin', 403);
  }
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new InputError('Unauthorized', 401);
  // This is a shared, authenticated analyst workspace; RLS enforces DB access.
  return { supabase, user };
}
export async function jsonBody(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) throw new InputError('Missing JSON body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) { await reader.cancel(); throw new InputError('Request too large', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new InputError('Invalid JSON body'); }
}
export function apiError(error: unknown) {
  if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('API operation failed', error);
  return NextResponse.json({ error: 'Operation failed. Please retry.' }, { status: 500 });
}
