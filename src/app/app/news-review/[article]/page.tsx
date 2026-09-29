import Shell from '@/components/Shell';
import {createSupabaseServer} from '@/lib/supabase-server';
import {reviewRpc,type ReviewData} from '@/lib/reviews/api';
import {emptyDocument} from '@/lib/reviews/model';
import ReviewClient from './ReviewClient';
export const dynamic='force-dynamic';
export default async function ReviewPage({params}:{params:Promise<{article:string}>}){
 const {article}=await params;const client=await createSupabaseServer();
 let data:ReviewData;
 try{data=await reviewRpc<ReviewData>(client,'load',{article});}catch(error){return <Shell><h1>News review</h1><p role="alert">{error instanceof Error?error.message:'Unable to load review.'}</p></Shell>;}
 return <Shell><ReviewClient articleKey={article} initial={data} initialDocument={data.draft?.document??data.versions[0]?.snapshot??emptyDocument(data.article)}/></Shell>;
}
