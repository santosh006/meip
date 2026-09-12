# MEIP Project Context

## 1. Purpose

MEIP is a Market Event Intelligence Platform. It is a Next.js application backed by Supabase that:

- Stores market entities, events, impact records, sources, and workspace notes.
- Scores raw market events using deterministic rules.
- Presents an internal developer workspace.
- Presents a customer-facing impact-record view.
- Links stock/company records to a ticker-specific analysis page.

The current repository is an early working prototype. The customer-facing path is functional for the current database shape, while some analysis API components are still prototype code and are not connected to the main route.

## 2. Technology Stack

- Next.js `16.3.4` with the App Router.
- React `19.2.8`.
- TypeScript `5` with strict mode enabled.
- Supabase JS `2.116.0`.
- `@supabase/ssr` for browser/server Supabase clients and cookie-based sessions.
- Tailwind CSS `4` with `@tailwindcss/typography`.
- ESLint `9` and `eslint-config-next`.
- `react-markdown` and `remark-gfm` for Markdown workspace content.

Package scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

The local development server is normally available at `http://localhost:3000`.

## 3. Repository Layout

```text
meip/
├── src/
│   ├── app/
│   │   ├── page.tsx                         # Root redirect
│   │   ├── login/page.tsx                   # Supabase email/password login
│   │   ├── dev-portal/page.tsx              # Server wrapper for workspace
│   │   ├── dev-portal/DevPortalClient.tsx   # Workspace CRUD UI
│   │   └── app/
│   │       ├── page.tsx                     # CustomerApp / impact preview
│   │       ├── impact/page.tsx              # Impact records list route
│   │       ├── impact/ImpactClient.tsx      # Client filtering/rendering
│   │       └── analysis1/[entityId]/page.tsx # Entity analysis route
│   ├── components/
│   │   ├── Shell.tsx                        # Authenticated navigation shell
│   │   └── analysis/
│   │       ├── AnalysisFullPage.tsx         # Prototype client analysis page
│   │       ├── AnalysisOverlay.tsx          # Prototype API-driven overlay
│   │       └── StockClickHandler.tsx        # Prototype click wrapper
│   └── lib/
│       ├── database.types.ts                # Generated Supabase TypeScript schema
│       ├── supabase.ts                      # Browser Supabase client
│       ├── supabase-server.ts               # Server Supabase client
│       ├── api/analysis.ts                  # Prototype analysis API types/client
│       └── scoring/
│           ├── index.ts                     # Event scoring rules
│           └── persist.ts                   # Event + impact record persistence
├── supabase/
│   └── migrations/                          # Tracked database migrations
├── public/
├── package.json
└── tsconfig.json
```

## 4. Routes and User Flows

### `/`

`src/app/page.tsx` redirects to `/dev-portal`.

### `/login`

Client-side email/password login using the browser Supabase client. On success it routes to `/dev-portal` and refreshes the server-rendered session.

### `/dev-portal`

Internal workspace. The server page loads `workspace_items` and passes them to `DevPortalClient`.

The client supports:

- Creating notes/docs/strategies/decisions/ideas.
- Editing title and Markdown content.
- Live Markdown preview.
- Saving updates.
- Deleting items.

### `/app`

This is the current **CustomerApp** page. It is also described in the UI as a customer-facing product preview.

The server page:

1. Reads all rows from `impact_records`.
2. Reads `name` and `ticker` from `entities`.
3. Matches records by company name.
4. Falls back to `impact_records.security` when no exact entity-name match exists.
5. Wraps cards with a Next.js `Link` when a ticker is available.
6. Opens the entity analysis overlay in StockFinder using the stable entity ID.

The four current non-prod impact records are associated with:

- Sun Pharmaceutical / `SUNPHARMA`
- Adani Green Energy / `ADANIGREEN`
- Cipla / `CIPLA`
- NTPC, currently without an `entities` row and therefore without a ticker-based analysis link.

### `/app/impact`

Server page plus `ImpactClient`. It reads `impact_records`, maps the database row into a UI-specific `ImpactRecord` shape, and provides category filtering.

Current UI mapping:

- `company` -> `title`
- `direction` -> `category`
- `summary` -> `description`
- `materiality` or confidence -> metric display
- `created_at` -> display date

### `/app/analysis1/[entityId]`

The working entity analysis page. It uses the async Next.js 16 route params API:

```ts
interface AnalysisPageProps {
  params: Promise<{ ticker: string }>;
}
```

The route:

1. Decodes and uppercases the ticker.
2. Finds the entity by ticker using `ilike`.
3. Finds impact records by exact `company = entity.name`.
4. Renders entity name, ticker, sector, and impact-record details.

The current database schema has no `entity_id` column on `impact_records`, so the page joins records to entities through company name. This is functional but fragile; adding a real foreign key is a priority improvement.

## 5. Authentication and Request Flow

`src/middleware.ts` runs for application routes and calls `supabase.auth.getUser()`.

- Unauthenticated users are redirected to `/login`.
- Authenticated users are redirected away from `/login` to `/dev-portal`.
- Supabase auth cookies are copied between the request and response.

`src/lib/supabase-server.ts` creates a typed server client using `Database` from `database.types.ts` and cookies from `next/headers`.

`src/lib/supabase.ts` creates the browser client for login and client-side workspace CRUD.

Environment variables expected in `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Do not commit these values or include them in LLM prompts. The current local configuration points to the non-prod Supabase project. The Supabase CLI must also be linked to the same project before applying migrations.

## 6. Database Schema

The generated schema is in `src/lib/database.types.ts`. It reflects the linked Supabase database and currently includes these relevant tables.

### `entities`

```text
id          uuid/string primary key
name        string, required
ticker      string | null
sector      string | null
aliases     string[] | null
created_at  string | null
```

Three entity rows were inserted in non-prod for the current stock data: `SUNPHARMA`, `ADANIGREEN`, and `CIPLA`.

### `impact_records`

```text
id            uuid/string primary key
company       string, required
security      string | null
sector        string | null
event_type    string | null
direction     string | null
confidence    number | null
event_status  string | null
horizon       string | null
materiality   string | null
summary       string | null
evidence_url  string | null
created_at    string | null
```

The current table does **not** contain `headline`, `rationale`, `impact_score`, `occurred_at`, `entity_id`, or `event_id`. Earlier code attempted to use those fields for this table; that code was changed to match the current database schema.

### `events`

The normalized scoring/event table contains fields such as:

```text
id, title, event_type, occurred_at, entity_id, source_id,
source_url, impact_score, impact_direction, confidence,
significance, rationale, affected_metrics, summary, raw, detected_at
```

### `workspace_items`

```text
id, kind, title, content, tags, data, pinned, created_at, updated_at
```

The Dev Portal primarily uses `id`, `kind`, `title`, `content`, and `updated_at`.

### Other generated tables

The generated schema also includes `sources`, `tasks`, `backlog_items`, `cicd_test`, and `event_links`. Some are not currently connected to a UI flow.

## 7. Row-Level Security and Grants

RLS is enabled on the relevant remote tables. The following tracked migrations were added:

- `20260912120000_impact_records_read_policy.sql`
  - Allows the `authenticated` role to select impact records.
- `20260912123000_allow_public_entity_reads.sql`
  - Allows the `anon` role to select entities.
- `20260912124000_grant_entity_reads.sql`
  - Grants table-level `SELECT` on `entities` to `anon` and `authenticated`.

The entity grant was required because an RLS policy alone was not enough; the anon database role also needed PostgreSQL table privilege.

When adding a new table or user flow, verify both:

1. PostgreSQL table grants.
2. RLS policies for the actual role (`anon` or `authenticated`).

Apply migrations with the CLI linked to the intended environment:

```bash
supabase link --project-ref <project-ref>
supabase migration list
supabase db push
```

## 8. Scoring Engine

`src/lib/scoring/index.ts` exposes:

```ts
scoreEvent(input: RawEvent): ScoredEvent
```

Input:

```ts
interface RawEvent {
  title: string;
  eventType: 'earnings' | 'ma' | 'regulatory' | 'product' | 'leadership' | 'macro';
  sector?: string;
  metrics?: Record<string, '+' | '-' | 'flat'>;
  sourceCredibility?: number;
}
```

Output:

```ts
interface ScoredEvent {
  impactScore: number;
  direction: 'positive' | 'negative' | 'mixed' | 'neutral';
  confidence: number;
  significance: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
  affectedMetrics: Record<string, '+' | '-' | 'flat'>;
}
```

Current scoring rules:

- Base event weights:
  - M&A: 70
  - Regulatory: 60
  - Earnings: 50
  - Leadership: 40
  - Product: 35
  - Macro: 45
- Sector multipliers:
  - Finance: 1.2
  - Tech: 1.1
  - Energy: 1.1
  - Healthcare: 1.0
  - Default: 1.0
- Metric signs determine positive, negative, mixed, or neutral direction.
- Impact magnitude is clamped to `-100..100`.
- Confidence is derived from source credibility and whether metrics are present.
- Significance thresholds are based on absolute impact score:
  - `>= 75`: critical
  - `>= 50`: high
  - `>= 25`: medium
  - otherwise low

The scoring implementation is deterministic and has no LLM call yet. The rationale explicitly says an LLM may rewrite it later.

## 9. Persistence Flow

`src/lib/scoring/persist.ts` exposes:

```ts
ingestAndScore(input: IngestEvent)
```

It:

1. Calls `scoreEvent`.
2. Inserts a normalized record into `events`.
3. Inserts a UI-facing record into `impact_records`.
4. Returns `{ event, impactRecord, scored }`.

Optional persistence input includes:

```text
company, security, entityId, sourceId, sourceUrl,
occurredAt, eventStatus, horizon, materiality, evidenceUrl
```

Important current behavior: this helper is not called by any current route or ingestion UI. It is an available service function, not an active end-to-end ingestion workflow.

## 10. Prototype Analysis API Components

`src/lib/api/analysis.ts` defines an older, richer `ImpactRecord` contract containing fields such as:

```text
canonical_event_id, event_subtype, causal_channel,
time_horizon, materiality_tier, confidence_score,
evidence_excerpts, applied_rule_ids, analyst_review_status,
analyst_rationale, updated_at
```

`AnalysisOverlay.tsx` fetches this shape from:

```text
/api/analysis/[symbol]
```

However, there is currently no matching route handler under `src/app/api`, and the API shape does not match the current Supabase `impact_records` schema. `AnalysisFullPage.tsx`, `StockClickHandler.tsx`, and `AnalysisOverlay.tsx` should be treated as prototype/unused components unless the API contract is intentionally rebuilt.

The currently working customer analysis implementation is the server route:

```text
src/app/app/analysis1/[entityId]/page.tsx
```

## 11. Current Known Gaps and Risks

### Schema drift

The tracked initial migration only creates `workspace_items`, while the generated remote schema includes multiple additional tables. The database types were generated from the remote project, but the repository does not yet contain a complete reproducible schema migration for all remote tables.

Recommended improvement: create a complete baseline migration or maintain all schema changes in version control.

### Fragile company join

`impact_records` is matched to `entities` using company name. This can break because of spelling, punctuation, suffixes, or renamed companies.

Recommended improvement:

- Add `entity_id` to `impact_records`.
- Add a foreign key to `entities(id)`.
- Populate it during ingestion.
- Query impact records by `entity_id`.

### Duplicate analysis implementations

There are two conceptual analysis systems:

1. The working Supabase-backed page at `/app/analysis1/[entityId]`.
2. The unfinished API-backed `AnalysisOverlay`/`AnalysisFullPage` system.

Recommended improvement: choose one contract and remove or complete the other.

### Error handling

Some list pages ignore Supabase errors and render empty states. For production behavior, return visible error states and log structured server-side diagnostics.

### No automated test suite

There are no application tests covering scoring, route rendering, database mapping, RLS assumptions, or link generation.

Recommended initial tests:

- Unit tests for `scoreEvent`.
- Mapping tests for `impact_records` to UI data.
- Integration test for ticker lookup and company record loading.
- Smoke test for CustomerApp links.

### UI consistency

The application currently mixes dark Tailwind styling in the main shell with light styling in the prototype analysis components. Consolidate design tokens and component styling after the data flow is stable.

## 12. Recommended Next Steps

1. Add `entity_id` to `impact_records` and backfill the current four rows.
2. Replace company-name matching in `/app/analysis1/[entityId]` with a foreign-key query.
3. Decide whether analysis is server-rendered route navigation or an overlay API.
4. If overlay behavior is required, create `/api/analysis/[symbol]` with a response mapped from the current schema.
5. Add complete migrations for `entities`, `events`, `impact_records`, sources, and RLS/grants.
6. Add tests for scoring and CustomerApp navigation.
7. Add structured error handling to every Supabase query.
8. Keep `database.types.ts` regenerated after schema changes:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
```

## 13. Useful Investigation Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type-check
npx tsc --noEmit

# Lint
npm run lint

# Inspect migration state
supabase migration list

# Apply migrations to linked project
supabase db push

# Query linked database
supabase db query --linked "select count(*) from public.impact_records;"

# Regenerate Supabase types
npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
```

## 14. Guidance for Future LLM Discussions

When proposing a change, preserve these boundaries unless the goal explicitly changes them:

- Treat `src/lib/database.types.ts` as generated output; change the database schema/migration first, then regenerate types.
- Do not cast Supabase rows through `unknown` to silence mismatches.
- Prefer explicit mapping or a shared database-derived type.
- Check both RLS policies and table grants when data appears empty or permission errors occur.
- Check the active Supabase environment before diagnosing missing rows.
- Do not assume the prototype API components represent the current production data contract.
- Keep customer routes and developer workspace routes separate.
- When changing a route, validate the exact Next.js App Router parameter type, especially async dynamic params in Next.js 16.
- After edits, run a focused diagnostic first, then a type-check or lint command when available.

## 15. Current Project Status

Working:

- Supabase login/session middleware.
- Developer workspace CRUD for `workspace_items`.
- CustomerApp impact-record list at `/app`.
- Clickable stock cards for records with ticker data.
- Entity analysis page at `/app/analysis1/[entityId]`.
- Impact records list/filter page at `/app/impact`.
- Deterministic event scoring function.
- Non-prod RLS/grant migrations for current read flows.

Incomplete or prototype:

- End-to-end ingestion UI.
- Complete reproducible database schema migrations.
- API-backed overlay analysis route.
- Shared domain types between API prototypes and Supabase rows.
- Automated tests.
- Stable entity-to-impact foreign-key relationship.
