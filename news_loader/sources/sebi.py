"""SEBI -- orders, circulars and press releases. Free, no key.

Enforcement orders move individual stocks hard, and there are few of them a
day, so the signal-to-noise here is excellent.

SEBI serves this through a Liferay-style POST endpoint rather than a clean
API, so this adapter is the most likely in the project to need a tweak. If
the JSON shape changes, the fallback HTML parse below still gets you titles
and links. Check the network tab on sebi.gov.in and adjust `PAYLOAD`.
"""
from __future__ import annotations

from base import BaseSource, clean
from models import Article, to_utc_iso

LIST_URL = "https://www.sebi.gov.in/sebiweb/home/HomeAction.do"

#: sid/ssid pairs identify a SEBI section. These are the commonly used ones;
#: confirm against the site if results come back empty.
SECTIONS = {
    "orders":        {"sid": 4, "ssid": 25},
    "circulars":     {"sid": 1, "ssid": 7},
    "press_releases": {"sid": 6, "ssid": 23},
}


class Source(BaseSource):
    name = "sebi"
    label = "SEBI"
    env_key = ""
    homepage = "https://www.sebi.gov.in"
    country = "India"
    min_interval = 3.0
    fragile = True

    def fetch(self, symbols=None, query="", days=1, limit=50):
        out: list[Article] = []
        for label, ids in SECTIONS.items():
            payload = {
                "doDirect": "getPage",
                "search": "",
                "fromDate": "",
                "toDate": "",
                "sid": ids["sid"],
                "ssid": ids["ssid"],
                "smid": 0,
                "ssidhidden": ids["ssid"],
                "intmid": -1,
                "sText": "",
                "pageNumber": 1,
                "verType": "",
                "deptId": "",
            }
            try:
                resp = self.request(
                    "POST", LIST_URL, data=payload, expect_json=False, timeout=40,
                    headers={"Content-Type": "application/x-www-form-urlencoded",
                             "Referer": "https://www.sebi.gov.in/"})
            except Exception as exc:  # noqa: BLE001
                import logging
                logging.getLogger("stocknews").warning(
                    "%s: section %s failed (%s)", self.name, label, exc)
                continue
            self.keep_raw({"section": label, "html": resp.text[:200000]})
            out.extend(self._parse_html(resp.text, label))
        return out[:limit] if limit else out

    def _parse_html(self, html: str, category: str) -> list[Article]:
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            import logging
            logging.getLogger("stocknews").warning(
                "%s: beautifulsoup4 not installed; skipping parse", self.name)
            return []

        soup = BeautifulSoup(html, "lxml")
        out = []
        # SEBI renders listings as table rows: date cell + anchor cell.
        for row in soup.select("table tr"):
            link = row.find("a", href=True)
            if not link:
                continue
            title = clean(link.get_text(" ", strip=True), 500)
            if not title or len(title) < 8:
                continue
            cells = [clean(td.get_text(" ", strip=True), 60)
                     for td in row.find_all("td")]
            date_text = next((c for c in cells if any(ch.isdigit() for ch in c)
                              and len(c) <= 24), "")
            href = link["href"]
            if href.startswith("/"):
                href = "https://www.sebi.gov.in" + href
            out.append(Article(
                source=self.name,
                external_id=href,
                title=title,
                url=href,
                published_at=to_utc_iso(date_text),
                publisher="SEBI",
                country="IN",
                language="en",
                categories=[category],
                kind="policy",
                raw={"title": title, "href": href, "date_text": date_text,
                     "category": category},
            ))
        return out
