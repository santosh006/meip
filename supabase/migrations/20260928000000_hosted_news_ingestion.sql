BEGIN;
CREATE SCHEMA IF NOT EXISTS news_ingestion;
REVOKE ALL ON SCHEMA news_ingestion FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS news_ingestion.articles (
 dedupe_key text PRIMARY KEY, payload jsonb NOT NULL,
 decision text CHECK(decision IN ('accepted','rejected')), reason text,
 reviewer_id uuid, reviewed_at timestamptz, event_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_articles_pending ON news_ingestion.articles(created_at DESC) WHERE decision IS NULL;
CREATE INDEX IF NOT EXISTS news_articles_preview ON news_ingestion.articles((payload->>'published_at') DESC NULLS LAST,dedupe_key DESC) WHERE decision IS NULL;
CREATE TABLE IF NOT EXISTS news_ingestion.jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requested_by uuid NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued', result jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz, finished_at timestamptz, lease_until timestamptz, token uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS news_one_active_job ON news_ingestion.jobs(requested_by) WHERE status IN ('queued','running');
CREATE TABLE IF NOT EXISTS news_ingestion.catalogue (id int PRIMARY KEY CHECK(id=1), payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS news_ingestion.runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid, token uuid, payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS news_ingestion.archive (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source text NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL);

-- Private tables are accessible only through these narrowly granted functions.
CREATE OR REPLACE FUNCTION public.news_workspace(action text, args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, news_ingestion AS $$
DECLARE actor uuid := auth.uid(); a news_ingestion.articles; j news_ingestion.jobs; e jsonb; out jsonb; decision_value text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 CASE action
 WHEN 'sources' THEN
  SELECT payload INTO out FROM news_ingestion.catalogue WHERE id=1 AND updated_at > now()-interval '3 minutes';
  IF out IS NULL THEN RAISE EXCEPTION 'News worker is offline. Start the hosted worker and retry.' USING ERRCODE='PT503'; END IF;
  RETURN out;
 WHEN 'enqueue' THEN
  IF NOT EXISTS(SELECT 1 FROM news_ingestion.catalogue WHERE updated_at > now()-interval '3 minutes') THEN
   RAISE EXCEPTION 'News worker is offline. Start the hosted worker and retry.' USING ERRCODE='PT503';
  END IF;
  IF coalesce(args->>'ticker','') !~ '^[A-Z0-9][A-Z0-9.&_-]{0,31}$' OR
     coalesce((args->>'days')::int,0) NOT BETWEEN 1 AND 30 OR coalesce((args->>'limit')::int,0) NOT BETWEEN 1 AND 200 OR
     jsonb_typeof(args->'sources') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Invalid ingestion request' USING ERRCODE='PT400';
  END IF;
  IF jsonb_array_length(args->'sources') > 20 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(args->'sources') x WHERE x IS NULL OR x !~ '^[a-z0-9_-]{1,40}$') THEN
   RAISE EXCEPTION 'Invalid sources' USING ERRCODE='PT400';
  END IF;
  INSERT INTO news_ingestion.jobs(requested_by,payload) VALUES(actor,args) RETURNING * INTO j;
  RETURN jsonb_build_object('success',true,'jobId',j.id,'status',j.status);
 WHEN 'job' THEN
  SELECT * INTO j FROM news_ingestion.jobs WHERE requested_by=actor AND
   (args->>'id' IS NULL OR id=(args->>'id')::uuid) ORDER BY created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object('job',CASE WHEN j.id IS NULL THEN NULL ELSE jsonb_build_object('id',j.id,'status',j.status,'result',j.result) END);
 WHEN 'preview' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.dedupe_key,'dedupe_key',x.dedupe_key,
    'title',x.payload->>'title','source',x.payload->>'source','url',x.payload->>'url',
    'published_at',x.payload->>'published_at','tickers',x.payload->>'tickers')), '[]') INTO out FROM (
   SELECT dedupe_key,payload FROM news_ingestion.articles WHERE decision IS NULL
    AND (args->>'source' IS NULL OR payload->>'source'=args->>'source')
    AND (args->>'ticker' IS NULL OR upper(args->>'ticker')=ANY(string_to_array(upper(coalesce(payload->>'tickers','')),',')))
    AND (NOT coalesce((args->>'unmappedOnly')::boolean,false) OR coalesce(payload->>'tickers','')='')
   ORDER BY payload->>'published_at' DESC NULLS LAST,dedupe_key DESC
   LIMIT least(greatest(coalesce((args->>'limit')::int,50),1),201) OFFSET greatest(coalesce((args->>'offset')::int,0),0)
  ) x;
  RETURN out;
 WHEN 'article' THEN
  SELECT * INTO a FROM news_ingestion.articles WHERE dedupe_key=args->>'id';
  IF NOT FOUND THEN RAISE EXCEPTION 'Article not found' USING ERRCODE='PT404'; END IF;
  RETURN jsonb_build_object('article',a.payload,'decision',a.decision);
 WHEN 'review' THEN
  decision_value := args->>'decision';
  IF decision_value IS NULL OR decision_value NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='PT400'; END IF;
  IF decision_value='rejected' AND length(trim(coalesce(args->>'reason','')))=0 THEN RAISE EXCEPTION 'A reason is required' USING ERRCODE='PT400'; END IF;
  SELECT * INTO a FROM news_ingestion.articles WHERE dedupe_key=args->>'id' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article not found' USING ERRCODE='PT404'; END IF;
  IF a.decision IS NOT NULL THEN
   IF a.decision <> decision_value THEN RAISE EXCEPTION 'Article already reviewed with a different decision' USING ERRCODE='PT409'; END IF;
   RETURN jsonb_build_object('ok',true,'alreadyReviewed',true,'eventId',a.event_id);
  END IF;
  IF decision_value='accepted' THEN
   e := args->'event';
   IF e->>'id' IS NULL OR e->'raw'->>'dedupe_key' IS DISTINCT FROM a.dedupe_key OR
      e->'raw'->'review'->>'decision' IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'Invalid accepted news event' USING ERRCODE='PT400';
   END IF;
   e := jsonb_set(e,'{id}',to_jsonb(gen_random_uuid()));
   -- The article and its accepted event commit together. No cleanup gap or review intent is needed.
   INSERT INTO public.events(id,title,event_type,occurred_at,detected_at,entity_id,summary,source_url,raw)
   VALUES((e->>'id')::uuid,a.payload->>'title',coalesce(e->>'event_type','news'),(e->>'occurred_at')::timestamptz,now(),
    (e->>'entity_id')::uuid,e->>'summary',e->>'source_url',jsonb_set(e->'raw','{review,reviewer_id}',to_jsonb(actor)))
   ON CONFLICT(id) DO NOTHING;
  END IF;
  UPDATE news_ingestion.articles SET decision=decision_value,reason=coalesce(args->>'reason',''),reviewer_id=actor,reviewed_at=now(),event_id=(e->>'id')::uuid WHERE dedupe_key=a.dedupe_key;
  RETURN jsonb_build_object('ok',true,'articleId',a.dedupe_key,'decision',decision_value,'eventId',e->>'id');
 ELSE RAISE EXCEPTION 'Unknown operation' USING ERRCODE='PT400';
 END CASE;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'An ingestion job is already pending. Check its status before starting another.' USING ERRCODE='PT409';
END $$;
REVOKE ALL ON FUNCTION public.news_workspace(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.news_workspace(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.news_worker(action text, args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,news_ingestion AS $$
DECLARE j news_ingestion.jobs; item jsonb; n int:=0; changed int; run_id uuid; out jsonb; existing_decision text;
BEGIN
 CASE action
 WHEN 'catalogue' THEN
  INSERT INTO news_ingestion.catalogue VALUES(1,args,now()) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=now(); RETURN '{}';
 WHEN 'claim' THEN
  SELECT * INTO j FROM news_ingestion.jobs WHERE status='queued' OR (status='running' AND lease_until<now()) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN 'null'; END IF;
  UPDATE news_ingestion.jobs SET status='running',started_at=now(),lease_until=now()+interval '20 minutes',token=gen_random_uuid() WHERE id=j.id RETURNING * INTO j;
  RETURN to_jsonb(j);
 WHEN 'finish' THEN
  UPDATE news_ingestion.jobs SET status=CASE WHEN (args->>'success')::boolean THEN 'succeeded' ELSE 'failed' END,result=args->'result',finished_at=now(),lease_until=NULL
   WHERE id=(args->>'id')::uuid AND token=(args->>'token')::uuid AND status='running'; RETURN '{}';
 WHEN 'save' THEN
  FOR item IN SELECT value FROM jsonb_array_elements(args->'articles') LOOP
   INSERT INTO news_ingestion.articles(dedupe_key,payload) VALUES(item->>'dedupe_key',item) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS changed=ROW_COUNT; n:=n+changed;
  END LOOP; RETURN to_jsonb(n);
 WHEN 'import' THEN
  -- Trusted, idempotent SQLite cutover. Existing hosted decisions always win.
  FOR item IN SELECT value FROM jsonb_array_elements(args->'articles') LOOP
   INSERT INTO news_ingestion.articles(dedupe_key,payload) VALUES(item->>'dedupe_key',item->'payload') ON CONFLICT DO NOTHING;
   SELECT decision INTO existing_decision FROM news_ingestion.articles WHERE dedupe_key=item->>'dedupe_key' FOR UPDATE;
   IF existing_decision IS NOT NULL THEN CONTINUE; END IF;
   IF item->>'decision' IS NOT NULL THEN
    IF item->>'decision'='accepted' THEN
     INSERT INTO public.events(id,title,event_type,occurred_at,detected_at,entity_id,summary,source_url,raw)
     VALUES((item->'event'->>'id')::uuid,item->'event'->>'title',coalesce(item->'event'->>'event_type','news'),
       (item->'event'->>'occurred_at')::timestamptz,now(),(item->'event'->>'entity_id')::uuid,
       item->'event'->>'summary',item->'event'->>'source_url',item->'event'->'raw') ON CONFLICT(id) DO NOTHING;
    END IF;
    UPDATE news_ingestion.articles SET decision=item->>'decision',reason=item->>'reason',reviewer_id=(item->>'reviewer_id')::uuid,
      reviewed_at=coalesce((item->>'reviewed_at')::timestamptz,now()),event_id=(item->'event'->>'id')::uuid
      WHERE dedupe_key=item->>'dedupe_key' AND decision IS NULL;
   END IF;
   n:=n+1;
  END LOOP; RETURN to_jsonb(n);
 WHEN 'archive' THEN INSERT INTO news_ingestion.archive(source,payload) VALUES(args->>'source',args->'payload'); RETURN '{}';
 WHEN 'run_start' THEN
  INSERT INTO news_ingestion.runs(job_id,token,payload) VALUES((args->>'job_id')::uuid,(args->>'token')::uuid,args || jsonb_build_object('status','running','started_at',now())) RETURNING id INTO run_id; RETURN to_jsonb(run_id);
 WHEN 'run_finish' THEN UPDATE news_ingestion.runs SET payload=payload || args || jsonb_build_object('finished_at',now()) WHERE id=(args->>'id')::uuid; RETURN '{}';
 WHEN 'logs' THEN SELECT coalesce(jsonb_agg(payload),'[]') INTO out FROM news_ingestion.runs WHERE job_id=(args->>'id')::uuid AND token=(args->>'token')::uuid; RETURN out;
 WHEN 'stats' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO out FROM (SELECT payload->>'source' AS source,count(*) AS count FROM news_ingestion.articles GROUP BY payload->>'source') x; RETURN out;
 ELSE RAISE EXCEPTION 'Unknown worker operation';
 END CASE;
END $$;
REVOKE ALL ON FUNCTION public.news_worker(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.news_worker(text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
