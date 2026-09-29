CREATE TABLE IF NOT EXISTS article_reviews (
 dedupe_key TEXT PRIMARY KEY, decision TEXT NOT NULL CHECK(decision IN ('accepted','rejected')),
 reason TEXT NOT NULL DEFAULT '', reviewer_id TEXT, source TEXT, ticker TEXT, headline TEXT,
 reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS review_intents (
 dedupe_key TEXT PRIMARY KEY, decision TEXT NOT NULL CHECK(decision IN ('accepted','rejected')),
 payload TEXT NOT NULL, reviewer_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ingestion_jobs (
 id TEXT PRIMARY KEY, requested_by TEXT NOT NULL, payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed')),
 result TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), started_at TEXT, finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON ingestion_jobs(status, created_at);
CREATE TABLE IF NOT EXISTS source_catalogue (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS news_event_exports (
 dedupe_key TEXT PRIMARY KEY, event_id TEXT NOT NULL, exported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
