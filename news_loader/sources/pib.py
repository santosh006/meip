"""Press Information Bureau -- government policy announcements across
ministries. Free, no key.

Useful for sector-level signals: defence, railways, pharma, energy orders and
policy changes surface here before they reach the financial press. Low volume,
so it costs you almost nothing to include.

HTML scrape -- selectors will need checking if PIB redesigns.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from base import BaseSource, clean
from models import Article, to_utc_iso

BASE = "https://pib.gov.in"
ALL_RELEASES = f"{BASE}/allRel.aspx"


class Source(BaseSource):
    name = "pib"
    label = "Press Information Bureau"
    env_key = ""
    homepage = BASE
    country = "India"
    min_interval = 3.0
    fragile = True

    def fetch(self, symbols=None, query="", days=1, limit=50):
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            import logging
            logging.getLogger("stocknews").warning(
                "%s: beautifulsoup4 not installed; skipping", self.name)
            return []

        resp = self.request("GET", ALL_RELEASES, expect_json=False, timeout=40)
        self.keep_raw({"html": resp.text[:200000]})
        soup = BeautifulSoup(resp.text, "lxml")

        ist_today = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30))
        out: list[Article] = []
        seen: set[str] = set()

        for link in soup.select("a[href*='PressRelease'], a[href*='PressReleseDetail'], "
                                "ul.num li a, .content-area a[href]"):
            href = link.get("href", "")
            title = clean(link.get_text(" ", strip=True), 500)
            if not href or not title or len(title) < 15:
                continue
            if href.startswith("/"):
                href = BASE + href
            elif not href.startswith("http"):
                href = f"{BASE}/{href.lstrip('./')}"
            if href in seen:
                continue
            seen.add(href)

            out.append(Article(
                source=self.name,
                external_id=href,
                title=title,
                url=href,
                # PIB's listing page does not stamp a time per item; anchoring
                # to the listing date is the honest thing to record.
                published_at=to_utc_iso(ist_today.strftime("%Y-%m-%d")),
                publisher="Press Information Bureau",
                country="IN",
                language="en",
                kind="press_release",
                raw={"title": title, "href": href},
            ))
            if limit and len(out) >= limit:
                break
        return out
