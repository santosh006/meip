import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database,Json } from '@/lib/database.types';
import { InputError } from '@/lib/api/validation';
import type { ReviewDocument, Values } from './model';
export interface Draft {id:string; revision:number; document:ReviewDocument; base_version:string|null; accepted_version:string|null}
export interface Version {id:string;article_key:string;version_no:number;outcome:string;event_id:string;snapshot:ReviewDocument;accepted_at:string;accepted_by:string;published_at:string|null;ingested_at:string|null;missing_analysis:string[]}
export interface Observation {id:string;version_id:string;entity_id:string;analysis_date:string;created_at:string;fields:Values}
export interface ReviewData {article:Record<string,unknown>;articleDecision:string|null;canReview:boolean;draft:Draft|null;versions:Version[];entities:{id:string;name:string;ticker:string|null;entity_type:string}[];securities:{id:string;entity_id:string;symbol:string;exchange:string|null}[];horizons:{key:string;label:string}[];events:{id:string;title:string}[];scores:{id:string;version_id:string;mapping_id:string;horizon_id:string|null;input:Values;output:Record<string,unknown>}[];observations:Observation[];audit:{id:number;action:string;created_at:string;actor_id:string}[]}
export async function reviewRpc<T>(client:SupabaseClient<Database>,action:string,args:unknown={}):Promise<T>{
 const {data,error}=await client.rpc('review_workflow',{action,args:args as Json});
 if(error){if(/^PT(400|403|404|409)$/.test(error.code))throw new InputError(error.message,Number(error.code.slice(2)));if(error.code==='42501')throw new InputError('Reviewer access is required.',403);if(error.code==='PGRST202')throw new InputError('Structured review is not installed. Apply the structured-news-review migration.',503);throw error;}
 return data as T;
}
