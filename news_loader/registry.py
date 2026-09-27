"""Discovers every adapter in sources/ so main.py never hard-codes a list."""
from __future__ import annotations

import importlib
import pkgutil
from typing import Type

from base import BaseSource

# Rough execution order: free/keyless primary sources first, vendors after.
PREFERRED_ORDER = [
    "nse", "bse", "sebi", "rbi", "pib",          # India primary (keyless)
    "gdelt",                                      # global macro (keyless)
    "indianapi", "bharatstock",                   # India vendors
    "eodhd", "marketaux", "alphavantage", "finnhub",  # ticker-tagged news
    "newsdata", "thenewsapi", "gnews", "mediastack", "newsapi_org",  # breadth
]


def discover() -> dict[str, Type[BaseSource]]:
    import sources as pkg

    found: dict[str, Type[BaseSource]] = {}
    for mod_info in pkgutil.iter_modules(pkg.__path__):
        if mod_info.name.startswith("_"):
            continue
        module = importlib.import_module(f"sources.{mod_info.name}")
        cls = getattr(module, "Source", None)
        if cls and issubclass(cls, BaseSource):
            found[cls.name] = cls
    return found


def ordered_names(available: dict[str, Type[BaseSource]]) -> list[str]:
    known = [n for n in PREFERRED_ORDER if n in available]
    rest = sorted(n for n in available if n not in PREFERRED_ORDER)
    return known + rest
