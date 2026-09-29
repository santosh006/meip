import { NextResponse,type NextRequest } from 'next/server';
import { authorize,apiError,jsonBody } from '@/lib/api/auth';
import { object,InputError } from '@/lib/api/validation';
import { reviewRpc } from '@/lib/reviews/api';
import { validateDocument,fieldErrors } from '@/lib/reviews/model';
import { observationFields } from '@/lib/reviews/fields';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const {supabase}=await authorize(req);const article=req.nextUrl.searchParams.get('article');return NextResponse.json(await reviewRpc(supabase,article?'load':'drafts',article?{article}:{}));}catch(error){return apiError(error);}}
export async function POST(req:NextRequest){try{
 const {supabase}=await authorize(req);const body=object(await jsonBody(req, 262144));
 if(!['save','accept','observe','entity','security','restart'].includes(String(body.action)))throw new InputError('Invalid review action');
 const args=object(body.args);
 if(body.action==='save')validateDocument(args.document);
 if(body.action==='observe'){const errors=fieldErrors(args.fields,observationFields,'Observation',true);if(errors.length)throw new InputError(errors.join('\n'));}
 return NextResponse.json(await reviewRpc(supabase,String(body.action),args));
}catch(error){return apiError(error);}}
