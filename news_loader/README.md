# Stock–News Ingestion Pipeline (India first)

Pulls stock-relevant news and regulatory disclosures from 17 sources into one
normalised SQLite table, with an append-only raw archive alongside it.

**Only sources with a genuine self-serve free tier are included.** Benzinga /
Polygon, Tickerplant, TrueData, Global Datafeeds, MarketMaker.in and the Apify
NSE/BSE scraper were all left out — none of them lets you start without a sales
conversation or a paid plan.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then fill in the keys you have
python main.py --list     # shows which adapters are ready
```

Every API key in `.env` ships blank. **Any source whose key is still blank is
skipped automatically** — you do not have to comment anything out. The six
keyless sources (NSE, BSE, SEBI, RBI, PIB, GDELT) work immediately.

## Usage

```bash
python main.py --list                              # catalogue + key status
python main.py --check                             # exit 1 if nothing is ready
python main.py --sources nse,bse,gdelt             # run specific adapters
python main.py --symbols RELIANCE,TCS --days 2     # all ready adapters
python main.py --dry-run -v                        # fetch, print, write nothing
python main.py --stats                             # row counts per source
```

Flags: `--sources` `--symbols` `--query` `--days` `--limit` `--dry-run`
`--verbose` `--list` `--check` `--stats`.

## Layout

```
main.py            orchestrator + CLI
registry.py        auto-discovers adapters, no hard-coded list
base.py            HTTP session, retry/backoff, rate limiting, key handling
models.py          Article dataclass + timestamp normalisation
storage.py         SQLite schema, dedupe, raw JSONL archive, run log
config.py          .env loader (no third-party dependency)
sources/
  nse.py bse.py sebi.py rbi.py pib.py      India primary — keyless
  gdelt.py                                 global macro — keyless
  indianapi.py bharatstock.py              India vendors — free tier
  eodhd.py marketaux.py alphavantage.py finnhub.py   ticker-tagged + sentiment
  newsdata.py thenewsapi.py gnews.py mediastack.py newsapi_org.py   breadth
```

Adding a source: drop a module in `sources/` exposing a class named `Source`
that subclasses `BaseSource` and implements `fetch()`. The registry finds it.

## Data model

Two layers, on purpose:

1. `data/raw/<source>/<YYYY-MM-DD>.jsonl` — every payload exactly as received,
   never rewritten. This is what protects point-in-time integrity when a
   publisher silently edits or back-dates an article.
2. `data/news.sqlite` — the normalised, de-duplicated table you query.

`published_at` and `fetched_at` are stored separately and never conflated.
Existing rows are never overwritten on re-ingest, so an edited headline cannot
retroactively mutate history a backtest already consumed.

Tables: `articles`, `article_tickers` (for ticker joins), `run_log`.

## Free-tier limits baked into the adapters

| Adapter | Free tier | Articles/request | Watch out for |
|---|---|---|---|
| nse, bse, sebi, rbi, pib | free, keyless | full listing | scraping, not an API |
| gdelt | free, keyless | 250 | 1 req / 5s, 3-month window |
| marketaux | 100 req/day | **3** | payload cap, not request cap |
| alphavantage | 25 req/day | up to 1000 | thin non-US coverage |
| finnhub | 60 calls/min | varies | **non-commercial**, US-only sentiment |
| eodhd | 20 calls/day | up to 1000 | news costs **5 calls** per request |
| newsdata | 200 credits/day | 10 | 12h delay, no full text on free |
| thenewsapi | 100 req/day | **3** | no sentiment or tickers |
| gnews | 100 req/day | 10 | **non-commercial**, 12h delay |
| mediastack | 100 calls/**month** | 100 | HTTP only, evaluation key really |
| newsapi_org | 100 req/day | 100 | **development use only** |
| indianapi | free tier | per-company | base URL must match your plan |
| bharatstock | free plan | 50 tickers | end-of-day only |

Licensing, not price, is what will limit you. Three of these forbid commercial
use on the free tier. Read them before you ship a user-facing feed.

## Known rough edges

The five `[fragile]` adapters (NSE, BSE, SEBI, RBI, PIB) scrape HTML or
undocumented front-end JSON. They were written against the published structure
of those sites but **could not be executed against the live endpoints** during
development, so expect to adjust them on first run:

- **NSE** needs a cookie warm-up (handled) and blocks datacentre IPs
  aggressively. On a cloud host you may need a residential proxy.
- **BSE** parameter names in `AnnSubCategoryGetData` shift occasionally.
- **SEBI** uses `sid`/`ssid` section IDs — confirm them in your browser's
  network tab if a section returns nothing.
- **RBI** has changed its CMS and feed URLs before; feed failures are logged
  and skipped rather than aborting the run.
- **PIB** selectors are deliberately broad; tighten them once you see real HTML.

A failing adapter never stops the run — errors land in `run_log` and the rest
continues.

## What to build next

The pipeline stops at ingestion. The two pieces that matter most before you can
correlate anything:

1. **An ISIN-keyed symbol mapping table.** "HDFC Bank", "HDFCBANK",
   "HDFCBANK.NSE" and each vendor's own identifier are different strings for
   one company. Seed it from the exchange master list and route every adapter's
   tickers through it.
2. **The point-in-time join** from `articles.published_at` to intraday price
   bars, with an explicit decision about how you handle news published outside
   market hours.
