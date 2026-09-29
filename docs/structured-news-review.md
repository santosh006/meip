# Structured news review

The hosted ingestion workflow now supports saved drafts, two acceptance outcomes, immutable accepted versions, entity-specific and horizon-specific assessments, evidence, audit history, and manual daily observations. The shared analyst workspace keeps its existing reader policy; only explicitly enrolled reviewers can write through the new API.

## Setup

1. Apply `supabase/migrations/20260929000000_structured_news_reviews.sql` after the hosted-ingestion migration. It is additive: it does not rewrite old events, reviews, impact records, or source articles. It adds the private `news_review` schema, a controlled `review_workflow` RPC, and three nullable/defaulted projection columns on `impact_records`.
2. Grant a specific signed-in account reviewer access from an administrator SQL connection:

```sql
INSERT INTO news_review.members(user_id, role)
SELECT id, 'reviewer' FROM auth.users WHERE lower(email) = lower('YOUR_REVIEWER_EMAIL')
ON CONFLICT(user_id) DO NOTHING;
```

No user can self-enroll through the application. Remove membership to revoke future draft/acceptance/observation writes. Existing rejection remains available under its previous authenticated-user policy. No service-role secret is needed by the Next.js review routes.

3. Set `NEWS_STORAGE=supabase` for local development as well as Vercel. The worker launcher reads its separate `.env.worker` credentials when running in hosted mode; the Next.js server does not read that service key. Deploy the app code to the same environment. The old `/api/news/accept` endpoint and old hosted acceptance action return a useful 409 directing callers to the structured workflow; do not deploy only the database change while continuing to use the old acceptance UI.
4. Open NewsIngestion → Review / Accept. Save an incomplete draft and use Resume draft. Complete verification and at least one source to accept with enrichment pending; complete mappings/assessments/horizons for analysis-ready acceptance.
5. Impact Records is available in navigation. Analysis-ready and enrichment-pending reviews have separate views. Legacy records remain in their existing view below structured reviews. Full review links open version history and the observation timeline.

## Model and permissions

Private relational tables: members, entity_profiles, securities, horizon_defaults, drafts, versions, article_events, evidence, mappings, assessments, metrics, horizons, scores, audit, observations. Every private table has RLS enabled and no ordinary authenticated table grants. The RPC checks the authenticated identity and reviewer membership; draft writes additionally require ownership. Shared readers can see accepted history, evidence and observations through the read operations, but only their own active drafts.

Articles keep the existing pending/accepted/rejected ingestion decision. Draft/version metadata adds draft, accepted_pending_enrichment and accepted_analysis_ready without replacing historical ingestion values. Rejection is retained and audited. Accepted snapshots capture publication, ingestion, explicitly known/unknown occurrence, and server acceptance times separately.

Draft edits use optimistic revision checks. Acceptance locks the article and draft, checks the base accepted version, and commits version, evidence, mappings, metrics, horizons, scores, impact projections, article review status and audit together. A draft can produce only one accepted version. Repeated identical acceptance returns that version. Conflicting outcomes, stale edits and stale base versions produce 409 responses. A reviewer can explicitly restart from the latest version; superseded drafts remain stored.

Accepted child records, versions, observations and audit entries reject UPDATE/DELETE even through normal administrator DML; correction is a new version or observation. The application does not expose reviewer overrides. Managed impact projections reject direct ordinary-user edits. Previous projections are retained with analysis_current=false, and Impact Records displays only latest structured versions by default.

Article/event relationships are many-to-many through article_events. Entities use canonical UUIDs; additional securities belong to an entity. Imported legacy events may have an existing primary event ID. When occurrence is explicitly unknown, the legacy events.occurred_at NOT NULL column uses publication/ingestion time for indexing; the accepted review snapshot is the authoritative occurrence record and retains unknown explicitly.

## Scoring

The original scoreEvent function remains unchanged for legacy consumers. New `review-v2.0.0` rules map selected magnitude low/medium/high to 20/55/85, independently of direction. Significance uses magnitude thresholds (<25 low, <50 medium, <75 high, otherwise critical). Mixed or neutral direction does not manufacture a positive return or reduce magnitude.

Known categories earnings/guidance/M&A/regulation/litigation/product/leadership/capital raising/macro use these assessment rules. Other categories, unknown direction/magnitude, or invalid inputs return explicit unscored results. Numeric ranges are recorded as evidence, not automatically treated as calibrated price forecasts. Metric change and business implication are stored separately: increased costs can be adverse while increased revenue can be beneficial.

Source credibility, mapping confidence and impact/horizon confidence remain separate uncalibrated heuristic indicators, not statistical probabilities. The server/database computes and persists the scoring version, inputs, outputs and rationale; client preview values are never accepted as authoritative scores. `src/lib/scoring/index.ts` contains the versioned pure preview function; the migration contains the equivalent database function required to prevent direct-RPC score tampering. Tests compare their outputs. Rule changes require a new scoring version.

`src/lib/reviews/fields.ts` defines the UI/runtime field contract. The migration embeds its matching JSON field specification, so the database revalidates direct RPC calls. Future contract changes must update both through an additive migration; tests check parity.

## Observations and uncertainty

Daily observations reference an immutable accepted version and mapped entity. They store analysis date, cutoff, session, carried-forward/recomputed explanation, revision reason, optional market observations, source/method and outcome. A cutoff cannot predate acceptance or exceed the analysis date/current time. Numeric observations require source and calculation method. No prices, returns, trading-day dates, automatic score decay, or causal conclusions are fabricated. Original accepted forecasts remain untouched.

Horizons are configured in news_review.horizon_defaults; the seeded ranges are conventions, not calculated calendar dates. Optional advanced sections capture scenarios, likelihoods, assumptions, dependencies, second-order effects, monitoring and specialist follow-up.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run test:python
npm run build -- --webpack
```

For a disposable PostgreSQL database, `TEST_DATABASE_URL=... bash scripts/test-migrations.sh` runs the legacy contracts before applying the new workflow, then the new structured-review database contract. Never point this fresh-database script at a deployed database.

`tests/structured-review.sql` is a rollback-only scenario intended for an administrator connection after the new schema exists. It seeds test users as membership UUIDs, not actual auth accounts. It covers a crude supply disruption, opposite producer/airline exposure, multiple horizons, immutable revisions, observation preservation, permission denial, duplicate submission, stale edits, interleaved reviewers, forced transaction rollback and unchanged rejection. It does not fetch news or market data.

The review UI is server-render tested for labeled fields and escaping. Database scenarios exercise end-to-end persistence, not a browser-authenticated click test. Maximum request size is 256 KB; review sections allow up to 20 entries each. Existing-event selection lists the latest 200 events. Provider integrations, scheduled processing, market data, LLM enrichment, calibrated forecasts, reviewer overrides, and multi-tenant isolation are not introduced.
