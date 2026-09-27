BEGIN;
-- Test role grants and database transactions without leaving articles/jobs behind.
DO $$ BEGIN
 IF has_function_privilege('anon','public.news_workspace(text,jsonb)','EXECUTE') OR
    has_function_privilege('authenticated','public.news_worker(text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Incorrect news function permissions';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000123',true);
SELECT public.news_worker('catalogue','{"sources":[]}');
SELECT public.news_worker('save','{"articles":[{"dedupe_key":"test-hosted-accepted","title":"Standalone article","source":"test","tickers":"","fetched_at":"2026-09-27T00:00:00Z"},{"dedupe_key":"test-hosted-rejected","title":"Rejected article","source":"test"}]}');
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; eid uuid := gen_random_uuid(); j jsonb;
BEGIN
 result:=public.news_workspace('review',jsonb_build_object('id','test-hosted-accepted','decision','accepted','event',jsonb_build_object('id',eid,'occurred_at',now(),'raw',jsonb_build_object('dedupe_key','test-hosted-accepted','review',jsonb_build_object('decision','accepted')))));
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=(result->>'eventId')::uuid AND entity_id IS NULL) THEN RAISE EXCEPTION 'Missing standalone event'; END IF;
 result:=public.news_workspace('review','{"id":"test-hosted-accepted","decision":"accepted"}');
 IF result->>'alreadyReviewed' <> 'true' THEN RAISE EXCEPTION 'Retry failed'; END IF;
 BEGIN
  PERFORM public.news_workspace('review','{"id":"test-hosted-accepted","decision":"rejected","reason":"test"}');
  RAISE EXCEPTION 'Conflicting review allowed';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 PERFORM public.news_workspace('review','{"id":"test-hosted-rejected","decision":"rejected","reason":"test"}');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.news_workspace('preview','{}')) x WHERE x->>'id' IN ('test-hosted-accepted','test-hosted-rejected')) THEN RAISE EXCEPTION 'Reviewed article still pending'; END IF;
 BEGIN
  PERFORM public.news_workspace('enqueue','{"ticker":"TCS","days":1,"limit":10,"sources":[null]}');
  RAISE EXCEPTION 'Invalid source allowed';
 EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL; END;
 j:=public.news_workspace('enqueue','{"ticker":"TCS","days":1,"limit":10,"sources":[]}');
 BEGIN
  PERFORM public.news_workspace('enqueue','{"ticker":"TCS","days":1,"limit":10,"sources":[]}');
  RAISE EXCEPTION 'Duplicate active job allowed';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
END $$;
RESET ROLE;
DO $$
DECLARE j jsonb;
BEGIN
 -- Isolate test claims from any real queue inside this rollback transaction.
 UPDATE news_ingestion.jobs SET status='failed' WHERE requested_by <> '00000000-0000-0000-0000-000000000123';
 j:=public.news_worker('claim');
 IF j->>'status' <> 'running' THEN RAISE EXCEPTION 'Claim failed'; END IF;
 IF public.news_worker('claim') <> 'null'::jsonb THEN RAISE EXCEPTION 'Double claim'; END IF;
 PERFORM public.news_worker('finish',jsonb_build_object('id',j->>'id','token',gen_random_uuid(),'success',true,'result','{}'::jsonb));
 IF NOT EXISTS(SELECT 1 FROM news_ingestion.jobs WHERE id=(j->>'id')::uuid AND status='running') THEN RAISE EXCEPTION 'Stale finish accepted'; END IF;
 UPDATE news_ingestion.jobs SET lease_until=now()-interval '1 minute' WHERE id=(j->>'id')::uuid;
 IF public.news_worker('claim')->>'token'=j->>'token' THEN RAISE EXCEPTION 'Lease token not renewed'; END IF;
 IF public.news_worker('save','{"articles":[{"dedupe_key":"test-hosted-rejected","title":"duplicate"}]}') <> '0'::jsonb THEN RAISE EXCEPTION 'Reingested reviewed article'; END IF;
END $$;
ROLLBACK;
