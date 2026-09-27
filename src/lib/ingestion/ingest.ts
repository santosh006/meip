import { createHash } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2Bucket } from './r2';
import { createSupabaseServer } from '@/lib/supabase-server';
import { validateUpload, FILE_TYPES } from './upload-validation';
import { InputError } from '@/lib/api/validation';

export async function ingestDocument(file: File, metadata: { created_by: string }) {
  const invalid = validateUpload(file);
  if (invalid) throw new InputError(invalid);
  const buffer = Buffer.from(await file.arrayBuffer());
  const doc_id = createHash('sha256').update(buffer).digest('hex');
  const r2Key = `documents/${doc_id}`;
  const mime = FILE_TYPES[file.name.split('.').pop()!.toLowerCase()][0];
  const supabase = await createSupabaseServer();
  // Reserve a durable index before creating an object. Concurrent retries share
  // the content-addressed key; failed finalization can be retried without orphans.
  const { error: reserveError } = await supabase.from('document_index').upsert({
    doc_id, file_name: file.name, file_size_bytes: buffer.length, r2_object_key: r2Key,
    mime_type: mime, created_by: metadata.created_by, status: 'uploading',
  }, { onConflict: 'doc_id', ignoreDuplicates: true });
  if (reserveError) throw reserveError;
  const { data, error } = await supabase.from('document_index').select('status').eq('doc_id', doc_id).single();
  if (error) throw error;
  if (data.status === 'available') return { status: 'duplicate' as const, doc_id };
  await getR2Client().send(new PutObjectCommand({ Bucket: getR2Bucket(), Key: r2Key, Body: buffer, ContentType: mime }));
  const { error: finalizeError } = await supabase.from('document_index').update({ status: 'available', updated_at: new Date().toISOString() }).eq('doc_id', doc_id);
  if (finalizeError) throw finalizeError;
  return { status: 'success' as const, doc_id };
}
