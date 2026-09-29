-- NULL values remain distinct under a full unique index. PostgREST upsert can
-- infer this index without needing a partial-index predicate.
DROP INDEX IF EXISTS public.impact_records_dedupe_key_uq;
CREATE UNIQUE INDEX impact_records_dedupe_key_uq ON public.impact_records(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_entities_ticker ON public.entities(ticker);
CREATE INDEX IF NOT EXISTS idx_events_detected_id ON public.events(detected_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_impact_entity_created ON public.impact_records(entity_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_impact_event_created ON public.impact_records(event_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON public.document_index(created_at DESC, doc_id);

-- Backfill only unique matches. Ambiguous legacy records remain unlinked for review.
WITH matches AS (
 SELECT i.id, min(e.id::text)::uuid AS entity_id FROM public.impact_records i
 JOIN public.entities e ON upper(e.ticker)=upper(i.security)
 WHERE i.entity_id IS NULL GROUP BY i.id HAVING count(*)=1
) UPDATE public.impact_records i SET entity_id=m.entity_id FROM matches m WHERE i.id=m.id;
WITH matches AS (
 SELECT i.id, min(e.id::text)::uuid AS entity_id FROM public.impact_records i
 JOIN public.entities e ON e.name=i.company
 WHERE i.entity_id IS NULL AND (i.security IS NULL OR i.security='') GROUP BY i.id HAVING count(*)=1
) UPDATE public.impact_records i SET entity_id=m.entity_id FROM matches m WHERE i.id=m.id;

-- Shared internal workspace: every signed-in analyst can read/write these tables.
-- Anonymous clients have no table access; no service-role key is needed in Next.
DROP POLICY IF EXISTS "Public users can read entities" ON public.entities;
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['entities','sources','events','impact_records','event_links','document_index','workspace_items','backlog_items','tasks','cicd_test'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon', tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated', tab);
  EXECUTE format('CREATE POLICY analyst_workspace ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tab);
 END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.tasks_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.search_event_ids(term text, page_offset integer, page_limit integer)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT e.id FROM events e LEFT JOIN entities n ON n.id=e.entity_id
 WHERE e.title ILIKE '%'||term||'%' OR e.event_type ILIKE '%'||term||'%'
 OR n.name ILIKE '%'||term||'%' OR n.ticker ILIKE '%'||term||'%'
 ORDER BY e.detected_at DESC, e.id
 OFFSET greatest(0,page_offset) LIMIT least(100,greatest(1,page_limit));
$$;
REVOKE ALL ON FUNCTION public.search_event_ids(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_event_ids(text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.ingest_scored_event(event_data jsonb, impact_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE saved_event events; saved_impact impact_records;
BEGIN
 INSERT INTO events(entity_id,title,event_type,occurred_at,impact_score,impact_direction,confidence,significance,rationale,affected_metrics,source_id,source_url)
 VALUES((event_data->>'entity_id')::uuid,event_data->>'title',event_data->>'event_type',(event_data->>'occurred_at')::timestamptz,
 (event_data->>'impact_score')::double precision,event_data->>'impact_direction',(event_data->>'confidence')::double precision,
 event_data->>'significance',event_data->>'rationale',event_data->'affected_metrics',(event_data->>'source_id')::uuid,event_data->>'source_url') RETURNING * INTO saved_event;
 INSERT INTO impact_records(entity_id,event_id,company,security,sector,event_type,direction,confidence,event_status,horizon,materiality,summary,evidence_url)
 VALUES(saved_event.entity_id,saved_event.id,impact_data->>'company',impact_data->>'security',impact_data->>'sector',saved_event.event_type,
 saved_event.impact_direction,saved_event.confidence,impact_data->>'event_status',impact_data->>'horizon',impact_data->>'materiality',saved_event.rationale,impact_data->>'evidence_url') RETURNING * INTO saved_impact;
 RETURN jsonb_build_object('event',to_jsonb(saved_event),'impactRecord',to_jsonb(saved_impact));
END $$;
REVOKE ALL ON FUNCTION public.ingest_scored_event(jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_scored_event(jsonb,jsonb) TO authenticated;
