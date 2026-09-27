// src/lib/newsdb.ts
import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { readFileSync, mkdirSync } from 'node:fs';
import { loaderRoot, newsDbPath } from './ingestion/config';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let _conn: Database.Database | null = null;

export function db(): Database.Database {
  if (!_conn) {
    mkdirSync(path.dirname(newsDbPath), { recursive: true });
    _conn = new Database(newsDbPath);
    _conn.pragma("busy_timeout = 5000");
    _conn.exec(readFileSync(path.join(loaderRoot, 'queue.sql'), 'utf8'));
    _conn.pragma("journal_mode = WAL");
    _conn.pragma("foreign_keys = ON");
  }
  return _conn;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Article {
  /** Aliased from dedupe_key so the UI can keep using `id`. */
  id: string;
  dedupe_key: string;
  source: string;
  title: string;
  url: string | null;
  published_at: string | null;
  /** Comma-joined ticker list stored on the article row. May be empty/null. */
  tickers: string | null;
}

/** Full SQLite article row, matching news_loader/storage.py. */
export interface ArticleRow extends Omit<Article, "id"> {
  external_id: string | null;
  summary: string | null;
  body: string | null;
  fetched_at: string;
  first_seen_at: string;
  publisher: string | null;
  language: string | null;
  country: string | null;
  isin: string | null;
  categories: string | null;
  sentiment: number | null;
  sentiment_label: string | null;
  relevance: number | null;
  kind: string | null;
  attachment_url: string | null;
  raw: string | null;
}

/** Parse comma-separated ticker/category columns, omitting empty entries. */
export function splitList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface ListArticlesOptions {
  ticker?: string;
  source?: string;
  limit?: number;
  offset?: number;
  /** Only return articles with no ticker mapping (triage mode). */
  unmappedOnly?: boolean;
  /** Set false to disable the tombstone anti-join. Default true. */
  excludeReviewed?: boolean;
}

export type Decision = "accepted" | "rejected";

export interface TombstoneOptions {
  reason?: string;
  reviewerId?: string;
  ticker?: string;
}

// ---------------------------------------------------------------------------
// Dedupe key
// ---------------------------------------------------------------------------

/** Match NewsLoader's source-scoped identity exactly (including case). */
export function computeDedupeKey(input: { source: string; title: string; url?: string | null; external_id?: string | null; published_at?: string | null }): string {
  const basis = input.external_id || input.url || `${input.title}|${input.published_at ?? 'None'}`;
  return crypto.createHash('sha1').update(`${input.source}|${basis}`).digest('hex');
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listArticles(opts: ListArticlesOptions = {}): Article[] {
  const {
    ticker,
    source,
    limit = 100,
    offset = 0,
    unmappedOnly = false,
    excludeReviewed = true,
  } = opts;

  const where: string[] = [];
  const params: Record<string, unknown> = { limit, offset };

  if (excludeReviewed) {
    where.push(
      `NOT EXISTS (
         SELECT 1 FROM article_reviews r WHERE r.dedupe_key = a.dedupe_key
       )`
    );
  }

  if (source) {
    where.push(`a.source = @source`);
    params.source = source;
  }

  if (unmappedOnly) {
    where.push(
      `NOT EXISTS (
         SELECT 1 FROM article_tickers t WHERE t.dedupe_key = a.dedupe_key
       )`
    );
  }

  if (ticker) {
    // Comma-wrapped LIKE prevents HDFC matching HDFCBANK.
    where.push(
      `(
         EXISTS (
           SELECT 1 FROM article_tickers t
           WHERE t.dedupe_key = a.dedupe_key AND t.ticker = @ticker
         )
         OR ',' || REPLACE(COALESCE(a.tickers, ''), ' ', '') || ','
            LIKE '%,' || @ticker || ',%'
       )`
    );
    params.ticker = ticker;
  }

  const sql = `
    SELECT
      a.dedupe_key AS id,
      a.dedupe_key,
      a.source,
      a.title,
      a.url,
      a.published_at,
      a.tickers
    FROM articles a
    ${where.length ? `WHERE ${where.join("\n      AND ")}` : ""}
    ORDER BY a.published_at DESC, a.dedupe_key DESC
    LIMIT @limit OFFSET @offset
  `;

  return db().prepare(sql).all(params) as Article[];
}

export function getArticleById(id: string): (ArticleRow & { id: string }) | undefined {
  return db().prepare('SELECT a.*, a.dedupe_key AS id FROM articles a WHERE a.dedupe_key = ?')
    .get(id) as (ArticleRow & { id: string }) | undefined;
}

/**
 * Tickers for an article: mapping table first, falling back to the
 * comma-joined column on the article row.
 */
export function resolveTickers(id: string): string[] {
  const conn = db();

  const mapped = conn
    .prepare(
      `SELECT ticker FROM article_tickers WHERE dedupe_key = ? ORDER BY ticker`
    )
    .all(id) as Array<{ ticker: string }>;

  if (mapped.length) return mapped.map((r) => r.ticker);

  const row = conn
    .prepare(`SELECT tickers FROM articles WHERE dedupe_key = ?`)
    .get(id) as { tickers: string | null } | undefined;

  return splitList(row?.tickers ?? null);
}

export function isReviewed(id: string): Decision | null {
  const row = db()
    .prepare(`SELECT decision FROM article_reviews WHERE dedupe_key = ?`)
    .get(id) as { decision: Decision } | undefined;
  return row?.decision ?? null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Snapshots the article into article_reviews, then removes it from the live
 * store. Atomic. Safe to call twice — repeated decisions never overwrite the
 * original snapshot or reviewer.
 *
 * NOTE: article_tickers has no FK cascade, so its rows are deleted explicitly
 * and must be removed BEFORE the article row.
 */
export function tombstoneAndDelete(
  id: string,
  decision: Decision,
  opts: TombstoneOptions = {}
): void {
  const conn = db();

  const tx = conn.transaction(() => {
    const previous = conn.prepare('SELECT decision FROM article_reviews WHERE dedupe_key = ?').get(id) as { decision: Decision } | undefined;
    if (previous && previous.decision !== decision) throw new Error('Article already reviewed');
    const snap = conn
      .prepare(`SELECT source, title, tickers FROM articles WHERE dedupe_key = ?`)
      .get(id) as
      | { source: string; title: string; tickers: string | null }
      | undefined;

    const ticker =
      opts.ticker ??
      (snap?.tickers ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0] ??
      null;

    conn
      .prepare(
        `INSERT INTO article_reviews
           (dedupe_key, decision, reason, reviewer_id, source, ticker, headline, reviewed_at)
         VALUES
           (@id, @decision, @reason, @reviewerId, @source, @ticker, @headline, datetime('now'))
         ON CONFLICT(dedupe_key) DO NOTHING`
      )
      .run({
        id,
        decision,
        reason: opts.reason ?? "", // NOT NULL — never bind null
        reviewerId: opts.reviewerId ?? null,
        source: snap?.source ?? null,
        ticker,
        headline: snap?.title ?? null,
      });

    conn.prepare(`DELETE FROM article_tickers WHERE dedupe_key = ?`).run(id);
    conn.prepare(`DELETE FROM articles WHERE dedupe_key = ?`).run(id);
    conn.prepare('DELETE FROM review_intents WHERE dedupe_key = ?').run(id);
  });

  tx();
}

export interface RunLogEntry {
  id: number;
  started_at: string;
  finished_at: string | null;
  source: string | null;
  inserted: number;
  skipped: number;
  status: string;
  error: string | null;
}

export interface RunLogRow {
  id: number;
  source: string;
  started_at: string;
  finished_at: string | null;
  fetched: number | null;
  articles_new: number | null;
  status: string | null;
  message: string | null;
}

export function runLogSince(since: string, limit = 500): RunLogRow[] {
  return db()
    .prepare(
      `SELECT id,
              source,
              started_at,
              finished_at,
              fetched,
              inserted AS articles_new,
              status,
              message
         FROM run_log
        WHERE started_at >= ?
        ORDER BY started_at DESC
        LIMIT ?`
    )
    .all(since, limit) as RunLogRow[];
}

/** Durable intent: retries reuse the first payload; opposite decisions cannot race. */
export function reserveReview(id: string, decision: Decision, reviewerId: string, payload: unknown) {
  return db().transaction(() => {
    const prior = isReviewed(id);
    if (prior) return { prior, intent: null };
    db().prepare('INSERT OR IGNORE INTO review_intents(dedupe_key, decision, reviewer_id, payload) VALUES(?,?,?,?)')
      .run(id, decision, reviewerId, JSON.stringify(payload));
    const intent = db().prepare('SELECT decision, reviewer_id, payload FROM review_intents WHERE dedupe_key=?').get(id) as { decision: Decision; reviewer_id: string; payload: string };
    return { prior: null, intent };
  }).immediate();
}

export interface AcceptedReview {
  dedupe_key: string;
  headline: string | null;
  source: string | null;
  ticker: string | null;
  reason: string;
  reviewer_id: string | null;
  reviewed_at: string;
}
export function unexportedAcceptedReviews(limit = 25): AcceptedReview[] {
  return db().prepare(`SELECT r.* FROM article_reviews r
    WHERE r.decision='accepted' AND NOT EXISTS (
      SELECT 1 FROM news_event_exports e WHERE e.dedupe_key=r.dedupe_key
    ) ORDER BY r.reviewed_at, r.dedupe_key LIMIT ?`).all(limit) as AcceptedReview[];
}
export function markNewsExported(dedupeKey: string, eventId: string) {
  db().prepare('INSERT OR IGNORE INTO news_event_exports(dedupe_key,event_id) VALUES(?,?)').run(dedupeKey, eventId);
}
