"""Shared plumbing for every source adapter."""
from __future__ import annotations

import logging
import random
import time
from typing import Any

from config import env, env_float
from models import Article

log = logging.getLogger("stocknews")

# NSE/BSE sit behind Akamai and fingerprint the TLS/JA3 handshake, not just the
# headers you send. curl_cffi with browser impersonation is the only thing that
# works; plain `requests` gets a 403 or an HTML interstitial every time.
try:
    from curl_cffi import requests as _http
    from curl_cffi.requests.errors import RequestsError as _HttpError
    _IMPERSONATE = {"impersonate": "chrome"}
except ImportError:  # pragma: no cover
    import requests as _http
    from requests import RequestException as _HttpError
    _IMPERSONATE = {}
    log.warning("curl_cffi unavailable -- NSE/BSE will 403. pip install curl_cffi")

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)


class SourceError(RuntimeError):
    pass


class MissingKey(SourceError):
    """Raised when a source needs a key that has not been filled in."""


class BlockedError(SourceError):
    """HTML body where JSON was expected -- WAF block or soft-redirect."""


class ApiRejected(SourceError):
    """API returned {"Status": false, "Message": ...} -- bad parameters."""


class EmptyEnvelope(SourceError):
    """Bare {} -- unsupported parameter combination or internal API error.

    Distinct from {"Table": []}, which is a legitimate no-data day. Pass
    strict_empty=False to downgrade this to a warning.
    """


class RateLimiter:
    """Crude but sufficient: enforce a minimum gap between calls."""

    def __init__(self, min_interval: float):
        self.min_interval = max(min_interval, 0.0)
        self._last = 0.0

    def wait(self) -> None:
        if self.min_interval <= 0:
            return
        gap = time.monotonic() - self._last
        if gap < self.min_interval:
            time.sleep(self.min_interval - gap)
        self._last = time.monotonic()


def looks_like_html(text: str) -> bool:
    head = (text or "").lstrip()[:512].lower()
    return head.startswith(("<!doctype html", "<html")) or "<head" in head


class BaseSource:
    """Subclass contract:

        name           short slug, also the CLI selector
        env_key        name of the .env variable holding the API key ("" if keyless)
        min_interval   polite floor between HTTP calls, seconds
        fetch(...)     returns list[Article]

    `fetch` receives the same keyword arguments for every source
    (symbols, query, days, limit) and ignores whatever does not apply.
    """

    name: str = "base"
    label: str = "Base"
    env_key: str = ""
    homepage: str = ""
    country: str = ""
    min_interval: float = 1.0
    #: True when the adapter scrapes HTML/undocumented JSON rather than a
    #: contracted API -- these are the ones that break when a site changes.
    fragile: bool = False

    def __init__(self):
        self.api_key = env(self.env_key) if self.env_key else ""
        self.limiter = RateLimiter(max(self.min_interval,
                                       env_float("GLOBAL_MIN_INTERVAL", 1.0)))
        self.session = _http.Session(**_IMPERSONATE)
        self.session.headers.update({
            "User-Agent": DEFAULT_UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        })
        self.last_payloads: list[Any] = []

    # -- availability -------------------------------------------------------
    @property
    def requires_key(self) -> bool:
        return bool(self.env_key)

    def is_configured(self) -> bool:
        return (not self.requires_key) or bool(self.api_key)

    def require_key(self) -> str:
        if not self.api_key:
            raise MissingKey(
                f"{self.name}: set {self.env_key} in .env (currently blank)")
        return self.api_key

    # -- HTTP ---------------------------------------------------------------
    def request(self, method: str, url: str, *, retries: int = 3,
                timeout: int = 30, expect_json: bool = True,
                strict_empty: bool = True, **kwargs):
        """One HTTP call with backoff on 429/5xx. Archives nothing itself --
        the caller decides what is worth keeping raw."""
        last_exc: Exception | None = None
        for attempt in range(retries):
            self.limiter.wait()
            try:
                resp = self.session.request(method, url, timeout=timeout, **kwargs)
            except _HttpError as exc:
                last_exc = exc
                log.warning("%s: network error (%s), attempt %d/%d",
                            self.name, exc, attempt + 1, retries)
                time.sleep(2 ** attempt + random.random())
                continue

            if resp.status_code == 429:
                print("429 BODY:", resp.text[:300])
                print("429 HEADERS:", dict(resp.headers))
                wait = float(resp.headers.get("Retry-After") or 60.0)
                log.warning("%s: rate limited, sleeping %.1fs", self.name, wait)
                time.sleep(wait)
                continue
            if resp.status_code in (401, 403):
                raise SourceError(
                    f"{self.name}: HTTP {resp.status_code} -- check your API key "
                    f"or plan/base-URL entitlement. Body: {resp.text[:200]}")
            if resp.status_code >= 500:
                log.warning("%s: HTTP %d, retrying", self.name, resp.status_code)
                time.sleep(2 ** attempt + random.random())
                continue
            if resp.status_code >= 400:
                raise SourceError(
                    f"{self.name}: HTTP {resp.status_code}: {resp.text[:300]}")

            if not expect_json:
                return resp

            body = resp.text or ""

            # 1. HTML where JSON was promised -- blocked or soft-redirected.
            if looks_like_html(body):
                raise BlockedError(
                    f"{self.name}: HTML response from {url} "
                    f"(HTTP {resp.status_code}) -- missing Referer/Origin?")

            try:
                data = resp.json()
            except ValueError as exc:
                raise SourceError(
                    f"{self.name}: expected JSON, got {body[:200]!r}") from exc

            # 2. Explicit rejection -- surface the API's own message verbatim.
            if isinstance(data, dict) and data.get("Status") is False:
                raise ApiRejected(
                    f"{self.name}: {data.get('Message') or 'no message'}")

            # 3. Bare {} -- never legitimate; BSE emits it for bad param combos
            #    such as a multi-day date range.
            if isinstance(data, dict) and not data:
                msg = (f"{self.name}: bare {{}} from {url} "
                       f"params={kwargs.get('params')} "
                       f"-- unsupported parameter combination")
                if strict_empty:
                    raise EmptyEnvelope(msg)
                log.warning(msg)

            # 4. Valid JSON. {"Table": []} is a genuine no-filings day.
            return data

        raise SourceError(f"{self.name}: giving up after {retries} attempts "
                          f"(last_exc={last_exc})")

    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)

    def keep_raw(self, payload: Any) -> None:
        """Stash a payload so main.py can write it to the raw archive."""
        self.last_payloads.append(payload)

    # -- to implement -------------------------------------------------------
    def fetch(self, symbols: list[str] | None = None, query: str = "",
              days: int = 1, limit: int = 50) -> list[Article]:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# helpers shared by adapters
# ---------------------------------------------------------------------------

def clean(text: Any, max_len: int = 4000) -> str:
    if text is None:
        return ""
    s = str(text).replace("\r", " ").replace("\xa0", " ").strip()
    s = " ".join(s.split())
    return s[:max_len]


def as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, (list, tuple, set)):
        return [str(v).strip() for v in value if str(v).strip()]
    return [str(value)]
