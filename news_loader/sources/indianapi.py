"""IndianAPI.in -- India-native, free tier available, best value per rupee
for company-linked Indian news.

Structural limitation worth planning around: the news endpoint is per-company
rather than a firehose. You POLL BY SYMBOL, you do not stream.

The base URL differs per plan -- free/hobby use stock.indianapi.in, developer
uses dev., growth analyst uses analyst., pro uses pro. Calling the wrong host
for your plan returns 'Could not validate API key', not a 403. Set
INDIANAPI_BASE_URL to match your plan.

Docs: https://indianapi.in/documentation/indian-stock-market
"""
from __future__ import annotations

from base import BaseSource, SourceError, clean
from config import env
from models import Article, to_utc_iso


class Source(BaseSource):
    name = "indianapi"
    label = "Indian API"
    env_key = "INDIANAPI_API_KEY"
    homepage = "https://indianapi.in/indian-stock-market"
    country = "India (NSE/BSE)"
    min_interval = 1.5

    def __init__(self):
        super().__init__()
        self.base = env("INDIANAPI_BASE_URL", "https://stock.indianapi.in").rstrip("/")

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        headers = {"X-Api-Key": key}
        out: list[Article] = []

        # 1) Market-wide news feed.
        try:
            data = self.get(f"{self.base}/news", headers=headers)
            self.keep_raw({"endpoint": "news", "data": data})
            out.extend(self._parse(data, tickers=[]))
        except SourceError as exc:
            # Endpoint availability varies by plan; do not abort the whole run.
            self.log_warn(str(exc))

        # 2) Per-symbol news, carried inside the company payload.
        for sym in (symbols or []):
            try:
                data = self.get(f"{self.base}/stock", headers=headers,
                                params={"name": sym.strip()})
            except SourceError as exc:
                self.log_warn(f"{sym}: {exc}")
                continue
            self.keep_raw({"endpoint": "stock", "symbol": sym, "data": data})
            node = data.get("recentNews") or data.get("news") or []
            out.extend(self._parse(node, tickers=[sym.strip().upper()]))

        return out[:limit] if limit else out

    def log_warn(self, msg: str) -> None:
        import logging
        logging.getLogger("stocknews").warning("%s: %s", self.name, msg)

    def _parse(self, data, tickers: list[str]) -> list[Article]:
        if isinstance(data, dict):
            rows = data.get("data") or data.get("news") or data.get("results") or []
        else:
            rows = data or []
        if not isinstance(rows, list):
            return []

        out = []
        for item in rows:
            if not isinstance(item, dict):
                continue
            title = clean(item.get("title") or item.get("headline"), 500)
            if not title:
                continue
            out.append(Article(
                source=self.name,
                external_id=clean(item.get("id") or item.get("url")
                                  or item.get("link"), 400),
                title=title,
                url=clean(item.get("url") or item.get("link"), 1000),
                summary=clean(item.get("summary") or item.get("description")
                              or item.get("content")),
                published_at=to_utc_iso(item.get("pub_date") or item.get("date")
                                        or item.get("published_at")),
                publisher=clean(item.get("source") or item.get("publisher"), 200),
                country="IN",
                tickers=tickers,
                kind="news",
                raw=item,
            ))
        return out
