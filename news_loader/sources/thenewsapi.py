"""TheNewsAPI -- cheapest genuinely usable paid tier in the category ($19/mo).

Free tier: 100 requests/day but only 3 articles per request, same structure
as Marketaux (same team). No sentiment, no ticker tagging -- raw breadth only.
Docs: https://www.thenewsapi.com/documentation
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, clean
from models import Article, to_utc_iso

ENDPOINT = "https://api.thenewsapi.com/v1/news/all"


class Source(BaseSource):
    name = "thenewsapi"
    label = "The News API"
    env_key = "THENEWSAPI_API_KEY"
    homepage = "https://www.thenewsapi.com"
    country = "Global"
    min_interval = 1.0

    def fetch(self, symbols=None, query="", days=1, limit=50):
        token = self.require_key()
        params = {
            "api_token": token,
            "language": "en",
            "locale": "in",
            "categories": "business",
            "published_after": (datetime.now(timezone.utc) - timedelta(days=days))
                .strftime("%Y-%m-%d"),
            "limit": min(limit, 100),  # free plan clamps to 3
        }
        q = query or " | ".join(symbols or [])
        if q:
            params["search"] = q

        data = self.get(ENDPOINT, params=params)
        self.keep_raw(data)

        return [Article(
            source=self.name,
            external_id=clean(item.get("uuid"), 80),
            title=clean(item.get("title"), 500),
            url=clean(item.get("url"), 1000),
            summary=clean(item.get("description") or item.get("snippet")),
            published_at=to_utc_iso(item.get("published_at")),
            publisher=clean(item.get("source"), 200),
            language=clean(item.get("language"), 10),
            country=clean(item.get("locale"), 10),
            categories=[clean(c, 60) for c in (item.get("categories") or [])],
            kind="news",
            raw=item,
        ) for item in (data.get("data") or [])]
