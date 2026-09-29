"""Marketaux -- financial news with PER-ENTITY sentiment.

Free tier: 100 requests/day, but only 3 articles per request. The request
count is not the binding constraint; the payload cap is.
Docs: https://www.marketaux.com/documentation
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, clean
from models import Article, to_utc_iso

ENDPOINT = "https://api.marketaux.com/v1/news/all"


class Source(BaseSource):
    name = "marketaux"
    label = "Marketaux (Global)"
    env_key = "MARKETAUX_API_KEY"
    homepage = "https://www.marketaux.com"
    country = "Global (incl. India)"
    min_interval = 1.0

    def fetch(self, symbols=None, query="", days=1, limit=50):
        token = self.require_key()
        published_after = (datetime.now(timezone.utc) - timedelta(days=days)) \
            .strftime("%Y-%m-%dT%H:%M")

        params = {
            "api_token": token,
            "language": "en",
            "published_after": published_after,
            # Free plan silently clamps this to 3. Asking for more is harmless.
            "limit": min(limit, 100),
        }
        if symbols:
            # Marketaux wants exchange-suffixed symbols for Indian equities,
            # e.g. RELIANCE.NSE / RELIANCE.BSE. Bare symbols often miss.
            params["symbols"] = ",".join(self._qualify(s) for s in symbols)
        else:
            params["countries"] = "in"
            if query:
                params["search"] = query

        data = self.get(ENDPOINT, params=params)
        self.keep_raw(data)

        out: list[Article] = []
        for item in (data.get("data") or []):
            tickers, sentiments, relevances = [], [], []
            for ent in (item.get("entities") or []):
                sym = clean(ent.get("symbol"), 40)
                if sym:
                    tickers.append(sym)
                if ent.get("sentiment_score") is not None:
                    sentiments.append(float(ent["sentiment_score"]))
                if ent.get("match_score") is not None:
                    relevances.append(float(ent["match_score"]))

            out.append(Article(
                source=self.name,
                external_id=clean(item.get("uuid"), 80),
                title=clean(item.get("title"), 500),
                url=clean(item.get("url"), 1000),
                summary=clean(item.get("description") or item.get("snippet")),
                published_at=to_utc_iso(item.get("published_at")),
                publisher=clean(item.get("source"), 200),
                language=clean(item.get("language"), 10),
                tickers=sorted(set(tickers)),
                sentiment=(sum(sentiments) / len(sentiments)) if sentiments else None,
                relevance=max(relevances) if relevances else None,
                kind="news",
                raw=item,
            ))
        return out

    @staticmethod
    def _qualify(symbol: str) -> str:
        s = symbol.strip().upper()
        return s if "." in s else f"{s}.NSE"
