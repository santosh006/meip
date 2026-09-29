-- Standalone fix: can be applied to the existing events table without the
-- broader integrity migration. RLS stays enabled; no anonymous access added.
BEGIN;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON TABLE public.events TO authenticated;

DROP POLICY IF EXISTS accepted_news_read ON public.events;
CREATE POLICY accepted_news_read ON public.events
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS accepted_news_insert ON public.events;
CREATE POLICY accepted_news_insert ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    raw -> 'review' ->> 'decision' = 'accepted'
    AND raw ->> 'dedupe_key' ~ '^([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$'
  );
COMMIT;
