import type { NextRequest } from 'next/server';
import {authorize,apiError,jsonBody} from '@/lib/api/auth';
import {InputError,reviewBody} from '@/lib/api/validation';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{await authorize(req);reviewBody(await jsonBody(req),'accepted');throw new InputError('Open Review / Accept and complete the structured review workflow.',409);}catch(error){return apiError(error);}}
