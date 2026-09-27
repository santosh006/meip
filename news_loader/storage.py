"""Persistence: append-only raw archive + de-duplicated SQLite table.

Two layers on purpose:

1. `raw/<source>/<YYYY-MM-DD>.jsonl` -- every payload exactly as received,
   never rewritten. This is what protects point-in-time integrity when a
   publisher silently edits or back-dates an article.
2. `news.sqlite` -- the normalised, de-duplicated table you actually query.
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

from config import data_dir
from models import Article

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
    dedupe_key      TEXT PRIMARY KEY,
    source          TEXT NOT NULL,
    external_id     TEXT,
    title           TEXT NOT NULL,
    url             TEXT,
    summary         TEXT,
    body            TEXT,
    published_at    TEXT,
    fetched_at      TEXT NOT NULL,
    first_seen_at   TEXT NOT NULL,
    publisher       TEXT,
    language        TEXT,
    country         TEXT,
    tickers         TEXT,
    isin            TEXT,
    categories      TEXT,
    sentiment       REAL,
    sentiment_label TEXT,
    relevance       REAL,
    kind            TEXT,
    attachment_url  TEXT,
    raw             TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_source    ON articles(source, published_at);
CREATE INDEX IF NOT EXISTS idx_articles_kind      ON articles(kind, published_at);

CREATE TABLE IF NOT EXISTS article_tickers (
    dedupe_key TEXT NOT NULL,
    ticker     TEXT NOT NULL,
    PRIMARY KEY (dedupe_key, ticker)
);
CREATE INDEX IF NOT EXISTS idx_at_ticker ON article_tickers(ticker);

CREATE TABLE IF NOT EXISTS run_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    fetched     INTEGER DEFAULT 0,
    inserted    INTEGER DEFAULT 0,
    status      TEXT,
    message     TEXT
);
"""


class Store:
    def __init__(self, path: Path | None = None):
        base = data_dir()
        self.db_path = path or Path(os.environ.get("NEWS_DB_PATH", str(base / "news.sqlite")))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.raw_dir = base / "raw"
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path, timeout=5)
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.executescript(SCHEMA)
        self.conn.executescript(Path(__file__).with_name("queue.sql").read_text())
        self.conn.commit()

    # -- raw archive --------------------------------------------------------
    def archive_raw(self, source: str, payload) -> None:
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        d = self.raw_dir / source
        d.mkdir(parents=True, exist_ok=True)
        record = {
            "source": source,
            "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "payload": payload,
        }
        with (d / f"{day}.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")

    # -- normalised rows ----------------------------------------------------
    def save(self, articles: list[Article]) -> int:
        """Insert-if-absent. Returns the count of genuinely new rows.

        Existing rows are never overwritten -- an edited headline should not
        silently mutate history that a backtest already consumed.
        """
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        inserted = 0
        cur = self.conn.cursor()
        for a in articles:
            key = a.dedupe_key()
            if cur.execute("SELECT 1 FROM article_reviews WHERE dedupe_key=?", (key,)).fetchone():
                continue
            cur.execute(
                """INSERT OR IGNORE INTO articles (
                       dedupe_key, source, external_id, title, url, summary, body,
                       published_at, fetched_at, first_seen_at, publisher, language,
                       country, tickers, isin, categories, sentiment, sentiment_label,
                       relevance, kind, attachment_url, raw
                   ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    key, a.source, a.external_id, a.title, a.url, a.summary, a.body,
                    a.published_at, a.fetched_at, now, a.publisher, a.language,
                    a.country, ",".join(a.tickers), a.isin, ",".join(a.categories),
                    a.sentiment, a.sentiment_label, a.relevance, a.kind,
                    a.attachment_url, json.dumps(a.raw, ensure_ascii=False, default=str),
                ),
            )
            if cur.rowcount:
                inserted += 1
            for t in a.tickers:
                cur.execute(
                    "INSERT OR IGNORE INTO article_tickers (dedupe_key, ticker) VALUES (?,?)",
                    (key, t.upper().strip()),
                )
        self.conn.commit()
        return inserted

    # -- run log ------------------------------------------------------------
    def start_run(self, source: str) -> int:
        cur = self.conn.cursor()
        cur.execute(
            "INSERT INTO run_log (source, started_at, status) VALUES (?,?,?)",
            (source, datetime.now(timezone.utc).isoformat(timespec="seconds"), "running"),
        )
        self.conn.commit()
        return cur.lastrowid

    def finish_run(self, run_id: int, fetched: int, inserted: int,
                   status: str, message: str = "") -> None:
        self.conn.execute(
            """UPDATE run_log SET finished_at=?, fetched=?, inserted=?, status=?, message=?
               WHERE id=?""",
            (datetime.now(timezone.utc).isoformat(timespec="seconds"),
             fetched, inserted, status, message[:2000], run_id),
        )
        self.conn.commit()

    def counts_by_source(self) -> list[tuple[str, int]]:
        cur = self.conn.execute(
            "SELECT source, COUNT(*) FROM articles GROUP BY source ORDER BY 2 DESC")
        return cur.fetchall()

    def close(self) -> None:
        self.conn.close()
