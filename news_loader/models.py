"""Normalised record shapes shared by every source adapter."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def to_utc_iso(value: Any) -> str | None:
    """Best-effort normalisation of whatever a vendor calls a timestamp.

    Returns an ISO-8601 UTC string, or None if it cannot be parsed.
    Never guesses a date when only a date is present without a time --
    it anchors to 00:00:00Z and lets the caller decide if that is usable.
    """
    if value in (None, "", 0):
        return None
    if isinstance(value, (int, float)):
        # Unix epoch, seconds or milliseconds.
        ts = float(value)
        if ts > 1e12:
            ts /= 1000.0
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds")
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if not text:
        return None
    candidates = [
        "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M", "%Y%m%dT%H%M%SZ", "%Y-%m-%d",
        "%d-%b-%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%d %b %Y",
        "%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z",
    ]
    normalised = text.replace("Z", "+0000") if text.endswith("Z") else text
    for fmt in candidates:
        try:
            dt = datetime.strptime(normalised, fmt)
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec="seconds")
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec="seconds")
    except ValueError:
        return None


@dataclass
class Article:
    """One news item or disclosure, normalised across vendors.

    `published_at` and `fetched_at` are stored separately on purpose: the
    correlation model must never confuse when a story appeared with when we
    happened to see it.
    """
    source: str                      # adapter name, e.g. "marketaux"
    title: str
    url: str = ""
    external_id: str = ""            # vendor's own id, when there is one
    summary: str = ""
    body: str = ""
    published_at: str | None = None  # ISO-8601 UTC
    fetched_at: str = field(default_factory=utcnow_iso)
    publisher: str = ""
    language: str = ""
    country: str = ""
    tickers: list[str] = field(default_factory=list)
    isin: str = ""
    categories: list[str] = field(default_factory=list)
    sentiment: float | None = None
    sentiment_label: str = ""
    relevance: float | None = None
    kind: str = "news"               # news | filing | policy | press_release
    attachment_url: str = ""
    raw: dict = field(default_factory=dict)

    def dedupe_key(self) -> str:
        """Stable identity for the row. Prefers the vendor id, falls back to URL."""
        basis = self.external_id or self.url or f"{self.title}|{self.published_at}"
        return hashlib.sha1(f"{self.source}|{basis}".encode("utf-8")).hexdigest()

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, default=str)
