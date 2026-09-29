-- All test data and temporary policy changes are rolled back.
BEGIN;
-- Fresh local migrations also include a broader internal-workspace policy.
-- Remove it only inside this test transaction to verify the standalone fix.
DROP POLICY IF EXISTS analyst_workspace ON public.events;
SET LOCAL ROLE authenticated;
DO $$
DECLARE test_id uuid := gen_random_uuid();
BEGIN
 INSERT INTO public.events(id,title,event_type,occurred_at,entity_id,raw)
 VALUES(test_id,'Accepted-news permission test','news',now(),NULL,
   jsonb_build_object('dedupe_key',repeat('a',40),'review',jsonb_build_object('decision','accepted')));
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=test_id AND entity_id IS NULL) THEN
   RAISE EXCEPTION 'Authenticated user cannot read accepted news without a ticker';
 END IF;
 -- Same retry behavior as the application: no UPDATE policy is needed.
 INSERT INTO public.events(id,title,event_type,occurred_at,entity_id,raw)
 VALUES(test_id,'Accepted-news retry test','news',now(),NULL,
   jsonb_build_object('dedupe_key',repeat('a',40),'review',jsonb_build_object('decision','accepted')))
 ON CONFLICT(id) DO NOTHING;
 BEGIN
  INSERT INTO public.events(title,event_type,occurred_at,raw)
  VALUES('Must be rejected','news',now(),
    jsonb_build_object('dedupe_key',repeat('b',40),'review',jsonb_build_object('decision','rejected')));
  RAISE EXCEPTION 'Policy unexpectedly allowed a rejected article';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
