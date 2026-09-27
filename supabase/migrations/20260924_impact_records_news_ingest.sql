-- supabase/migrations/20260924_impact_records_news_ingest.sql

alter table public.impact_records
  add column if not exists dedupe_key      text,
  add column if not exists headline        text,
  add column if not exists publisher       text,
  add column if not exists published_at    timestamptz,
  add column if not exists source          text,
  add column if not exists kind            text,
  add column if not exists tickers         text[],
  add column if not exists sentiment_label text,
  add column if not exists raw             jsonb;

-- Idempotency hook. Partial so manually-created analysis rows
-- (dedupe_key IS NULL) are unaffected.
create unique index if not exists impact_records_dedupe_key_uq
  on public.impact_records (dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_impact_records_security_published
  on public.impact_records (security, published_at desc);

comment on column public.impact_records.dedupe_key is
  'NewsLoader articles.dedupe_key. id = uuidv5(dedupe_key, NEWS_UUID_NAMESPACE).';
