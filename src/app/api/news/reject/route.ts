import type { NextRequest } from 'next/server';
import { review } from '@/lib/ingestion/review';
export const dynamic = 'force-dynamic';
export function POST(req: NextRequest) { return review(req, 'rejected'); }
