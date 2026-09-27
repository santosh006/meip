"""Reserve Bank of India -- press releases and policy, via RSS. Free, no key.

Low volume (a handful of items a day) but disproportionately high signal:
MPC statements and minutes move the whole banking and NBFC complex and the
index with it. Cheap to add, hard to justify leaving out.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

from base import BaseSource, clean
from models import Article, to_utc_iso

FEEDS = {
    "press_releases": "https://website.rbi.org.in/en/web/rbi/press-releases?p_p_id=com_liferay_asset_publisher_web_portlet_AssetPublisherPortlet&_com_liferay_asset_publisher_web_portlet_AssetPublisherPortlet_action=rss",
    "notifications": "https://website.rbi.org.in/en/web/rbi/notifications?p_p_id=com_liferay_asset_publisher_web_portlet_AssetPublisherPortlet&_com_liferay_asset_publisher_web_portlet_AssetPublisherPortlet_action=rss",
}


class Source(BaseSource):
    name = "rbi"
    label = "Reserve Bank of India"
    env_key = ""
    homepage = "https://www.rbi.org.in"
    country = "India"
    min_interval = 2.0
    fragile = True  # RBI has changed its CMS and feed URLs before

    def fetch(self, symbols=None, query="", days=1, limit=50):
        out: list[Article] = []
        for label, url in FEEDS.items():
            try:
                resp = self.request("GET", url, expect_json=False, timeout=30)
            except Exception as exc:  # noqa: BLE001 - one dead feed must not kill the run
                import logging
                logging.getLogger("stocknews").warning(
                    "%s: feed %s unavailable (%s)", self.name, label, exc)
                continue
            self.keep_raw({"feed": label, "xml": resp.text[:200000]})
            out.extend(self._parse_rss(resp.text, label))
        return out[:limit] if limit else out

    def _parse_rss(self, xml_text: str, category: str) -> list[Article]:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return []
        out = []
        for item in root.iter("item"):
            def txt(tag: str) -> str:
                node = item.find(tag)
                return clean(node.text if node is not None else "", 4000)

            title = txt("title")
            if not title:
                continue
            out.append(Article(
                source=self.name,
                external_id=txt("guid") or txt("link"),
                title=title,
                url=txt("link"),
                summary=txt("description"),
                published_at=to_utc_iso(txt("pubDate")),
                publisher="Reserve Bank of India",
                country="IN",
                language="en",
                categories=[category],
                kind="policy",
                raw={"title": title, "category": category},
            ))
        return out
