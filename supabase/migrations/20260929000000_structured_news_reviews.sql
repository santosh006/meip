BEGIN;
CREATE SCHEMA IF NOT EXISTS news_review;
REVOKE ALL ON SCHEMA news_review FROM PUBLIC,anon,authenticated;
CREATE TABLE news_review.members(user_id uuid PRIMARY KEY, role text NOT NULL CHECK(role IN ('reviewer','admin')));
CREATE TABLE news_review.entity_profiles(entity_id uuid PRIMARY KEY REFERENCES public.entities(id),entity_type text NOT NULL CHECK(entity_type IN ('company','sector','industry','commodity','country','index','other')));
CREATE TABLE news_review.securities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_id uuid NOT NULL REFERENCES public.entities(id),symbol text NOT NULL,exchange text, UNIQUE(entity_id,symbol,exchange));
CREATE TABLE news_review.horizon_defaults(key text PRIMARY KEY,label text NOT NULL);
INSERT INTO news_review.horizon_defaults VALUES('immediate','Immediate: 0–1 trading days'),('short_term','Short term: 2–20 trading days'),('medium_term','Medium term: 1–6 months'),('long_term','Long term: more than 6 months');
CREATE TABLE news_review.drafts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),article_key text NOT NULL REFERENCES news_ingestion.articles(dedupe_key),owner_id uuid NOT NULL,revision int NOT NULL DEFAULT 0,document jsonb NOT NULL,base_version uuid,accepted_version uuid,superseded_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX review_open_draft ON news_review.drafts(article_key,owner_id) WHERE accepted_version IS NULL AND superseded_at IS NULL;
CREATE TABLE news_review.versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),article_key text NOT NULL REFERENCES news_ingestion.articles(dedupe_key),draft_id uuid NOT NULL UNIQUE REFERENCES news_review.drafts(id),version_no int NOT NULL,outcome text NOT NULL CHECK(outcome IN ('accepted_pending_enrichment','accepted_analysis_ready')),event_id uuid NOT NULL REFERENCES public.events(id),snapshot jsonb NOT NULL,missing_analysis jsonb NOT NULL,accepted_by uuid NOT NULL,accepted_at timestamptz NOT NULL DEFAULT now(),published_at text,ingested_at text, UNIQUE(article_key,version_no));
ALTER TABLE news_review.drafts ADD FOREIGN KEY(base_version) REFERENCES news_review.versions(id), ADD FOREIGN KEY(accepted_version) REFERENCES news_review.versions(id);
CREATE TABLE news_review.article_events(article_key text NOT NULL REFERENCES news_ingestion.articles(dedupe_key),event_id uuid NOT NULL REFERENCES public.events(id),version_id uuid NOT NULL REFERENCES news_review.versions(id),PRIMARY KEY(article_key,event_id,version_id));
CREATE TABLE news_review.evidence(id uuid NOT NULL,version_id uuid NOT NULL REFERENCES news_review.versions(id),fields jsonb NOT NULL,added_at timestamptz NOT NULL,PRIMARY KEY(version_id,id));
CREATE TABLE news_review.mappings(id uuid NOT NULL,version_id uuid NOT NULL REFERENCES news_review.versions(id),entity_id uuid REFERENCES public.entities(id),security_id uuid REFERENCES news_review.securities(id),fields jsonb NOT NULL,chain jsonb NOT NULL,advanced jsonb NOT NULL,PRIMARY KEY(version_id,id));
CREATE TABLE news_review.assessments(version_id uuid NOT NULL,mapping_id uuid NOT NULL,fields jsonb NOT NULL,PRIMARY KEY(version_id,mapping_id),FOREIGN KEY(version_id,mapping_id) REFERENCES news_review.mappings(version_id,id));
CREATE TABLE news_review.metrics(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL,mapping_id uuid NOT NULL,fields jsonb NOT NULL,evidence_id uuid,FOREIGN KEY(version_id,mapping_id) REFERENCES news_review.mappings(version_id,id),FOREIGN KEY(version_id,evidence_id) REFERENCES news_review.evidence(version_id,id));
CREATE TABLE news_review.horizons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL,mapping_id uuid NOT NULL,horizon text,fields jsonb NOT NULL,FOREIGN KEY(version_id,mapping_id) REFERENCES news_review.mappings(version_id,id));
CREATE TABLE news_review.scores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL,mapping_id uuid NOT NULL,horizon_id uuid REFERENCES news_review.horizons(id),scoring_version text NOT NULL,input jsonb NOT NULL,output jsonb NOT NULL,FOREIGN KEY(version_id,mapping_id) REFERENCES news_review.mappings(version_id,id));
CREATE TABLE news_review.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid NOT NULL,action text NOT NULL,article_key text,draft_id uuid,version_id uuid,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE news_review.observations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL REFERENCES news_review.versions(id),entity_id uuid NOT NULL REFERENCES public.entities(id),security_id uuid REFERENCES news_review.securities(id),analysis_date date NOT NULL,cutoff_at timestamptz NOT NULL,fields jsonb NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX review_observation_timeline ON news_review.observations(entity_id,analysis_date DESC);
CREATE INDEX review_versions_article ON news_review.versions(article_key,version_no DESC);
ALTER TABLE public.impact_records ADD COLUMN review_version_id uuid REFERENCES news_review.versions(id),ADD COLUMN review_mapping_id uuid,ADD COLUMN analysis_current boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX impact_review_mapping ON public.impact_records(review_version_id,review_mapping_id) WHERE review_version_id IS NOT NULL;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['members','entity_profiles','securities','horizon_defaults','drafts','versions','article_events','evidence','mappings','assessments','metrics','horizons','scores','audit','observations'] LOOP
  EXECUTE format('ALTER TABLE news_review.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON news_review.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
CREATE FUNCTION news_review.immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Accepted history is immutable' USING ERRCODE='42501'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['versions','article_events','evidence','mappings','assessments','metrics','horizons','scores','audit','observations'] LOOP
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON news_review.%I FOR EACH ROW EXECUTE FUNCTION news_review.immutable()',t);
 END LOOP;
END $$;
CREATE FUNCTION news_review.protect_projection() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF (CASE WHEN TG_OP='INSERT' THEN NEW.review_version_id IS NOT NULL ELSE OLD.review_version_id IS NOT NULL OR (TG_OP='UPDATE' AND NEW.review_version_id IS NOT NULL) END)
 AND current_user <> (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN
 RAISE EXCEPTION 'Structured impact projections are managed by review acceptance' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER protect_review_projection BEFORE INSERT OR UPDATE OR DELETE ON public.impact_records FOR EACH ROW EXECUTE FUNCTION news_review.protect_projection();
CREATE FUNCTION news_review.spec() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT '{"verification":{"headline":{"label":"Verified headline","required":true},"summary":{"label":"Event summary","kind":"textarea","required":true},"acceptance_reason":{"label":"Acceptance reason","kind":"textarea","required":true},"category":{"label":"Event category","options":["earnings","guidance","ma","regulatory","litigation","product","leadership","capital_raising","macro","other"],"required":true},"verification_status":{"label":"Verification status","options":["confirmed","partially_verified","unverified_claim","disputed"],"required":true},"source_classification":{"label":"Source classification","required":true},"source_credibility":{"label":"Source credibility (0–1; optional heuristic)","kind":"number","min":0,"max":1,"required":false},"occurrence_certainty":{"label":"Occurrence time certainty","options":["exact","approximate","unknown"],"required":true},"occurrence_at":{"label":"Occurrence time (UTC)","kind":"datetime-local"},"novelty":{"label":"Novelty","options":["new","update","correction","repeated"],"required":true},"related_event_id":{"label":"Related existing event ID"},"concerns":{"label":"Review concerns","kind":"textarea"},"additional_evidence":{"label":"Additional evidence","kind":"textarea"}},"evidence":{"label":{"label":"Source title / label","required":true},"url":{"label":"Source URL (HTTP/HTTPS)","kind":"url"},"classification":{"label":"Source classification","required":true},"excerpt":{"label":"Quotation / excerpt","kind":"textarea"},"document_ref":{"label":"Document / page reference"}},"mapping":{"entity_id":{"label":"Canonical entity","required":true},"entity_type":{"label":"Entity type","options":["company","sector","industry","commodity","country","index","other"],"required":true},"security_id":{"label":"Relevant security (optional)"},"relationship":{"label":"Relationship","options":["subject","acquirer","target","competitor","supplier","customer","lender","subsidiary","beneficiary","other"],"required":true},"exposure":{"label":"Exposure","options":["direct","indirect"],"required":true},"transmission":{"label":"Transmission mechanism","kind":"textarea","required":true},"mapping_confidence":{"label":"Mapping confidence (0–1; heuristic)","kind":"number","min":0,"max":1,"required":true},"mapping_reason":{"label":"Mapping evidence / reasoning","kind":"textarea","required":true},"exposure_magnitude":{"label":"Exposure magnitude (qualitative)"},"exposure_value":{"label":"Numeric exposure (optional)","kind":"number"},"exposure_basis":{"label":"Exposure units / basis"}},"impact":{"direction":{"label":"Direction","options":["positive","negative","mixed","neutral","unknown"],"required":true},"rationale":{"label":"Impact rationale","kind":"textarea","required":true},"metrics_status":{"label":"Affected metrics","options":["specified","unknown"],"required":true},"magnitude":{"label":"Expected magnitude","options":["low","medium","high","unknown"],"required":true},"range_low":{"label":"Magnitude range — low","kind":"number"},"range_high":{"label":"Magnitude range — high","kind":"number"},"range_basis":{"label":"Range units / supporting basis"},"effect_type":{"label":"Effect type","options":["fundamentals","sentiment","both"],"required":true},"impact_confidence":{"label":"Confidence (0–1; heuristic, not probability)","kind":"number","min":0,"max":1,"required":true},"surprise":{"label":"Versus expectations","options":["above","in_line","below","unknown"],"required":true},"expectations_evidence":{"label":"Expectations evidence","kind":"textarea"},"anticipated":{"label":"Previously known / anticipated","options":["yes","no","unknown"],"required":true},"anticipated_evidence":{"label":"Anticipation evidence","kind":"textarea"},"assumptions":{"label":"Material assumptions, or “none identified”","kind":"textarea","required":true},"counterarguments":{"label":"Counterarguments","kind":"textarea"},"invalidation":{"label":"Invalidation conditions","kind":"textarea"},"quantitative_evidence":{"label":"Quantitative evidence","kind":"textarea"}},"metric":{"name":{"label":"Metric name","required":true},"change":{"label":"Observed / expected change","options":["increase","decrease","unchanged","mixed","unknown"],"required":true},"implication":{"label":"Business implication","options":["beneficial","adverse","mixed","neutral","unknown"],"required":true},"value_low":{"label":"Value / range low","kind":"number"},"value_high":{"label":"Range high","kind":"number"},"unit":{"label":"Unit / currency"},"baseline":{"label":"Comparison baseline"},"period":{"label":"Reporting / forecast period"},"evidence_id":{"label":"Evidence reference ID"}},"horizon":{"horizon":{"label":"Horizon","required":true},"onset":{"label":"Expected onset"},"duration":{"label":"Expected duration"},"direction":{"label":"Direction","options":["positive","negative","mixed","neutral","unknown"],"required":true},"magnitude":{"label":"Magnitude","options":["low","medium","high","unknown"],"required":true},"confidence":{"label":"Confidence (0–1; heuristic, not probability)","kind":"number","min":0,"max":1,"required":true},"timing_rationale":{"label":"Timing rationale","kind":"textarea","required":true},"persistence":{"label":"Persistence","options":["one_off","temporary","recurring","structural","unknown"]},"catalyst":{"label":"Next catalyst"},"catalyst_date":{"label":"Catalyst date","kind":"date"},"date_certainty":{"label":"Catalyst date certainty","options":["exact","estimated","unknown"]},"review_date":{"label":"Next review date","kind":"date","required":true}},"advanced":{"base":{"label":"Base scenario","kind":"textarea"},"upside":{"label":"Upside scenario","kind":"textarea"},"downside":{"label":"Downside scenario","kind":"textarea"},"scenario_assumptions":{"label":"Scenario assumptions","kind":"textarea"},"base_likelihood":{"label":"Base likelihood (optional, 0–1)","kind":"number","min":0,"max":1},"upside_likelihood":{"label":"Upside likelihood (optional, 0–1)","kind":"number","min":0,"max":1},"downside_likelihood":{"label":"Downside likelihood (optional, 0–1)","kind":"number","min":0,"max":1},"dependencies":{"label":"Dependencies","kind":"textarea"},"second_order":{"label":"Second-order effects","kind":"textarea"},"monitoring":{"label":"Monitoring indicators","kind":"textarea"},"owner":{"label":"Follow-up owner"},"specialist":{"label":"Specialist review","options":["yes","no"]}},"observation":{"analysis_date":{"label":"Analysis date","kind":"date","required":true},"cutoff_at":{"label":"Information cutoff (UTC)","kind":"datetime-local","required":true},"entity_id":{"label":"Canonical entity","required":true},"security_id":{"label":"Security (optional)"},"session":{"label":"Exchange / session"},"assessment":{"label":"Current assessment","kind":"textarea","required":true},"mode":{"label":"Assessment method","options":["recomputed","carried_forward"],"required":true},"revision_reason":{"label":"Revision reason","kind":"textarea","required":true},"new_evidence":{"label":"New evidence","kind":"textarea"},"related_events":{"label":"Related event IDs (comma separated)"},"price_return":{"label":"Observed price return (%)","kind":"number"},"benchmark_return":{"label":"Benchmark / sector return (%)","kind":"number"},"relative_return":{"label":"Benchmark-relative return (%)","kind":"number"},"volume_change":{"label":"Volume change (%)","kind":"number"},"outcome":{"label":"Outcome","options":["pending","supporting_evidence","contradictory_evidence","inconclusive"],"required":true},"confounders":{"label":"Confounding events","kind":"textarea"},"source":{"label":"Observation source"},"method":{"label":"Calculation method"}}}'::jsonb $$;
CREATE FUNCTION news_review.field_errors(data jsonb,spec jsonb,label text,complete boolean) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE r record; v jsonb; s text; errors jsonb:='[]'; present boolean;
BEGIN
 IF jsonb_typeof(data) IS DISTINCT FROM 'object' THEN RETURN jsonb_build_array(label||': expected an object'); END IF;
 FOR r IN SELECT key FROM jsonb_object_keys(data) AS x(key) LOOP
  IF NOT spec ? r.key THEN errors:=errors||jsonb_build_array(label||': unsupported field '||r.key); END IF;
 END LOOP;
 FOR r IN SELECT key,value FROM jsonb_each(spec) LOOP
  v:=data->r.key;s:=data->>r.key;present:=v IS NOT NULL AND v<>'null' AND coalesce(trim(s),'')<>'';
  IF NOT present THEN
   IF complete AND coalesce((r.value->>'required')::boolean,false) THEN errors:=errors||jsonb_build_array(label||': '||(r.value->>'label')||' is required'); END IF;
  ELSIF r.value->>'kind'='number' THEN
   IF jsonb_typeof(v)<>'number' THEN errors:=errors||jsonb_build_array(label||': invalid number '||r.key);
   ELSIF (r.value ? 'min' AND s::numeric<(r.value->>'min')::numeric) OR (r.value ? 'max' AND s::numeric>(r.value->>'max')::numeric) THEN errors:=errors||jsonb_build_array(label||': number out of bounds '||r.key); END IF;
  ELSIF jsonb_typeof(v)<>'string' OR length(s)>10000 THEN errors:=errors||jsonb_build_array(label||': invalid text '||r.key);
  ELSIF r.value ? 'options' AND NOT (r.value->'options') ? s THEN errors:=errors||jsonb_build_array(label||': unsupported value '||r.key);
  ELSIF r.value->>'kind'='url' AND (s !~* '^https?://[^/@[:space:]]+(\.[^/@[:space:]]+|:[0-9]+)?([/?#][^[:space:]]*)?$' OR s ~* '^https?://[^/]*@') THEN errors:=errors||jsonb_build_array(label||': invalid HTTP/HTTPS URL');
  ELSIF r.value->>'kind' IN ('date','datetime-local') THEN
   BEGIN
    IF s !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$' THEN RAISE invalid_datetime_format; END IF;
    PERFORM s::timestamptz;
   EXCEPTION WHEN OTHERS THEN errors:=errors||jsonb_build_array(label||': invalid date '||r.key); END;
  END IF;
 END LOOP;
 RETURN errors;
END $$;
CREATE FUNCTION news_review.errors(doc jsonb,mode text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,news_review AS $$
DECLARE spec jsonb:=news_review.spec(); errors jsonb; v jsonb:=doc->'verification'; e jsonb; m jsonb; metric jsonb; h jsonb; f jsonb; a jsonb; ready boolean:=mode='accepted_analysis_ready'; complete boolean:=mode<>'draft'; ids text[]:='{}'; mids text[]:='{}'; hs text[]; x text;
BEGIN
 errors:=news_review.field_errors(v,spec->'verification','Verification',complete);
 IF jsonb_typeof(doc->'evidence') IS DISTINCT FROM 'array' OR jsonb_typeof(doc->'mappings') IS DISTINCT FROM 'array' OR jsonb_typeof(doc->'event_ids') IS DISTINCT FROM 'array' THEN RETURN errors||'["Invalid review lists"]'; END IF;
 IF jsonb_array_length(doc->'evidence')>20 OR jsonb_array_length(doc->'mappings')>20 OR jsonb_array_length(doc->'event_ids')>20 THEN RETURN errors||'["Too many review entries"]'; END IF;
 IF complete THEN
  IF v->>'occurrence_certainty'<>'unknown' AND coalesce(v->>'occurrence_at','')='' THEN errors:=errors||'["Occurrence time is required"]'; END IF;
  IF v->>'occurrence_certainty'='unknown' AND coalesce(v->>'occurrence_at','')<>'' THEN errors:=errors||'["Clear unknown occurrence time"]'; END IF;
  IF v->>'novelty'<>'new' AND coalesce(v->>'related_event_id','')='' THEN errors:=errors||'["Related event is required"]'; END IF;
  IF v->>'verification_status'='disputed' AND coalesce(trim(v->>'concerns'),'')='' THEN errors:=errors||'["Disputed claims require concerns"]'; END IF;
  IF jsonb_array_length(doc->'evidence')=0 THEN errors:=errors||'["At least one evidence reference is required"]'; END IF;
 END IF;
 IF nullif(v->>'related_event_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.events WHERE id=(v->>'related_event_id')::uuid) THEN errors:=errors||'["Related event does not exist"]'; END IF;
 FOR x IN SELECT jsonb_array_elements_text(doc->'event_ids') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=x::uuid) THEN errors:=errors||'["Linked event does not exist"]'; END IF;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements(doc->'evidence') LOOP
  PERFORM (e->>'id')::uuid;PERFORM (e->>'added_at')::timestamptz;
  IF e->>'id' IS NULL OR e->>'added_at' IS NULL OR e->>'id'=ANY(ids) THEN errors:=errors||'["Invalid or duplicate evidence ID"]'; END IF;ids:=array_append(ids,e->>'id');
  errors:=errors||news_review.field_errors(e->'fields',spec->'evidence','Evidence',complete);
  IF complete AND coalesce(e->'fields'->>'url','')='' AND coalesce(e->'fields'->>'document_ref','')='' THEN errors:=errors||'["Evidence requires URL or document/page reference"]'; END IF;
 END LOOP;
 IF ready AND jsonb_array_length(doc->'mappings')=0 THEN errors:=errors||'["At least one affected entity is required"]'; END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(doc->'mappings') LOOP
  PERFORM (m->>'id')::uuid;
  IF m->>'id' IS NULL OR m->>'id'=ANY(mids) THEN errors:=errors||'["Invalid or duplicate mapping ID"]'; END IF;mids:=array_append(mids,m->>'id');
  f:=m->'fields';a:=m->'impact';
  errors:=errors||news_review.field_errors(f,spec->'mapping','Mapping',ready)||news_review.field_errors(a,spec->'impact','Impact',ready)||news_review.field_errors(m->'advanced',spec->'advanced','Advanced',false);
  IF jsonb_typeof(m->'chain') IS DISTINCT FROM 'array' OR jsonb_typeof(m->'metrics') IS DISTINCT FROM 'array' OR jsonb_typeof(m->'horizons') IS DISTINCT FROM 'array' THEN RETURN errors||'["Invalid assessment lists"]'; END IF;
  IF jsonb_array_length(m->'chain')>20 OR jsonb_array_length(m->'metrics')>20 OR jsonb_array_length(m->'horizons')>20 THEN RETURN errors||'["Too many assessment entries"]'; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(m->'chain') LOOP IF jsonb_typeof(e)<>'string' OR length(e#>>'{}')>2000 THEN errors:=errors||'["Invalid causal chain step"]'; END IF; END LOOP;
  IF nullif(f->>'entity_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.entities WHERE id=(f->>'entity_id')::uuid) THEN errors:=errors||'["Entity does not exist"]'; END IF;
  IF nullif(f->>'security_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM news_review.securities WHERE id=(f->>'security_id')::uuid AND entity_id=(f->>'entity_id')::uuid) THEN errors:=errors||'["Security does not belong to mapped entity"]'; END IF;
  IF ready THEN
   IF f->>'exposure'='indirect' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(m->'chain') AS step(value) WHERE trim(step.value)<>'') THEN errors:=errors||'["Indirect mapping requires causal chain"]'; END IF;
   IF jsonb_typeof(f->'exposure_value')='number' AND coalesce(f->>'exposure_basis','')='' THEN errors:=errors||'["Numeric exposure needs units/basis"]'; END IF;
   IF a->>'surprise'<>'unknown' AND coalesce(a->>'expectations_evidence','')='' THEN errors:=errors||'["Expectations evidence is required"]'; END IF;
   IF a->>'metrics_status'='specified' AND jsonb_array_length(m->'metrics')=0 THEN errors:=errors||'["Add metrics or mark unknown"]'; END IF;
   IF a->>'metrics_status'='unknown' AND jsonb_array_length(m->'metrics')<>0 THEN errors:=errors||'["Remove metrics or mark specified"]'; END IF;
   IF (jsonb_typeof(a->'range_low')='number' OR jsonb_typeof(a->'range_high')='number') AND coalesce(a->>'range_basis','')='' THEN errors:=errors||'["Numeric magnitude needs supporting basis"]'; END IF;
   IF (a->>'range_low')::numeric>(a->>'range_high')::numeric THEN errors:=errors||'["Magnitude range reversed"]'; END IF;
   IF jsonb_array_length(m->'horizons')=0 THEN errors:=errors||'["At least one horizon per entity is required"]'; END IF;
  END IF;
  FOR metric IN SELECT value FROM jsonb_array_elements(m->'metrics') LOOP
   errors:=errors||news_review.field_errors(metric,spec->'metric','Metric',ready);
   IF nullif(metric->>'evidence_id','') IS NOT NULL AND NOT (metric->>'evidence_id'=ANY(ids)) THEN errors:=errors||'["Metric references missing evidence"]'; END IF;
   IF ready AND (jsonb_typeof(metric->'value_low')='number' OR jsonb_typeof(metric->'value_high')='number') AND (coalesce(metric->>'unit','')='' OR coalesce(metric->>'baseline','')='' OR coalesce(metric->>'period','')='' OR coalesce(metric->>'evidence_id','')='') THEN errors:=errors||'["Numeric metric needs units baseline period evidence"]'; END IF;
   IF (metric->>'value_low')::numeric>(metric->>'value_high')::numeric THEN errors:=errors||'["Metric range reversed"]'; END IF;
  END LOOP;
  hs:='{}';
  FOR h IN SELECT value FROM jsonb_array_elements(m->'horizons') LOOP
   errors:=errors||news_review.field_errors(h,spec->'horizon','Horizon',ready);
   IF nullif(h->>'horizon','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM news_review.horizon_defaults WHERE key=h->>'horizon') THEN errors:=errors||'["Unknown horizon"]'; END IF;
   IF ready AND h->>'horizon'=ANY(hs) THEN errors:=errors||'["Duplicate horizon"]'; END IF;hs:=array_append(hs,h->>'horizon');
   IF ready AND ((nullif(h->>'catalyst_date','') IS NOT NULL AND coalesce(h->>'date_certainty','unknown') NOT IN ('exact','estimated')) OR (h->>'date_certainty' IN ('exact','estimated') AND nullif(h->>'catalyst_date','') IS NULL)) THEN errors:=errors||'["Catalyst date/certainty mismatch"]'; END IF;
  END LOOP;
 END LOOP;
 RETURN errors;
END $$;
CREATE FUNCTION news_review.score(input jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE magnitude int; reason text; result jsonb; c text;
BEGIN
 result:=jsonb_build_object('version','review-v2.0.0','direction',input->'direction','confidence',jsonb_build_object('sourceCredibility',input->'sourceCredibility','mappingConfidence',input->'mappingConfidence','impactConfidence',input->'impactConfidence','label','Uncalibrated heuristic indicators; not probabilities'));
 FOREACH c IN ARRAY ARRAY['sourceCredibility','mappingConfidence','impactConfidence'] LOOP
  IF input->c IS NULL OR (input->c<>'null' AND (jsonb_typeof(input->c)<>'number' OR (input->>c)::numeric<0 OR (input->>c)::numeric>1)) THEN reason:='Invalid scoring input'; END IF;
 END LOOP;
 IF coalesce(input->>'direction','') NOT IN ('positive','negative','mixed','neutral','unknown') OR coalesce(input->>'magnitude','') NOT IN ('low','medium','high','unknown') THEN reason:='Invalid scoring input'; END IF;
 IF reason IS NULL AND coalesce(input->>'category','') NOT IN ('earnings','guidance','ma','regulatory','litigation','product','leadership','capital_raising','macro') THEN reason:='Category has no defined scoring rule'; END IF;
 IF reason IS NULL AND (input->>'direction'='unknown' OR input->>'magnitude'='unknown') THEN reason:='Direction or magnitude is explicitly unknown'; END IF;
 IF reason IS NOT NULL THEN RETURN result||jsonb_build_object('status','unscored','magnitude',NULL,'significance',NULL,'rationale',reason); END IF;
 magnitude:=CASE input->>'magnitude' WHEN 'low' THEN 20 WHEN 'medium' THEN 55 WHEN 'high' THEN 85 END;
 RETURN result||jsonb_build_object('status','scored','magnitude',magnitude,'significance',CASE WHEN magnitude>=75 THEN 'critical' WHEN magnitude>=50 THEN 'high' WHEN magnitude>=25 THEN 'medium' ELSE 'low' END,'rationale',(input->>'magnitude')||' magnitude maps to '||magnitude||'/100; direction is stored separately. Confidence is not a probability.');
END $$;
CREATE FUNCTION public.review_workflow(action text,args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,news_review AS $$
DECLARE actor uuid:=auth.uid(); d news_review.drafts; v news_review.versions; article news_ingestion.articles; doc jsonb; latest uuid; vid uuid; eid uuid; mid uuid; hid uuid; output jsonb; input jsonb; errors jsonb; missing jsonb; m jsonb; h jsonb; e jsonb; f jsonb; a jsonb; version_no_value int; x text; result jsonb; reviewer boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 reviewer:=EXISTS(SELECT 1 FROM news_review.members WHERE user_id=actor);
 IF action='load' THEN
  SELECT * INTO article FROM news_ingestion.articles WHERE dedupe_key=args->>'article';
  IF NOT FOUND THEN RAISE EXCEPTION 'Article not found' USING ERRCODE='PT404'; END IF;
  SELECT * INTO d FROM news_review.drafts WHERE article_key=article.dedupe_key AND owner_id=actor AND accepted_version IS NULL AND superseded_at IS NULL;
  RETURN jsonb_build_object('article',article.payload,'articleDecision',article.decision,'canReview',reviewer,'draft',CASE WHEN d.id IS NULL THEN NULL ELSE to_jsonb(d) END,
   'versions',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.version_no DESC) FROM news_review.versions r WHERE r.article_key=article.dedupe_key),'[]'),
   'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'name',n.name,'ticker',n.ticker,'entity_type',coalesce(p.entity_type,'company')) ORDER BY n.name) FROM public.entities n LEFT JOIN news_review.entity_profiles p ON p.entity_id=n.id),'[]'),
   'securities',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM news_review.securities s),'[]'),
   'horizons',(SELECT jsonb_agg(to_jsonb(hd)) FROM news_review.horizon_defaults hd),
   'events',coalesce((SELECT jsonb_agg(to_jsonb(ev)) FROM (SELECT id,title FROM public.events ORDER BY detected_at DESC LIMIT 200)ev),'[]'),
   'scores',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM news_review.scores s JOIN news_review.versions r ON r.id=s.version_id WHERE r.article_key=article.dedupe_key),'[]'),
   'observations',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.analysis_date DESC,o.created_at DESC) FROM news_review.observations o JOIN news_review.versions r ON r.id=o.version_id WHERE r.article_key=article.dedupe_key),'[]'),
   'audit',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id DESC) FROM news_review.audit t WHERE t.article_key=article.dedupe_key),'[]'));
 ELSIF action='drafts' THEN
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('article',article_key,'id',id,'updated_at',updated_at)) FROM news_review.drafts WHERE owner_id=actor AND accepted_version IS NULL),'[]');
 ELSIF action='feed' THEN
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (
   SELECT feed_version.id,feed_version.article_key,feed_version.version_no,feed_version.outcome,feed_version.accepted_at,feed_version.snapshot,feed_version.missing_analysis,
    coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM news_review.scores s WHERE s.version_id=feed_version.id),'[]') AS scores,
    coalesce((SELECT jsonb_object_agg(n.id::text,n.name) FROM public.entities n JOIN news_review.mappings map_row ON map_row.entity_id=n.id WHERE map_row.version_id=feed_version.id),'{}') AS entities
   FROM news_review.versions feed_version WHERE feed_version.outcome=CASE WHEN args->>'mode'='pending' THEN 'accepted_pending_enrichment' ELSE 'accepted_analysis_ready' END
   AND NOT EXISTS(SELECT 1 FROM news_review.versions newer WHERE newer.article_key=feed_version.article_key AND newer.version_no>feed_version.version_no)
   AND (coalesce(args->>'q','')='' OR feed_version.snapshot::text ILIKE '%'||(args->>'q')||'%')
   ORDER BY feed_version.accepted_at DESC,feed_version.id LIMIT 26 OFFSET greatest(0,coalesce((args->>'offset')::int,0))
  )r),'[]');
 END IF;
 IF NOT reviewer THEN RAISE EXCEPTION 'Reviewer access is required. Ask an administrator to grant review membership.' USING ERRCODE='PT403'; END IF;
 IF action='entity' THEN
  IF coalesce(trim(args->>'name'),'')='' OR length(args->>'name')>200 OR coalesce(args->>'entity_type','') NOT IN ('company','sector','industry','commodity','country','index','other') THEN RAISE EXCEPTION 'Invalid canonical entity' USING ERRCODE='PT400'; END IF;
  INSERT INTO public.entities(name,ticker) VALUES(trim(args->>'name'),nullif(args->>'ticker','')) RETURNING id INTO eid;
  INSERT INTO news_review.entity_profiles VALUES(eid,args->>'entity_type');
  INSERT INTO news_review.audit(actor_id,action,details) VALUES(actor,'entity_created',jsonb_build_object('entity_id',eid));
  RETURN jsonb_build_object('id',eid);
 ELSIF action='security' THEN
  IF coalesce(trim(args->>'symbol'),'')='' OR length(args->>'symbol')>40 THEN RAISE EXCEPTION 'Security symbol required' USING ERRCODE='PT400'; END IF;
  INSERT INTO news_review.securities(entity_id,symbol,exchange) VALUES((args->>'entity_id')::uuid,trim(args->>'symbol'),nullif(args->>'exchange','')) RETURNING id INTO eid;
  INSERT INTO news_review.audit(actor_id,action,details) VALUES(actor,'security_created',jsonb_build_object('security_id',eid));
  RETURN jsonb_build_object('id',eid);
 ELSIF action='restart' THEN
  SELECT * INTO article FROM news_ingestion.articles WHERE dedupe_key=args->>'article' FOR UPDATE;
  SELECT * INTO v FROM news_review.versions WHERE article_key=article.dedupe_key ORDER BY version_no DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No accepted version to revise' USING ERRCODE='PT404'; END IF;
  UPDATE news_review.drafts SET superseded_at=now() WHERE article_key=article.dedupe_key AND owner_id=actor AND accepted_version IS NULL AND superseded_at IS NULL;
  INSERT INTO news_review.drafts(article_key,owner_id,document,base_version) VALUES(article.dedupe_key,actor,v.snapshot,v.id) RETURNING * INTO d;
  INSERT INTO news_review.audit(actor_id,action,article_key,draft_id) VALUES(actor,'draft_restarted_from_latest',article.dedupe_key,d.id);
  RETURN to_jsonb(d);
 ELSIF action='save' THEN
  IF octet_length((args->'document')::text)>262144 THEN RAISE EXCEPTION 'Review document exceeds 256 KB' USING ERRCODE='PT400'; END IF;
  doc:=args->'document';errors:=news_review.errors(doc,'draft');
  IF jsonb_array_length(errors)>0 THEN RAISE EXCEPTION '%',errors USING ERRCODE='PT400'; END IF;
  SELECT * INTO article FROM news_ingestion.articles WHERE dedupe_key=args->>'article' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article not found' USING ERRCODE='PT404'; END IF;
  IF article.decision='rejected' THEN RAISE EXCEPTION 'This article has been rejected' USING ERRCODE='PT409'; END IF;
  IF nullif(args->>'draft_id','') IS NULL THEN
   SELECT id INTO latest FROM news_review.versions WHERE article_key=article.dedupe_key ORDER BY version_no DESC LIMIT 1;
   INSERT INTO news_review.drafts(article_key,owner_id,document,base_version) VALUES(article.dedupe_key,actor,doc,latest) RETURNING * INTO d;
  ELSE
   UPDATE news_review.drafts SET document=doc,revision=revision+1,updated_at=now() WHERE id=(args->>'draft_id')::uuid AND article_key=article.dedupe_key AND owner_id=actor AND accepted_version IS NULL AND superseded_at IS NULL AND revision=(args->>'revision')::int RETURNING * INTO d;
   IF NOT FOUND THEN RAISE EXCEPTION 'Draft changed in another tab or was accepted. Reload before saving; your entered data has been preserved.' USING ERRCODE='PT409'; END IF;
  END IF;
  INSERT INTO news_review.audit(actor_id,action,article_key,draft_id,details) VALUES(actor,'draft_saved',article.dedupe_key,d.id,jsonb_build_object('revision',d.revision));
  RETURN to_jsonb(d);
 ELSIF action='accept' THEN
  -- Lock the article first for all mutations: consistent lock order avoids review/rejection races.
  SELECT * INTO article FROM news_ingestion.articles WHERE dedupe_key=(SELECT article_key FROM news_review.drafts WHERE id=(args->>'draft_id')::uuid AND owner_id=actor) FOR UPDATE;
  SELECT * INTO d FROM news_review.drafts WHERE id=(args->>'draft_id')::uuid AND owner_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft not found' USING ERRCODE='PT404'; END IF;
  IF d.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'This draft was superseded. Reload the latest draft.' USING ERRCODE='PT409'; END IF;
  IF d.accepted_version IS NOT NULL THEN
   SELECT * INTO v FROM news_review.versions WHERE id=d.accepted_version;
   IF v.outcome IS DISTINCT FROM args->>'outcome' THEN RAISE EXCEPTION 'Draft was already accepted with a different outcome' USING ERRCODE='PT409'; END IF;
   RETURN jsonb_build_object('ok',true,'version_id',v.id,'alreadyAccepted',true);
  END IF;
  IF d.revision IS DISTINCT FROM (args->>'revision')::int OR article.decision='rejected' THEN RAISE EXCEPTION 'Draft or article changed. Reload and review the latest version.' USING ERRCODE='PT409'; END IF;
  SELECT id INTO latest FROM news_review.versions WHERE article_key=d.article_key ORDER BY version_no DESC LIMIT 1;
  IF latest IS DISTINCT FROM d.base_version THEN RAISE EXCEPTION 'Another review was accepted since this draft began. Reload the latest version and create a new draft.' USING ERRCODE='PT409'; END IF;
  IF coalesce(args->>'outcome','') NOT IN ('accepted_pending_enrichment','accepted_analysis_ready') THEN RAISE EXCEPTION 'Invalid acceptance outcome' USING ERRCODE='PT400'; END IF;
  doc:=d.document;errors:=news_review.errors(doc,args->>'outcome');missing:=news_review.errors(doc,'accepted_analysis_ready');
  IF jsonb_array_length(errors)>0 THEN RAISE EXCEPTION '%',errors USING ERRCODE='PT400'; END IF;
  SELECT coalesce(max(version_no),0)+1 INTO version_no_value FROM news_review.versions WHERE article_key=d.article_key;
  SELECT event_id INTO eid FROM news_review.versions WHERE id=latest;
  eid:=coalesce(eid,article.event_id,nullif(doc->'verification'->>'related_event_id','')::uuid);
  IF eid IS NULL THEN
   INSERT INTO public.events(title,summary,event_type,occurred_at,raw) VALUES(doc->'verification'->>'headline',doc->'verification'->>'summary',doc->'verification'->>'category',coalesce(nullif(doc->'verification'->>'occurrence_at','')::timestamptz,nullif(article.payload->>'published_at','')::timestamptz,nullif(article.payload->>'fetched_at','')::timestamptz,now()),jsonb_build_object('dedupe_key',d.article_key,'source',article.payload->>'source','review',jsonb_build_object('decision','accepted','reviewer_id',actor),'occurrence_certainty',doc->'verification'->>'occurrence_certainty')) RETURNING id INTO eid;
  END IF;
  INSERT INTO news_review.versions(article_key,draft_id,version_no,outcome,event_id,snapshot,missing_analysis,accepted_by,published_at,ingested_at) VALUES(d.article_key,d.id,version_no_value,args->>'outcome',eid,doc,missing,actor,article.payload->>'published_at',article.payload->>'fetched_at') RETURNING id INTO vid;
  INSERT INTO news_review.article_events VALUES(d.article_key,eid,vid);
  FOR x IN SELECT jsonb_array_elements_text(doc->'event_ids') UNION SELECT nullif(doc->'verification'->>'related_event_id','') LOOP
   IF x IS NOT NULL THEN INSERT INTO news_review.article_events VALUES(d.article_key,x::uuid,vid) ON CONFLICT DO NOTHING; END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(doc->'evidence') LOOP INSERT INTO news_review.evidence VALUES((e->>'id')::uuid,vid,e->'fields',(e->>'added_at')::timestamptz); END LOOP;
  UPDATE public.impact_records SET analysis_current=false WHERE review_version_id IN (SELECT id FROM news_review.versions WHERE article_key=d.article_key);
  FOR m IN SELECT value FROM jsonb_array_elements(doc->'mappings') LOOP
   mid:=(m->>'id')::uuid;f:=m->'fields';a:=m->'impact';
   INSERT INTO news_review.mappings VALUES(mid,vid,nullif(f->>'entity_id','')::uuid,nullif(f->>'security_id','')::uuid,f,m->'chain',m->'advanced');
   INSERT INTO news_review.assessments VALUES(vid,mid,a);
   FOR e IN SELECT value FROM jsonb_array_elements(m->'metrics') LOOP INSERT INTO news_review.metrics(version_id,mapping_id,fields,evidence_id) VALUES(vid,mid,e,nullif(e->>'evidence_id','')::uuid); END LOOP;
   input:=jsonb_build_object('category',doc->'verification'->'category','direction',coalesce(a->'direction','"unknown"'),'magnitude',coalesce(a->'magnitude','"unknown"'),'sourceCredibility',doc->'verification'->'source_credibility','mappingConfidence',f->'mapping_confidence','impactConfidence',a->'impact_confidence');
   output:=news_review.score(input);
   INSERT INTO news_review.scores(version_id,mapping_id,scoring_version,input,output) VALUES(vid,mid,'review-v2.0.0',input,output);
   IF args->>'outcome'='accepted_analysis_ready' THEN
    INSERT INTO public.impact_records(company,security,entity_id,event_id,event_type,event_status,direction,materiality,confidence,summary,evidence_url,review_version_id,review_mapping_id)
    SELECT n.name,s.symbol,n.id,eid,doc->'verification'->>'category',doc->'verification'->>'verification_status',a->>'direction',a->>'magnitude',nullif(a->>'impact_confidence','')::numeric,a->>'rationale',doc->'evidence'->0->'fields'->>'url',vid,mid FROM public.entities n LEFT JOIN news_review.securities s ON s.id=nullif(f->>'security_id','')::uuid WHERE n.id=(f->>'entity_id')::uuid;
   END IF;
   FOR h IN SELECT value FROM jsonb_array_elements(m->'horizons') LOOP
    INSERT INTO news_review.horizons(version_id,mapping_id,horizon,fields) VALUES(vid,mid,h->>'horizon',h) RETURNING id INTO hid;
    input:=input||jsonb_build_object('direction',coalesce(h->'direction','"unknown"'),'magnitude',coalesce(h->'magnitude','"unknown"'),'impactConfidence',h->'confidence');
    INSERT INTO news_review.scores(version_id,mapping_id,horizon_id,scoring_version,input,output) VALUES(vid,mid,hid,'review-v2.0.0',input,news_review.score(input));
   END LOOP;
  END LOOP;
  UPDATE news_ingestion.articles SET decision='accepted',event_id=eid,reviewer_id=actor,reviewed_at=now(),reason=doc->'verification'->>'acceptance_reason' WHERE dedupe_key=d.article_key;
  UPDATE news_review.drafts SET accepted_version=vid,revision=revision+1,updated_at=now() WHERE id=d.id;
  INSERT INTO news_review.audit(actor_id,action,article_key,draft_id,version_id,details) VALUES(actor,args->>'outcome',d.article_key,d.id,vid,jsonb_build_object('version',version_no_value));
  RETURN jsonb_build_object('ok',true,'version_id',vid,'event_id',eid);
 ELSIF action='observe' THEN
  SELECT * INTO v FROM news_review.versions WHERE id=(args->>'version_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Accepted review version not found' USING ERRCODE='PT404'; END IF;
  f:=args->'fields';errors:=news_review.field_errors(f,news_review.spec()->'observation','Observation',true);
  IF jsonb_array_length(errors)>0 THEN RAISE EXCEPTION '%',errors USING ERRCODE='PT400'; END IF;
  IF NOT EXISTS(SELECT 1 FROM news_review.mappings WHERE version_id=v.id AND entity_id=(f->>'entity_id')::uuid) THEN RAISE EXCEPTION 'Observation entity must belong to this accepted version' USING ERRCODE='PT400'; END IF;
  IF nullif(f->>'security_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM news_review.securities WHERE id=(f->>'security_id')::uuid AND entity_id=(f->>'entity_id')::uuid) THEN RAISE EXCEPTION 'Security mismatch' USING ERRCODE='PT400'; END IF;
  IF (f->>'cutoff_at')::timestamptz<v.accepted_at OR (f->>'cutoff_at')::timestamptz>clock_timestamp() OR (f->>'analysis_date')::date<v.accepted_at::date OR (f->>'analysis_date')::date>current_date OR (f->>'cutoff_at')::date>(f->>'analysis_date')::date THEN RAISE EXCEPTION 'Observation cutoff must be after acceptance and no later than the analysis date or now' USING ERRCODE='PT400'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(f) WHERE key IN ('price_return','benchmark_return','relative_return','volume_change') AND jsonb_typeof(value)='number') AND (coalesce(f->>'source','')='' OR coalesce(f->>'method','')='') THEN RAISE EXCEPTION 'Observed numbers require source and calculation method' USING ERRCODE='PT400'; END IF;
  IF nullif(f->>'related_events','') IS NOT NULL THEN
   FOREACH x IN ARRAY string_to_array(f->>'related_events',',') LOOP IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=trim(x)::uuid) THEN RAISE EXCEPTION 'Related event not found' USING ERRCODE='PT400'; END IF; END LOOP;
  END IF;
  INSERT INTO news_review.observations(version_id,entity_id,security_id,analysis_date,cutoff_at,fields,created_by) VALUES(v.id,(f->>'entity_id')::uuid,nullif(f->>'security_id','')::uuid,(f->>'analysis_date')::date,(f->>'cutoff_at')::timestamptz,f,actor) RETURNING id INTO eid;
  INSERT INTO news_review.audit(actor_id,action,article_key,version_id,details) VALUES(actor,'observation_added',v.article_key,v.id,jsonb_build_object('observation_id',eid));
  RETURN jsonb_build_object('ok',true,'id',eid);
 END IF;
 RAISE EXCEPTION 'Unknown review action' USING ERRCODE='PT400';
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'A draft or matching record already exists. Reload to resume it.' USING ERRCODE='PT409';
 WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Invalid identifier, date, or numeric value' USING ERRCODE='PT400';
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA news_review FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_workflow(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_workflow(text,jsonb) TO authenticated;
-- Retain legacy reads, queue operations and rejection, but close the old acceptance bypass.
ALTER FUNCTION public.news_workspace(text,jsonb) RENAME TO news_workspace_before_structured_review;
REVOKE ALL ON FUNCTION public.news_workspace_before_structured_review(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.news_workspace(action text,args jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
 IF action='review' AND args->>'decision'='accepted' THEN RAISE EXCEPTION 'Open Review / Accept and complete the structured review workflow.' USING ERRCODE='PT409'; END IF;
 result:=public.news_workspace_before_structured_review(action,args);
 IF action='review' AND args->>'decision'='rejected' AND coalesce((result->>'alreadyReviewed')::boolean,false)=false THEN
  INSERT INTO news_review.audit(actor_id,action,article_key,details) VALUES(auth.uid(),'rejected',args->>'id',jsonb_build_object('reason',args->>'reason'));
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.news_workspace(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.news_workspace(text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
