"""BSE India corporate announcements -- free, no key.

Worth taking alongside NSE for two reasons: BSE has more listed companies
(so 800-1500 filings/day), and it accepts XBRL for a defined set of Reg 29 /
Reg 30 disclosures. Structured filings let you classify an event type without
running an LLM over free text -- cheaper and far more reliable.

Like NSE this is the site's own front-end API, not a contracted product. It
needs a Referer header and will change without notice.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, clean
from models import Article, to_utc_iso

API = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"
ATTACH_BASE = "https://www.bseindia.com/xml-data/corpfiling/AttachLive/"

MAX_PAGES = 50

class Source(BaseSource):
    name = "bse"
    label = "BSE"
    env_key = ""
    homepage = "https://www.bseindia.com"
    country = "India"
    min_interval = 3.0
    fragile = True

    def fetch(self, symbols=None, query="", days=1, limit=50):
        self.session.headers.update({
            "Referer": "https://www.bseindia.com/corporates/ann.html",
            "Origin": "https://www.bseindia.com",
            "Accept": "application/json, text/plain, */*",
            "X-Requested-With": "XMLHttpRequest",
        })
        # to = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        # frm = to - timedelta(days=max(int(days), 1))

        ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        today = ist_now.date()

        articles: list[Article] = []
        for offset in range(max(int(days), 1)):
            day = today - timedelta(days=offset)
            if day.weekday() >= 5:          # Sat/Sun -- no filings, skip the call
                continue

            rows = self._fetch_day(day)
            for row in rows:
                articles.append(self._to_article(row))
                if len(articles) >= limit:
                    return articles
        return articles

    def _fetch_day(self, day):
        """One calendar day. strPrevDate must equal strToDate -- BSE returns a
        bare {} for any range. Paginates until collected rows reach ROWCNT."""
        stamp = day.strftime("%Y%m%d")
        collected: list[dict] = []
        expected: int | None = None

        if collected:
            self.keep_raw({"date": stamp, "Table": collected})
        return collected
