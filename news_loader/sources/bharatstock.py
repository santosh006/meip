"""BharatStock -- EOD Indian market data sourced from NSE bhavcopy and XBRL
filings rather than a third-party aggregator. Free plan has full endpoint
access; plans differ only on daily request limits.

Honest about being END-OF-DAY, not a live tick feed. Included here for the
corporate-actions endpoint, which is a clean structured alternative to
scraping NSE yourself. Young service -- treat as a fallback, not a foundation.

Docs: https://bharatstockapi.com
"""
from __future__ import annotations

from base import BaseSource, SourceError, clean
from models import Article, to_utc_iso

BASE = "https://bharatstockapi.com/v1"


class Source(BaseSource):
    name = "bharatstock"
    label = "Bharat Stock"
    env_key = "BHARATSTOCK_API_KEY"
    homepage = "https://bharatstockapi.com"
    country = "India (NSE/BSE, EOD)"
    min_interval = 1.0

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        headers = {"X-API-Key": key}
        out: list[Article] = []

        for sym in (symbols or [])[:50]:
            try:
                data = self.get(f"{BASE}/stocks", headers=headers,
                                params={"symbol": sym.strip().upper()})
            except SourceError as exc:
                import logging
                logging.getLogger("stocknews").warning("%s %s: %s", self.name, sym, exc)
                continue
            self.keep_raw({"symbol": sym, "data": data})

            rows = data.get("data") if isinstance(data, dict) else data
            for item in (rows or []):
                if not isinstance(item, dict):
                    continue
                label = clean(item.get("purpose") or item.get("subject")
                              or item.get("type"), 300)
                if not label:
                    continue
                out.append(Article(
                    source=self.name,
                    external_id=clean(f"{sym}-{item.get('ex_date') or ''}-{label}", 300),
                    title=f"{sym.upper()}: {label}",
                    summary=clean(item.get("details") or item.get("description")),
                    published_at=to_utc_iso(item.get("announcement_date")
                                            or item.get("ex_date")
                                            or item.get("date")),
                    publisher="BharatStock (NSE filings)",
                    country="IN",
                    tickers=[sym.strip().upper()],
                    kind="filing",
                    raw=item,
                ))
        return out[:limit] if limit else out
