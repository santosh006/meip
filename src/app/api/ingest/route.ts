import { NextRequest, NextResponse } from 'next/server';
import { authorize, apiError } from '@/lib/api/auth';
import { InputError, integer } from '@/lib/api/validation';
import { ingestDocument } from '@/lib/ingestion/ingest';
import { MAX_UPLOAD_BYTES } from '@/lib/ingestion/upload-validation';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { supabase } = await authorize(req);
    const page = integer(req.nextUrl.searchParams.get('page'), 'page', 1, 100000);
    const { data, error, count } = await supabase.from('document_index')
      .select('doc_id,file_name,file_size_bytes,created_at,status', { count: 'exact' })
      .order('created_at', { ascending: false }).order('doc_id')
      .range((page - 1) * 25, page * 25 - 1);
    if (error) throw error;
    return NextResponse.json({ files: data, page, hasMore: page * 25 < (count ?? 0) });
  } catch (error) { return apiError(error); }
}
export async function POST(req: NextRequest) {
  try {
    const { user } = await authorize(req);
    // Bound the stream before multipart parsing, including chunked requests.
    const max = MAX_UPLOAD_BYTES + 64 * 1024;
    if (Number(req.headers.get('content-length')) > max) throw new InputError('Upload too large', 413);
    const reader = req.body?.getReader();
    if (!reader) throw new InputError('No file provided');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new InputError('Upload too large', 413); }
      chunks.push(value);
    }
    let form: FormData;
    try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers.get('content-type') ?? '' } }).formData(); }
    catch { throw new InputError('Invalid multipart upload'); }
    const file = form.get('file');
    if (!(file instanceof File)) throw new InputError('No file provided');
    const result = await ingestDocument(file, { created_by: user.id });
    return NextResponse.json({ ...result, success: result.status === 'success', ...(result.status === 'duplicate' ? {error: 'Document already exists'} : {}) }, { status: result.status === 'duplicate' ? 409 : 200 });
  } catch (error) { return apiError(error); }
}
