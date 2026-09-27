"""Finnhub -- generous free tier (60 calls/min), but two caveats that matter:

  1. The free licence is PERSONAL AND NON-COMMERCIAL. The moment your app is
     monetised or redistributes data you need a paid plan.
  2. Its news-sentiment endpoint covers US companies only. Indian tickers get
     little to nothing here.

Included because the "world news" half of a correlation model will eventually
want US coverage. Not useful for NSE/BSE symbols.
Docs: https://finnhub.io/docs/api
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, clean
from models import Article, to_utc_iso

BASE = "https://finnhub.io/api/v1"


class Source(BaseSource):
    name = "finnhub"
    label = "Finnhub"
    env_key = "FINNHUB_API_KEY"
    homepage = "https://finnhub.io"
    country = "US (news sentiment US-only)"
    min_interval = 1.1

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        out: list[Article] = []

        if symbols:
            frm = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
            to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            for sym in symbols:
                data = self.get(f"{BASE}/company-news", params={
                    "symbol": sym.strip().upper(), "from": frm, "to": to, "token": key})
                self.keep_raw({"symbol": sym, "data": data})
                out.extend(self._parse(data, [sym.strip().upper()]))
        else:
            data = self.get(f"{BASE}/news", params={"category": "general", "token": key})
            self.keep_raw(data)
            out.extend(self._parse(data, []))

        return out[:limit] if limit else out

    def _parse(self, data, tickers: list[str]) -> list[Article]:
        rows = data if isinstance(data, list) else []
        return [Article(
            source=self.name,
            external_id=clean(item.get("id"), 80),
            title=clean(item.get("headline"), 500),
            url=clean(item.get("url"), 1000),
            summary=clean(item.get("summary")),
            published_at=to_utc_iso(item.get("datetime")),
            publisher=clean(item.get("source"), 200),
            tickers=tickers or ([clean(item.get("related"), 40)]
                                if item.get("related") else []),
            categories=[clean(item.get("category"), 60)] if item.get("category") else [],
            kind="news",
            raw=item,
        ) for item in rows if item.get("headline")]
