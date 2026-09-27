BEGIN;
INSERT INTO public.entities(id,name,ticker) VALUES('00000000-0000-0000-0000-000000000001','Test','TEST');
INSERT INTO public.impact_records(company,dedupe_key) VALUES('Test','dedupe') ON CONFLICT(dedupe_key) DO NOTHING;
INSERT INTO public.impact_records(company,dedupe_key) VALUES('Must not overwrite','dedupe') ON CONFLICT(dedupe_key) DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.impact_records WHERE dedupe_key='dedupe') <> 1 THEN RAISE EXCEPTION 'Dedupe failed'; END IF;
 IF (SELECT company FROM public.impact_records WHERE dedupe_key='dedupe') <> 'Test' THEN RAISE EXCEPTION 'Retry overwrote record'; END IF;
 IF has_table_privilege('anon','public.impact_records','SELECT') THEN RAISE EXCEPTION 'Anonymous read granted'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.ingest_scored_event(
 '{"entity_id":"00000000-0000-0000-0000-000000000001","title":"Test","event_type":"earnings","occurred_at":"2026-09-27T00:00:00Z","impact_score":50,"confidence":0.7}',
 '{"company":"Test"}'
);
DO $$ DECLARE before_count integer; BEGIN
 SELECT count(*) INTO before_count FROM events;
 BEGIN
  PERFORM public.ingest_scored_event('{"title":"Must rollback","event_type":"earnings","occurred_at":"2026-09-27T00:00:00Z"}', '{}');
  RAISE EXCEPTION 'Expected impact insert to fail';
 EXCEPTION WHEN not_null_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM events) <> before_count THEN RAISE EXCEPTION 'Partial event persisted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM impact_records WHERE event_id IS NOT NULL AND entity_id='00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Missing relationships'; END IF;
END $$;
SELECT * FROM public.search_event_ids('Test',0,25);
ROLLBACK;
