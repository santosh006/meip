# Market Event Intelligence Platform

MEIP combines a Next.js 16 / React 19 analyst workspace with Supabase, Cloudflare R2 document storage, and a Python news worker backed by SQLite.

## Run locally

Use Node **22** (`nvm use`, then `npm ci`) and Python 3.12+.

1. Copy `.env.example` to `.env.local`. Set the Supabase public URL/key and R2 credentials. Set `NEWS_DB_PATH` to an **absolute path** such as `/absolute/path/to/meip/news_loader/data/news.sqlite`, and `DATA_DIR` to the corresponding directory. Never commit credentials.
2. Install Python dependencies: `python3 -m venv news_loader/.venv`, then `news_loader/.venv/bin/pip install -r news_loader/requirements.txt`.
3. Apply the SQL migrations in chronological filename order to your development Supabase project before starting the app. See the migration notes below.
4. Set `NEWSLOADER_PYTHON` in `.env.local` to your Python environment (for example `/absolute/path/to/meip/news_loader/.venv/bin/python`). Provider keys can be set in `.env.local` or `news_loader/.env` (ignored by Git).
5. Run `npm run dev` to start both Next.js and the news worker. Sign in with an existing Supabase user. If the app is already running, `npm run worker` starts just the worker.

The npm worker launcher reads the same Next.js environment files as the app, respects `NEWSLOADER_PYTHON`, and normalizes the shared database path. A directly launched Python worker still needs its environment passed explicitly. The worker initializes the article and queue schemas, publishes the source catalogue, and executes queued jobs. Run only one worker per SQLite file. The web app and worker must share a persistent local filesystem, not an NFS mount or separate ephemeral serverless filesystems.

## Features and data flow

- **StockFinder / NewsFinder:** server-side search and pages of 25 results, accurate record counts, previews of the latest five impacts, and links to paginated detail pages. Relationships use entity/event UUIDs.
- **News ingestion:** `POST /api/news/ingest` creates a durable job and returns HTTP 202. The UI polls `GET /api/news/ingest?id=…` and reconnects to the most recent job after refresh. Each user may have one active job. Jobs survive web-process restarts; interrupted worker jobs retry on worker restart. Source failures are reported independently.
- **Review:** any article can be accepted or rejected, with no ticker requirement. Acceptance writes a standalone news event to Supabase before SQLite cleanup; it does not create an impact assessment. Existing ticker/entity matches are optional, and unmatched `entity_id` values remain null. Source tickers, original text, and review reasons are retained separately. Deterministic event IDs and durable intents make retries safe. NewsFinder shows accepted news, including unlinked articles; pending and rejected articles stay out. Older approved reviews are materialized into events in batches of 25 on NewsFinder visits, preserving existing event links. Legacy reviews may only retain the headline/source rather than the full deleted article. No new Supabase column or RPC is required for this acceptance flow.
- **Documents:** PDF, HTML, TXT, XML, CSV, JSON, ZIP, XLSX, maximum 20 MB. Uploads reserve a hash-keyed database row first, then put the content in R2 and finalize its status. A failure leaves an `uploading` row visible; upload the same file again to finish. Concurrent retries write identical bytes to the same key. Uploader identity comes from the session.
- **Scoring:** deterministic rules; event and impact persistence runs in one PostgreSQL transaction.

## Access model

This is a **shared internal analyst workspace**. All authenticated users can read and write workspace data, and only authenticated users can use the APIs. Job status is scoped to the requesting user. Supabase RLS policies reflect this shared model; this is not a tenant-isolated SaaS. Disable public sign-ups or control invitations in Supabase before exposing an internal deployment.

API bodies use shared runtime validators, mutating routes check browser origin, and authentication errors fail closed. Raw backend errors are logged server-side, not returned to clients. Upload validation checks size, extension and declared MIME; it is not malware scanning or file-content verification.

## Database migrations

`20260909000000_core_baseline.sql` reconstructs missing historical base tables with `IF NOT EXISTS`. The original migrations then create workspace/document tables and foreign keys. `20260927000000_integrity_and_queries.sql` adds query indexes, shared-workspace RLS, safe UUID backfills, a full news dedupe index, search, and atomic scoring RPCs.

For an existing database, inspect `supabase migration list` and `supabase db push --dry-run --include-all` first. The baseline has an earlier version than already-applied migrations, so `--include-all` may be needed. Apply against a backup/staging database before production; these files have not been applied to your remote database by this change. Backfills only link unique ticker matches, or unique names for rows without a ticker; ambiguous rows need manual mapping.

CI applies the full migration chain to a fresh PostgreSQL service and checks the dedupe/RLS/transaction contracts. Use `TEST_DATABASE_URL` with `scripts/test-migrations.sh` **only for a disposable test database**.

## Deploy

The complete app requires a persistent Node host and Python worker. The previous Vercel-only deployment cannot provide the shared writable SQLite file or worker process.

`docker compose --env-file .env.local up --build -d` builds both services and shares the `news-data` volume. Public Supabase values are supplied at build time; credentials are read from `.env.local` at runtime. Add provider keys to that file for the container worker. Put the app behind an HTTPS reverse proxy and configure its request-size limit to 21 MB. Keep one app/worker pair per volume; use a managed queue/database before horizontal scaling.

The manual deployment workflow now builds downloadable container images; it does not push migrations or deploy automatically. Back up Supabase, R2, and the SQLite volume (SQLite online backup or a stopped-worker snapshot). Do not copy a live WAL database file alone.

## Checks

```sh
nvm use
npm ci
npm run typecheck
npm run lint
npm test
npm run test:python
npm run build
```

Tests cover validation, scoring bounds, entity grouping, review retry/conflict handling, deduplication, and worker job claims without contacting live news providers. If `better-sqlite3` reports a Node ABI mismatch, switch to Node 22 and reinstall dependencies. A successful local build does not verify remote Supabase migrations, R2 credentials, or provider availability.

### Accepted news returns PostgreSQL error 42501

Apply `supabase/migrations/20260927010000_allow_accepted_news_events.sql` in the target project's Supabase SQL Editor as an administrator. It is standalone and does not require the broader integrity migration. It grants authenticated SELECT/INSERT and permits inserts carrying an accepted review and a valid news dedupe key. RLS stays enabled, ticker/entity links remain optional, and anonymous access is not granted. No service-role key belongs in the browser or the acceptance API. After applying the policy, retry the original acceptance; the queued article and durable intent are preserved.
