"""Mediastack -- cheapest paid entry ($24.99/mo) but the thinnest source base.

Free tier is an EVALUATION key, not a development tier: 100 calls per MONTH,
HTTP only (no TLS), delayed data, no historical access, no commercial use.
Budget accordingly -- you will exhaust it in an afternoon of testing.
Docs: https://mediastack.com/documentation
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, SourceError, clean
from models import Article, to_utc_iso

# The free plan is HTTP-only; paid plans accept https. Flip this if you upgrade.
ENDPOINT = "http://api.mediastack.com/v1/news"


class Source(BaseSource):
    name = "mediastack"
    label = "Mediastack"
    env_key = "MEDIASTACK_API_KEY"
    homepage = "https://mediastack.com"
    country = "Global"
    min_interval = 1.0

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        params = {
            "access_key": key,
            "countries": "in",
            "categories": "business",
            "languages": "en",
            "sort": "published_desc",
            "limit": min(limit, 100),
            "date": f"{since},{today}",  # historical range needs a paid plan
        }
        q = query or ",".join(symbols or [])
        if q:
            params["keywords"] = q

        data = self.get(ENDPOINT, params=params)
        self.keep_raw(data)
        if "error" in data:
            raise SourceError(f"{self.name}: {data['error']}")

        return [Article(
            source=self.name,
            external_id=clean(item.get("url"), 400),
            title=clean(item.get("title"), 500),
            url=clean(item.get("url"), 1000),
            summary=clean(item.get("description")),
            published_at=to_utc_iso(item.get("published_at")),
            publisher=clean(item.get("source"), 200),
            language=clean(item.get("language"), 10),
            country=clean(item.get("country"), 10),
            categories=[clean(item.get("category"), 60)] if item.get("category") else [],
            kind="news",
            raw=item,
        ) for item in (data.get("data") or [])]
