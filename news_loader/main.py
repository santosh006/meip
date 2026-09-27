#!/usr/bin/env python3
"""Orchestrator for the news ingestion pipeline.

Every source with a free tier is wired up here. Sources whose API key is
still blank in .env are skipped automatically -- fill in the keys you have
and the rest simply stay dormant.

Examples
--------
    python main.py --list
    python main.py --list --json
    python main.py --check
    python main.py --sources nse,bse,gdelt
    python main.py --all --symbols RELIANCE,TCS --days 2
    python main.py --all --dry-run
    python main.py --stats

Only free-tier-capable sources are included. Benzinga/Polygon, Tickerplant,
TrueData, Global Datafeeds, MarketMaker and the Apify scraper are deliberately
absent: none of them offers a self-serve free tier.
"""
from __future__ import annotations

import argparse
import contextlib
import io
import json
import logging
import sys
import time
import traceback

from config import env, env_list, load_env
from base import BaseSource, MissingKey, SourceError
from registry import discover, ordered_names
from storage import Store

log = logging.getLogger("stocknews")


def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def build_catalogue(registry: dict) -> list[dict]:
    """Return the adapter catalogue as plain dicts."""
    rows = []
    for name in ordered_names(registry):
        cls = registry[name]
        try:
            configured = cls().is_configured()
        except Exception:  # noqa: BLE001
            configured = False

        needs_key = bool(cls.env_key)
        rows.append(
            {
                "key": name,            # frontend dropdown reads this
                "id": name,
                "name": name,
                "label": getattr(cls, "label", name),
                "kind": getattr(cls, "kind", "news"),
                "country": getattr(cls, "country", None),
                "requires_key": needs_key,
                "key_env": cls.env_key or None,
                "fragile": bool(getattr(cls, "fragile", False)),
                "ready": (not needs_key) or configured,
            }
        )
    return rows


def print_catalogue(registry: dict, as_json: bool = False) -> None:
    """Print the adapter catalogue, human-readable or machine-readable."""
    rows = build_catalogue(registry)

    if as_json:
        json.dump({"sources": rows}, sys.stdout)
        sys.stdout.write("\n")
        return

    print(f"\n{'SOURCE':<14} {'KEY REQUIRED':<24} {'STATUS':<14} MARKET")
    print("-" * 84)
    for r in rows:
        key = r["key_env"] or "-- none (keyless) --"
        status = "ready" if r["ready"] else "key blank"
        flag = " [fragile]" if r["fragile"] else ""
        print(f"{r['key']:<14} {key:<24} {status:<14} {r['country']}{flag}")
    print("\n[fragile] = scrapes HTML or an undocumented endpoint; expect to "
          "adjust selectors when the site changes.\n")


def run_source(cls, store: Store, args) -> tuple[int, int]:
    inst: BaseSource = cls()

    if not inst.is_configured():
        log.info("%-12s skipped -- %s is blank in .env", inst.name, inst.env_key)
        return 0, 0

    run_id = store.start_run(inst.name)
    started = time.time()
    try:
        articles = inst.fetch(
            symbols=args.symbols or None,
            query=args.query,
            days=args.days,
            limit=args.limit,
        )
    except MissingKey as exc:
        log.info("%-12s skipped -- %s", inst.name, exc)
        store.finish_run(run_id, 0, 0, "skipped", str(exc))
        return 0, 0
    except SourceError as exc:
        log.error("%-12s FAILED -- %s", inst.name, exc)
        store.finish_run(run_id, 0, 0, "error", str(exc))
        return 0, 0
    except Exception as exc:  # noqa: BLE001 - one bad adapter must not stop the run
        log.error("%-12s CRASHED -- %s", inst.name, exc)
        log.debug(traceback.format_exc())
        store.finish_run(run_id, 0, 0, "crash", traceback.format_exc())
        return 0, 0

    if args.dry_run:
        log.info("%-12s %d articles (dry run, nothing written) in %.1fs",
                 inst.name, len(articles), time.time() - started)
        for a in articles[:3]:
            log.info("               - [%s] %s", a.published_at or "no-date",
                     a.title[:90])
        store.finish_run(run_id, len(articles), 0, "dry-run")
        return len(articles), 0

    for payload in inst.last_payloads:
        store.archive_raw(inst.name, payload)
    inserted = store.save(articles)

    log.info("%-12s %3d fetched, %3d new  (%.1fs)",
             inst.name, len(articles), inserted, time.time() - started)
    store.finish_run(run_id, len(articles), inserted, "ok")
    return len(articles), inserted


def main(argv=None) -> int:
    # Import-time side effects must never pollute stdout: the API route parses
    # stdout as JSON. Anything printed here is rerouted to stderr.
    _noise = io.StringIO()
    with contextlib.redirect_stdout(_noise):
        load_env()
        registry = discover()
    if _noise.getvalue():
        print(_noise.getvalue(), file=sys.stderr, end="")

    p = argparse.ArgumentParser(
        description="Fetch stock-relevant news from every configured source.",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--list", action="store_true",
                   help="show every adapter and whether its key is filled in")
    p.add_argument("--check", action="store_true",
                   help="same as --list, then exit non-zero if nothing is ready")
    p.add_argument("--stats", action="store_true",
                   help="row counts per source in the local database")
    p.add_argument("--sources", default="",
                   help="comma-separated adapter names (default: all ready ones)")
    p.add_argument("--all", action="store_true",
                   help="run every adapter whose key is filled in")
    p.add_argument("--symbols", default="",
                   help="comma-separated tickers, e.g. RELIANCE,TCS "
                        "(falls back to DEFAULT_SYMBOLS in .env)")
    p.add_argument("--query", default="",
                   help="free-text query for breadth sources "
                        "(falls back to DEFAULT_QUERY in .env)")
    p.add_argument("--days", type=int, default=1,
                   help="look-back window in days (default 1)")
    p.add_argument("--limit", type=int, default=50,
                   help="max articles per source per run (default 50)")
    p.add_argument("--dry-run", action="store_true",
                   help="fetch and report, but write nothing to disk")
    p.add_argument("-v", "--verbose", action="store_true")
    p.add_argument("--json", action="store_true",
                   help="emit machine-readable JSON (use with --list)")
    args = p.parse_args(argv)

    setup_logging(args.verbose)

    args.symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()] \
        or env_list("DEFAULT_SYMBOLS")
    args.query = args.query or env("DEFAULT_QUERY")

    if args.list or args.check:
        print_catalogue(registry, as_json=args.json)
        if args.check:
            ready = sum(1 for n in registry
                        if not registry[n].env_key or env(registry[n].env_key))
            if not args.json:
                print(f"{ready} of {len(registry)} adapters ready.")
            return 0 if ready else 1
        return 0

    if args.stats:
        store = Store()
        rows = store.counts_by_source()
        if not rows:
            print("No articles stored yet.")
        else:
            print(f"\n{'SOURCE':<16} ROWS")
            print("-" * 28)
            for src, n in rows:
                print(f"{src:<16} {n}")
            print(f"{'TOTAL':<16} {sum(n for _, n in rows)}\n")
        store.close()
        return 0

    if args.sources:
        wanted = [s.strip() for s in args.sources.split(",") if s.strip()]
        unknown = [w for w in wanted if w not in registry]
        if unknown:
            print(f"Unknown source(s): {', '.join(unknown)}", file=sys.stderr)
            print(f"Available: {', '.join(ordered_names(registry))}", file=sys.stderr)
            return 2
    else:
        wanted = ordered_names(registry)

    store = Store()
    total_fetched = total_new = 0
    log.info("Running %d source(s) | symbols=%s | days=%d | limit=%d%s",
             len(wanted), ",".join(args.symbols) or "-", args.days, args.limit,
             " | DRY RUN" if args.dry_run else "")
    print("-" * 70, file=sys.stderr)

    for name in wanted:
        fetched, new = run_source(registry[name], store, args)
        total_fetched += fetched
        total_new += new

    print("-" * 70, file=sys.stderr)
    log.info("Done. %d fetched, %d new rows stored.", total_fetched, total_new)
    if not args.dry_run:
        log.info("Database: %s", store.db_path)
    store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
