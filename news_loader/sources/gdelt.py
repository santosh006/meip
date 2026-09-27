"""GDELT DOC 2.0 -- free, keyless, and the best macro input at any price.

No API key, no account. Monitors world news in 100+ languages, updating every
15 minutes, with a tone (sentiment) score per article.

Constraints that shape how you use it:
  * roughly 1 request per 5 seconds -- strictly enforced, 429 on breach
  * rolling THREE MONTH window only; deeper history lives in the S3/BigQuery
    exports, not this API
  * up to 250 articles per request
  * no article body, no ticker tagging

So: do not use it for company-level precision. Use it for coverage-volume and
tone timeseries as index-level features.
Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
"""
from __future__ import annotations

from base import BaseSource, clean
from models import Article, to_utc_iso

ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"


class Source(BaseSource):
    name = "gdelt"
    label = "GDELT"
    env_key = ""              # keyless
    homepage = "https://www.gdeltproject.org"
    country = "Global (100+ languages)"
    min_interval = 10.0        # 1 req / 5s, plus a safety margin

    def fetch(self, symbols=None, query="", days=1, limit=50):
        q = query or '(Sensex OR Nifty OR "Indian stock market" OR "Indian markets") sourcecountry:IN'
        params = {
            "query": q,
            "mode": "ArtList",
            "format": "json",
            "maxrecords": min(max(limit, 1), 250),
            "timespan": f"{max(int(days), 1) * 24}h",
            "sort": "DateDesc",
        }
        data = self.get(ENDPOINT, params=params)
        self.keep_raw(data)

        out: list[Article] = []
        for item in (data.get("articles") or []):
            tone = item.get("tone")
            try:
                # GDELT tone runs roughly -100..+100; scale to -1..1.
                tone = float(tone) / 100.0 if tone is not None else None
            except (TypeError, ValueError):
                tone = None
            out.append(Article(
                source=self.name,
                external_id=clean(item.get("url"), 400),
                title=clean(item.get("title"), 500),
                url=clean(item.get("url"), 1000),
                published_at=to_utc_iso(item.get("seendate")),
                publisher=clean(item.get("domain"), 200),
                language=clean(item.get("language"), 30),
                country=clean(item.get("sourcecountry"), 60),
                sentiment=tone,
                kind="news",
                raw=item,
            ))
        return out

    def timeline(self, query: str, days: int = 30) -> dict:
        """Coverage-volume timeseries -- the actually useful GDELT feature.

        Returns the raw timeline payload; feed it straight into your feature
        table as a daily 'how loudly was the world talking about X' series.
        """
        data = self.get(ENDPOINT, params={
            "query": query, "mode": "TimelineVolInfo", "format": "json",
            "timespan": f"{max(int(days), 1) * 24}h",
        })
        self.keep_raw(data)
        return data
