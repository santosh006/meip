import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { authorize, apiError, jsonBody } from '@/lib/api/auth';
import { ingestBody, InputError, uuid } from '@/lib/api/validation';
import { db } from '@/lib/newsdb';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const { user } = await authorize(req);
    const payload = ingestBody(await jsonBody(req));
    const jobId = db().transaction(() => {
      const active = db().prepare("SELECT id FROM ingestion_jobs WHERE requested_by=? AND status IN ('queued','running') LIMIT 1").get(user.id) as {id: string} | undefined;
      if (active) throw new InputError('An ingestion job is already pending. Check its status before starting another.', 409);
      const id = randomUUID();
      db().prepare('INSERT INTO ingestion_jobs(id,requested_by,payload) VALUES(?,?,?)').run(id, user.id, JSON.stringify(payload));
      return id;
    }).immediate();
    return NextResponse.json({ success: true, jobId, status: 'queued' }, { status: 202 });
  } catch (error) { return apiError(error); }
}
export async function GET(req: NextRequest) {
  try {
    const { user } = await authorize(req);
    const id = uuid(req.nextUrl.searchParams.get('id') ?? undefined, 'id');
    const row = (id
      ? db().prepare('SELECT id,status,result FROM ingestion_jobs WHERE id=? AND requested_by=?').get(id, user.id)
      : db().prepare("SELECT id,status,result FROM ingestion_jobs WHERE requested_by=? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(user.id)
    ) as {id: string; status: string; result: string | null} | undefined;
    if (!row) return NextResponse.json({ job: null });
    return NextResponse.json({ job: { ...row, result: row.result ? JSON.parse(row.result) : null } });
  } catch (error) { return apiError(error); }
}
