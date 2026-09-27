"""NewsData.io -- best India depth of any general news provider.

Free tier: 200 credits/day, 10 articles per credit (paid: 50), rate-limited
to 30 credits per 15 minutes. Two free-tier catches worth knowing before you
wire this into anything live:
  * articles are delayed 12 hours
  * full article content is not available on free
The free tier does permit commercial use, which is unusual in this category.

Supports 13 Indian languages and region/state filtering.
Docs: https://newsdata.io/documentation
"""
from __future__ import annotations

from base import BaseSource, SourceError, clean
from models import Article, to_utc_iso

ENDPOINT = "https://newsdata.io/api/1/latest"


class Source(BaseSource):
    name = "newsdata"
    label = "News Data"
    env_key = "NEWSDATA_API_KEY"
    homepage = "https://newsdata.io"
    country = "Global, strong India"
    min_interval = 2.0  # 30 credits / 15 min on free

    #: Add 'hi', 'ta', 'bn', 'mr', 'gu', 'te' etc. for regional-language breadth.
    LANGUAGES = "en"

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        params = {
            "apikey": key,
            "country": "in",
            "category": "business",
            "language": self.LANGUAGES,
        }
        # Free and Basic plans cap the search string at 100 characters.
        q = (query or " OR ".join(symbols or []))[:100]
        if q:
            params["q"] = q

        out: list[Article] = []
        next_page = None
        while True:
            if next_page:
                params["page"] = next_page
            data = self.get(ENDPOINT, params=params)
            self.keep_raw(data)

            if data.get("status") != "success":
                raise SourceError(f"{self.name}: {data.get('results', data)}")

            for item in (data.get("results") or []):
                stats = item.get("sentiment_stats") or {}
                sentiment = None
                if isinstance(stats, dict) and stats:
                    try:  # convert pos/neg split into a single -1..1 score
                        sentiment = (float(stats.get("positive", 0))
                                     - float(stats.get("negative", 0))) / 100.0
                    except (TypeError, ValueError):
                        sentiment = None

                out.append(Article(
                    source=self.name,
                    external_id=clean(item.get("article_id"), 120),
                    title=clean(item.get("title"), 500),
                    url=clean(item.get("link"), 1000),
                    summary=clean(item.get("description") or item.get("ai_summary")),
                    body=clean(item.get("content") or "", 20000),
                    published_at=to_utc_iso(item.get("pubDate")),
                    publisher=clean(item.get("source_name"), 200),
                    language=clean(item.get("language"), 20),
                    country=",".join(item.get("country") or []),
                    categories=(item.get("category") or []) + (item.get("ai_tag") or []),
                    sentiment=sentiment,
                    sentiment_label=clean(item.get("sentiment"), 40),
                    kind="news",
                    raw=item,
                ))

            next_page = data.get("nextPage")
            if not next_page or len(out) >= limit:
                break
        return out[:limit] if limit else out
