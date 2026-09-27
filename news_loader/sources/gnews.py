"""GNews -- Google News-style aggregation.

Free tier: 100 requests/day, 10 articles per request, 12-hour delay, 30 days
of history, 1 req/sec, CORS on localhost only, and explicitly
DEVELOPMENT / NON-COMMERCIAL USE ONLY. Read the licence before shipping.
Docs: https://gnews.io/docs/v4
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, clean
from models import Article, to_utc_iso

ENDPOINT = "https://gnews.io/api/v4/search"


class Source(BaseSource):
    name = "gnews"
    label = "GNews"
    env_key = "GNEWS_API_KEY"
    homepage = "https://gnews.io"
    country = "Global"
    min_interval = 1.2  # free plan is 1 request/second

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        q = query or " OR ".join(symbols or []) or "stock market India"
        params = {
            "apikey": key,
            "q": q,
            "lang": "en",
            "country": "in",
            "max": min(limit, 100),  # free plan clamps to 10
            "from": (datetime.now(timezone.utc) - timedelta(days=days))
                .strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sortby": "publishedAt",
        }
        data = self.get(ENDPOINT, params=params)
        self.keep_raw(data)

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
            country="in",
            kind="news",
            raw=item,
        ) for item in (data.get("articles") or [])]
