# Market Event Intelligence Platform

MEIP combines a Next.js 16 / React 19 analyst workspace with Supabase, Cloudflare R2 document storage, and a separately hosted Python news worker backed by Supabase. SQLite remains available for local development.

## Run locally

Use Node **22** (`nvm use`, then `npm ci`) and Python 3.12+.

1. Copy `.env.example` to `.env.local`. Set the Supabase public URL/key and R2 credentials. For local SQLite mode set `NEWS_STORAGE=sqlite`, `NEWS_DB_PATH` to an **absolute path** such as `/absolute/path/to/meip/news_loader/data/news.sqlite`, and `DATA_DIR` to the corresponding directory. For hosted mode use the deployment steps below. Never commit credentials.
2. Install Python dependencies: `python3 -m venv news_loader/.venv`, then `news_loader/.venv/bin/pip install -r news_loader/requirements.txt`.
3. Apply the SQL migrations in chronological filename order to your development Supabase project before starting the app. See the migration notes below.
4. Set `NEWSLOADER_PYTHON` in `.env.local` to your Python environment (for example `/absolute/path/to/meip/news_loader/.venv/bin/python`). Provider keys can be set in `.env.local` or `news_loader/.env` (ignored by Git).
5. Run `npm run dev` to start both Next.js and the news worker. Sign in with an existing Supabase user. If the app is already running, `npm run worker` starts just the worker.

In SQLite mode, the npm worker launcher reads the same Next.js environment files as the app, respects `NEWSLOADER_PYTHON`, and normalizes the shared database path. A directly launched Python worker still needs its environment passed explicitly. The worker initializes the article and queue schemas, publishes the source catalogue, and executes queued jobs. Run only one worker per SQLite file. The web app and worker must share a persistent local filesystem, not an NFS mount or separate ephemeral serverless filesystems.

## Features and data flow

- **StockFinder / NewsFinder:** server-side search and pages of 25 results, accurate record counts, previews of the latest five impacts, and links to paginated detail pages. Relationships use entity/event UUIDs.
- **News ingestion:** `POST /api/news/ingest` creates a durable job and returns HTTP 202. The UI polls `GET /api/news/ingest?id=…` and reconnects to the most recent job after refresh. Each user may have one active job. Jobs survive web-process restarts; interrupted worker jobs retry on worker restart. Source failures are reported independently.
- **Review:** any article can be accepted or rejected, with no ticker requirement. In hosted mode the accepted event and review decision commit atomically in Supabase. Retries reuse the committed result, and conflicting decisions return HTTP 409. Existing ticker/entity matches are optional; unmatched `entity_id` values remain null. Only accepted articles enter NewsFinder. Full source articles and review decisions remain in private ingestion storage to prevent reingestion. SQLite mode retains its durable-intent recovery path.
- **Documents:** PDF, HTML, TXT, XML, CSV, JSON, ZIP, XLSX, maximum 20 MB. Uploads reserve a hash-keyed database row first, then put the content in R2 and finalize its status. A failure leaves an `uploading` row visible; upload the same file again to finish. Concurrent retries write identical bytes to the same key. Uploader identity comes from the session.
- **Scoring:** deterministic rules; event and impact persistence runs in one PostgreSQL transaction.

## Access model

This is a **shared internal analyst workspace**. All authenticated users can read and write workspace data, and only authenticated users can use the APIs. Job status is scoped to the requesting user. Supabase RLS policies reflect this shared model; this is not a tenant-isolated SaaS. Disable public sign-ups or control invitations in Supabase before exposing an internal deployment.

API bodies use shared runtime validators, mutating routes check browser origin, and authentication errors fail closed. Raw backend errors are logged server-side, not returned to clients. Upload validation checks size, extension and declared MIME; it is not malware scanning or file-content verification.

## Database migrations

`20260909000000_core_baseline.sql` reconstructs missing historical base tables with `IF NOT EXISTS`. The original migrations then create workspace/document tables and foreign keys. `20260927000000_integrity_and_queries.sql` adds query indexes, shared-workspace RLS, safe UUID backfills, a full news dedupe index, search, and atomic scoring RPCs.

For an existing database, inspect `supabase migration list` and `supabase db push --dry-run --include-all` first. The baseline has an earlier version than already-applied migrations, so `--include-all` may be needed. Apply against a backup/staging database before production; do not assume every historical migration has been applied to your remote database. Backfills only link unique ticker matches, or unique names for rows without a ticker; ambiguous rows need manual mapping.

CI applies the full migration chain to a fresh PostgreSQL service and checks the dedupe/RLS/transaction contracts. Use `TEST_DATABASE_URL` with `scripts/test-migrations.sh` **only for a disposable test database**.

## Deploy

Vercel hosts the Next.js app; an always-running Python worker consumes the Supabase queue. The worker needs outbound HTTPS, no public HTTP port and no shared disk.

1. Apply `supabase/migrations/20260928000000_hosted_news_ingestion.sql` to the **same Supabase project used by the Vercel branch**. This standalone migration adds private ingestion tables and two permission-scoped RPCs. It does not require the broader integrity migration. The web RPC uses the signed-in user; the worker RPC is service-role-only.
2. In Vercel's environment for `dev_branch`, set `NEWS_STORAGE=supabase` and the existing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Vercel automatically selects hosted storage as a safeguard. Redeploy after pushing the code. No SQLite path or service-role key is needed by Vercel.
3. On your worker host, copy `.env.worker.example` to `.env.worker`; supply `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and provider keys. The key must belong to the same project as the Vercel branch and remain only on the worker host.
4. Run `docker compose -f compose.hosted-worker.yaml up --build -d`. On a managed container host, build the Dockerfile's `worker` target and configure the same variables; command: `python news_loader/worker.py`. Alternatively install `news_loader/requirements.txt` and run that command under a process supervisor. A healthy worker logs `Hosted news worker ready.`
5. Open NewsIngestion, fetch news, accept an article without a ticker, and verify it appears in NewsFinder. Source catalogue heartbeats expire after three minutes, so a missing worker produces an explicit offline message.

Jobs use atomic `SKIP LOCKED` claims, 20-minute leases, and per-attempt tokens. Fetch subprocesses time out after 15 minutes; abandoned jobs become claimable after lease expiry. Multiple workers may run. Articles, raw archives, source logs, reviews, and jobs live in Supabase. Plan database backup and archive retention for your news volume.

### Existing SQLite data

Stop the old worker and pause review activity during cutover. Keep the original database as a backup. Import pending articles, completed reviews, and pending review intents with worker credentials configured:

```sh
python3 scripts/migrate-news-sqlite.py /absolute/path/to/news.sqlite
```

Or generate SQL for the Supabase SQL editor/CLI with `--sql /tmp/news-import.sql`. The import is idempotent and preserves existing hosted decisions. Already accepted events retain their IDs; legacy reviews with deleted source text retain the available headline/source. Old ingestion jobs and historical source logs are not resumed or copied; retry unfinished fetches in the hosted UI. The original SQLite file is never modified.

For a wholly local SQLite deployment, use `NEWS_STORAGE=sqlite` and the original `compose.yaml` with its shared persistent volume. Do not point Vercel at `/tmp`: that does not provide durable shared storage.

The manual deployment workflow builds downloadable container images; it does not deploy Vercel or provision a worker host.

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

For the legacy SQLite review path, apply `supabase/migrations/20260927010000_allow_accepted_news_events.sql` in the target project's Supabase SQL Editor as an administrator. It is standalone and does not require the broader integrity migration. It grants authenticated SELECT/INSERT and permits inserts carrying an accepted review and a valid news dedupe key. RLS stays enabled, ticker/entity links remain optional, and anonymous access is not granted. No service-role key belongs in the browser or the acceptance API. After applying the policy, retry the original acceptance; the queued article and durable intent are preserved.
