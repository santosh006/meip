"""NSE India corporate announcements -- free, no key, and your event backbone."""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

from base import BaseSource, SourceError, clean
from models import Article, to_utc_iso

HOME = "https://www.nseindia.com"
ARCHIVES = "https://nsearchives.nseindia.com"
ANNOUNCEMENTS = f"{HOME}/api/corporate-announcements"
FILINGS_PAGE = f"{HOME}/companies-listing/corporate-filings-announcements"
IST = ZoneInfo("Asia/Kolkata")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

NAV_HEADERS = {
    "User-Agent": UA,
    "Accept": ("text/html,application/xhtml+xml,application/xml;q=0.9,"
               "image/avif,image/webp,*/*;q=0.8"),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}

XHR_HEADERS = {
    "Accept": "*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": FILINGS_PAGE,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}

COOKIE_TTL = timedelta(minutes=8)


class Source(BaseSource):
    name = "nse"
    label = "NSE"
    env_key = ""
    homepage = HOME
    country = "India"
    min_interval = 3.0
    fragile = True

    _warm_at: datetime | None = None

    # ---- warm-up -------------------------------------------------

    def _warmup(self, force: bool = False) -> None:
        now = datetime.now(IST)
        if not force and self._warm_at and now - self._warm_at < COOKIE_TTL:
            return

        self.session.cookies.clear()
        self.session.headers.clear()
        self.session.headers.update(NAV_HEADERS)

        try:
            self.request("GET", HOME, expect_json=False, timeout=20)
            # second nav has a Referer and same-origin, as a browser would
            self.request("GET", FILINGS_PAGE, expect_json=False, timeout=20,
                         headers={"Referer": HOME + "/",
                                  "Sec-Fetch-Site": "same-origin"})
        except SourceError as exc:
            raise SourceError(self._diagnose(exc)) from exc

        got = set(self.session.cookies.get_dict())
        if not got & {"nsit", "nseappid", "bm_sv", "ak_bmsc"}:
            raise SourceError(
                f"{self.name}: warm-up returned 200 but set no session cookies "
                f"(got: {sorted(got) or 'none'}). Served a CDN challenge page "
                f"rather than the real site.")

        self._warm_at = now

    @staticmethod
    def _diagnose(exc: Exception) -> str:
        body = str(exc)
        if "Access Denied" in body or "Reference #" in body:
            return ("nse: blocked at the CDN edge (Akamai), not an auth failure -- "
                    "this endpoint is keyless. Almost always a datacentre IP. "
                    "Use curl_cffi for TLS impersonation, and an Indian "
                    "residential/ISP proxy if that is not enough.")
        return f"nse: warm-up failed ({body})"

    # ---- fetch ---------------------------------------------------

    def _query(self, params: dict, timeout: int = 40):
        try:
            return self.get(ANNOUNCEMENTS, params=params,
                            headers=XHR_HEADERS, timeout=timeout)
        except SourceError:
            self._warmup(force=True)          # cookies likely expired
            return self.get(ANNOUNCEMENTS, params=params,
                            headers=XHR_HEADERS, timeout=timeout)

    def fetch(self, symbols=None, query="", days=1, limit=50):
        self._warmup()

        to = datetime.now(IST)
        frm = to - timedelta(days=max(int(days), 1) - 1)
        base = {
            "index": "equities",
            "from_date": frm.strftime("%d-%m-%Y"),
            "to_date": to.strftime("%d-%m-%Y"),
        }

        wanted = {s.strip().upper() for s in (symbols or []) if s.strip()}
        rows: list[dict] = []

        if wanted and len(wanted) <= 10:
            for sym in sorted(wanted):                 # server-side filter
                data = self._query({**base, "symbol": sym})
                self.keep_raw(data)
                rows.extend(data if isinstance(data, list)
                            else (data.get("data") or []))
        else:
            data = self._query(base)
            self.keep_raw(data)
            rows = data if isinstance(data, list) else (data.get("data") or [])

        out: list[Article] = []
        seen: set[str] = set()

        for item in rows:
            sym = clean(item.get("symbol"), 40).upper()
            if wanted and sym not in wanted:
                continue

            subject = clean(item.get("desc") or item.get("subject"), 300)
            headline = clean(item.get("attchmntText") or item.get("smIndustry")
                             or subject, 1000)
            att = self._abs_url(clean(item.get("attchmntFile"), 1000))
            ts = self._ist_to_utc(item.get("an_dt") or item.get("sort_date"))

            ext_id = self._ext_id(item, sym)
            if ext_id in seen:
                continue
            seen.add(ext_id)

            out.append(Article(
                source=self.name,
                external_id=ext_id,
                title=f"{sym}: {subject}" if sym else subject,
                summary=headline,
                url=att,
                attachment_url=att,
                published_at=ts,
                publisher="NSE India",
                country="IN",
                tickers=[sym] if sym else [],
                isin=clean(item.get("isin"), 20),
                categories=[subject] if subject else [],
                kind="filing",
                raw=item,
            ))

        out.sort(key=lambda a: a.published_at or "", reverse=True)
        return out[:limit] if limit else out

    # ---- helpers -------------------------------------------------

    @staticmethod
    def _abs_url(url: str) -> str:
        if not url:
            return ""
        return url if url.startswith("http") else urljoin(ARCHIVES + "/", url.lstrip("/"))

    @staticmethod
    def _ist_to_utc(value) -> str | None:
        """NSE returns naive IST wall-clock. Localise before converting."""
        if not value:
            return None
        raw = str(value).strip()
        for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S",
                    "%Y-%m-%d %H:%M:%S", "%d-%b-%Y"):
            try:
                dt = datetime.strptime(raw, fmt)
            except ValueError:
                continue
            return to_utc_iso(dt.replace(tzinfo=IST))
        return to_utc_iso(raw)          # fall back to the generic parser

    @staticmethod
    def _ext_id(item: dict, sym: str) -> str:
        seq = item.get("seqId")
        if seq:
            return f"nse:{clean(seq, 100)}"
        parts = "|".join(str(item.get(k, "")) for k in
                         ("symbol", "an_dt", "desc", "attchmntFile"))
        return f"nse:{hashlib.sha1(parts.encode()).hexdigest()[:24]}"
