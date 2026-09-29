"""EODHD -- covers NSE and BSE, and bundles news + sentiment + prices under
one key, which removes a whole class of entity-reconciliation work.

Free tier: 20 API calls/day. Note the costing model -- calls are a currency
and the NEWS endpoint costs 5 calls per request, so a free account gets four
news calls a day. Up to 1000 articles per request.

Indian tickers are suffixed .NSE or .BSE (e.g. RELIANCE.NSE).
Docs: https://eodhd.com/financial-apis/stock-market-financial-news-api
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, clean
from models import Article, to_utc_iso

BASE = "https://eodhd.com/api"


class Source(BaseSource):
    name = "eodhd"
    label = "EODHD"
    env_key = "EODHD_API_KEY"
    homepage = "https://eodhd.com"
    country = "Global incl. NSE/BSE"
    min_interval = 1.0

    def fetch(self, symbols=None, query="", days=1, limit=50):
        token = self.require_key()
        frm = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        out: list[Article] = []

        targets = [self._qualify(s) for s in (symbols or [])] or [None]
        for sym in targets:
            params = {
                "api_token": token, "fmt": "json", "offset": 0,
                "limit": min(max(limit, 1), 1000), "from": frm, "to": to,
            }
            if sym:
                params["s"] = sym
            elif query:
                params["t"] = query  # topic tag mode

            data = self.get(f"{BASE}/news", params=params)
            self.keep_raw({"symbol": sym, "data": data})
            rows = data if isinstance(data, list) else []

            for item in rows:
                senti = item.get("sentiment") or {}
                out.append(Article(
                    source=self.name,
                    external_id=clean(item.get("link") or item.get("date"), 400),
                    title=clean(item.get("title"), 500),
                    url=clean(item.get("link"), 1000),
                    summary=clean(item.get("content"), 4000),
                    published_at=to_utc_iso(item.get("date")),
                    tickers=sorted({clean(s, 40) for s in (item.get("symbols") or [])
                                    if s} | ({sym} if sym else set())),
                    categories=[clean(t, 60) for t in (item.get("tags") or []) if t],
                    sentiment=senti.get("polarity"),
                    kind="news",
                    raw=item,
                ))
        return out

    @staticmethod
    def _qualify(symbol: str) -> str:
        s = symbol.strip().upper()
        return s if "." in s else f"{s}.NSE"
