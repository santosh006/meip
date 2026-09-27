"""NewsAPI.org -- the best-known general news API, and the worst value here.

Free tier: 100 requests/day, DEVELOPMENT USE ONLY, delayed articles, one
month of history. The first paid tier jumps straight to $449/month. Included
for completeness; NewsData.io beats it on every axis for an India-first build.
Docs: https://newsapi.org/docs
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, SourceError, clean
from models import Article, to_utc_iso

ENDPOINT = "https://newsapi.org/v2/everything"


class Source(BaseSource):
    name = "newsapi_org"
    label = "News API"
    env_key = "NEWSAPI_ORG_API_KEY"
    homepage = "https://newsapi.org"
    country = "Global"
    min_interval = 1.0

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        q = query or " OR ".join(symbols or []) or "Indian stock market"
        params = {
            "q": q,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": min(limit, 100),
            "from": (datetime.now(timezone.utc) - timedelta(days=days))
                .strftime("%Y-%m-%d"),
        }
        data = self.get(ENDPOINT, params=params,
                        headers={"X-Api-Key": key})
        self.keep_raw(data)
        if data.get("status") != "ok":
            raise SourceError(f"{self.name}: {data.get('message', data)}")

        return [Article(
            source=self.name,
            external_id=clean(item.get("url"), 400),
            title=clean(item.get("title"), 500),
            url=clean(item.get("url"), 1000),
            summary=clean(item.get("description")),
            body=clean(item.get("content") or "", 20000),
            published_at=to_utc_iso(item.get("publishedAt")),
            publisher=clean((item.get("source") or {}).get("name"), 200),
            language="en",
            kind="news",
            raw=item,
        ) for item in (data.get("articles") or [])]
