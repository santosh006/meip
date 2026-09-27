"""Alpha Vantage NEWS_SENTIMENT -- the best-documented sentiment schema here.

Two-layer scoring: article-level `overall_sentiment_score` plus a per-ticker
`ticker_sentiment_score` with an explicit `relevance_score` (0-1). Use the
relevance score to drop passing mentions -- that is the single biggest source
of noise in naive news/price correlation.

Free tier: 25 requests/day (5/min). Up to 1000 articles per request, so one
call can cover a whole day. Non-US equity coverage is thin -- VERIFY your NSE
symbols return anything before relying on this.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, SourceError, clean
from models import Article, to_utc_iso

ENDPOINT = "https://www.alphavantage.co/query"


class Source(BaseSource):
    name = "alphavantage"
    label = "Alpha Vantage"
    env_key = "ALPHAVANTAGE_API_KEY"
    homepage = "https://www.alphavantage.co"
    country = "Global, US-weighted"
    min_interval = 13.0  # free tier is 5 req/min; stay well under

    def fetch(self, symbols=None, query="", days=1, limit=50):
        key = self.require_key()
        time_from = (datetime.now(timezone.utc) - timedelta(days=days)) \
            .strftime("%Y%m%dT%H%M")

        params = {
            "function": "NEWS_SENTIMENT",
            "apikey": key,
            "time_from": time_from,
            "sort": "LATEST",
            "limit": min(max(limit, 1), 1000),
        }
        if symbols:
            # Alpha Vantage uses BSE: / NSE: prefixes for Indian tickers.
            params["tickers"] = ",".join(self._qualify(s) for s in symbols)
        else:
            params["topics"] = "financial_markets,economy_macro"

        data = self.get(ENDPOINT, params=params)
        self.keep_raw(data)

        # Alpha Vantage returns 200 with an error string in the body.
        for bad in ("Error Message", "Note", "Information"):
            if bad in data and "feed" not in data:
                raise SourceError(f"{self.name}: {data[bad]}")

        out: list[Article] = []
        for item in (data.get("feed") or []):
            tickers, scores, rels = [], [], []
            for ts in (item.get("ticker_sentiment") or []):
                sym = clean(ts.get("ticker"), 40)
                if sym:
                    tickers.append(sym)
                try:
                    scores.append(float(ts.get("ticker_sentiment_score")))
                    rels.append(float(ts.get("relevance_score")))
                except (TypeError, ValueError):
                    pass

            overall = item.get("overall_sentiment_score")
            out.append(Article(
                source=self.name,
                external_id=clean(item.get("url"), 400),
                title=clean(item.get("title"), 500),
                url=clean(item.get("url"), 1000),
                summary=clean(item.get("summary")),
                published_at=to_utc_iso(item.get("time_published")),
                publisher=clean(item.get("source"), 200),
                tickers=sorted(set(tickers)),
                categories=[clean(t.get("topic"), 60)
                            for t in (item.get("topics") or []) if t.get("topic")],
                sentiment=float(overall) if overall is not None else (
                    sum(scores) / len(scores) if scores else None),
                sentiment_label=clean(item.get("overall_sentiment_label"), 40),
                relevance=max(rels) if rels else None,
                kind="news",
                raw=item,
            ))
        return out

    @staticmethod
    def _qualify(symbol: str) -> str:
        s = symbol.strip().upper()
        if ":" in s:
            return s
        return f"NSE:{s}"
