'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SourceOption = {
  key: string;
  label: string;
  description?: string;
  ready: boolean;
  reason?: string;
};

/**
 * Matches the `Article` shape returned by /api/news/preview
 * (see src/lib/newsdb.ts): {id, dedupe_key, source, title, url,
 * published_at, tickers}. There is no headline/datetime/summary/image/
 * category field on this API — the old client-side type assumed fields
 * the backend never sends.
 */
type PreviewArticle = import('@/lib/newsdb').Article;

type Decision = 'accept' | 'reject';

type ItemState =
  | { kind: 'idle' }
  | { kind: 'prompting'; decision: Decision }
  | { kind: 'submitting'; decision: Decision }
  | { kind: 'error'; decision: Decision; message: string };

type ReviewItem = {
  id: string;
  source: string;
  title: string;
  url: string | null;
  publishedAt: string | null;
  tickers: string[];
  state: ItemState;
  reasonDraft: string;
};

type IngestWarning = {
  source: string;
  status: string | null;
  message: string | null;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatPublishedDate(iso: string | null): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function parseTickers(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function toReviewItem(a: PreviewArticle): ReviewItem {
  return {
    id: a.id,
    source: a.source,
    title: a.title,
    url: a.url,
    publishedAt: a.published_at,
    tickers: parseTickers(a.tickers),
    state: { kind: 'idle' },
    reasonDraft: '',
  };
}

/**
 * The /api/news/sources route may return either a bare array or
 * { sources: [...] }, and adapter entries may use key / name / id.
 * Normalise all of that into one predictable shape.
 */
function normalizeSources(payload: unknown): SourceOption[] {
  const raw: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { sources?: unknown } | null)?.sources)
      ? (payload as { sources: unknown[] }).sources
      : [];

  return raw.flatMap<SourceOption>((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const key = String(item.key ?? item.name ?? item.id ?? '').trim();
    if (!key) return [];

    return [
      {
        key,
        label: String(item.label ?? item.title ?? key),
        description: item.description ? String(item.description) : undefined,
        ready: item.ready === undefined ? true : Boolean(item.ready),
        reason: item.reason ? String(item.reason) : undefined,
      },
    ];
  });
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === 'string' ? data.error : fallback;
  } catch {
    return fallback;
  }
}

function activeDecisionOf(state: ItemState): Decision | null {
  return state.kind === 'idle' ? null : state.decision;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function NewsIngestionClient() {
  // Search form (controls what gets ingested by "Fetch")
  const [draftArticles, setDraftArticles] = useState<Set<string>>(new Set());
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/news/reviews', { signal: controller.signal, cache: 'no-store' })
      .then(async response => response.ok ? response.json() : [])
      .then(rows => setDraftArticles(new Set(Array.isArray(rows) ? rows.map((row: {article: string}) => row.article) : [])))
      .catch(() => { /* Review page provides actionable authorization/setup errors. */ });
    return () => controller.abort();
  }, []);
  const [ticker, setTicker] = useState('');
  const [days, setDays] = useState(30);

  // The review queue: every unreviewed article in the DB, regardless of
  // which ticker/source it came from. This is loaded independently of the
  // search form so it survives a page refresh instead of starting empty.
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [queueError, setQueueError] = useState('');

  // Fetch button (ingest) state
  const [isIngesting, setIsIngesting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [ingestWarnings, setIngestWarnings] = useState<IngestWarning[]>([]);
  const [lastIngestCount, setLastIngestCount] = useState<number | null>(null);

  // Adapter catalogue
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [sourcesError, setSourcesError] = useState('');

  /* ------------------- Load adapter catalogue ------------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/news/sources', { cache: 'no-store' });

        if (!res.ok) {
          throw new Error(
            await readError(res, 'Unable to load NewsLoader sources.'),
          );
        }

        const list = normalizeSources(await res.json());
        if (cancelled) return;

        setSources(list);

        const firstReady = list.find((s) => s.ready) ?? list[0];
        if (firstReady) setSelectedKey(firstReady.key);
      } catch (error) {
        if (!cancelled) {
          setSourcesError(
            error instanceof Error ? error.message : 'Unable to load sources.',
          );
        }
      } finally {
        if (!cancelled) setIsLoadingSources(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSource = useMemo(
    () => sources.find((s) => s.key === selectedKey),
    [sources, selectedKey],
  );

  /* ------------------- Local state helpers ------------------- */

  const patchItem = useCallback((id: string, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const startReview = useCallback(
    (item: ReviewItem, decision: Decision) => {
      patchItem(item.id, {
        state: { kind: 'prompting', decision },
        reasonDraft: '',
      });
    },
    [patchItem],
  );

  const cancelReview = useCallback(
    (item: ReviewItem) => {
      patchItem(item.id, { state: { kind: 'idle' }, reasonDraft: '' });
    },
    [patchItem],
  );

  /* ------------------- Load the full pending-review queue ------------------- */

  const loadQueue = useCallback(async () => {
    try {
      // No ticker/source filter: this is the whole "awaiting decision"
      // queue, not scoped to whatever was last searched.
      const params = new URLSearchParams({ limit: '50', offset: String(offset) });
      const res = await fetch(`/api/news/preview?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(await readError(res, 'Failed to load unreviewed articles.'));
      }

      const data = await res.json();
      const fetched: PreviewArticle[] = Array.isArray(data.articles)
        ? data.articles
        : [];

      setItems(fetched.map(toReviewItem));
      setHasMore(data.hasMore === true);
      setQueueError('');
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : 'Failed to load unreviewed articles.',
      );
    } finally {
      setIsQueueLoading(false);
      setQueueLoaded(true);
    }
  }, [offset]);

  // Populate the queue as soon as the page loads, so a refresh shows
  // whatever is still pending instead of starting from an empty list.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/news/preview?limit=50&offset=${offset}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error(await readError(res, 'Unable to load queue')); return res.json(); })
      .then(data => { setItems((data.articles as PreviewArticle[]).map(toReviewItem)); setHasMore(data.hasMore === true); setQueueError(''); })
      .catch(error => { if (error.name !== 'AbortError') setQueueError(error.message); })
      .finally(() => { if (!controller.signal.aborted) { setIsQueueLoading(false); setQueueLoaded(true); } });
    return () => controller.abort();
  }, [offset]);

  /* ------------------- Fetch = ingest, then reload the queue ------------------- */

  async function handleFetchNews(event: FormEvent) {
    event.preventDefault();

    const symbol = ticker.trim().toUpperCase();

    if (!symbol) {
      setPageError('Enter a ticker symbol.');
      return;
    }
    if (!selectedKey) {
      setPageError('Select a news source.');
      return;
    }
    if (selectedSource && !selectedSource.ready) {
      setPageError(selectedSource.reason ?? 'This source is not ready.');
      return;
    }

    setIsIngesting(true);
    setPageError('');
    setIngestWarnings([]);
    setLastIngestCount(null);

    try {
      const ingestRes = await fetch('/api/news/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: symbol,
          sources: [selectedKey],
          days,
          limit: 50,
        }),
      });

      const ingestData = await ingestRes.json().catch(() => ({}));

      if (!ingestRes.ok || ingestData?.success === false) {
        throw new Error(
          typeof ingestData?.error === 'string'
            ? ingestData.error
            : 'Ingestion failed.',
        );
      }

      setJobId(ingestData.jobId);
      setJobStatus('queued');
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : 'Failed to fetch news.',
      );
      setIsIngesting(false);
    }

    // Whether or not ingest succeeded, refresh the full pending queue —
    // newly ingested articles (if any) join the rest of what's awaiting
    // review, across every ticker/source, not just the one just searched.
    await loadQueue();
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const res = await fetch(`/api/news/ingest${jobId ? `?id=${jobId}` : ''}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error(await readError(res, 'Unable to check ingestion progress.'));
        const { job } = await res.json();
        if (cancelled || !job) return;
        setJobStatus(job.status);
        const running = job.status === 'queued' || job.status === 'running';
        setIsIngesting(running);
        if (running) { timer = setTimeout(poll, 2000); return; }
        setLastIngestCount(job.result?.articlesNew ?? null);
        setIngestWarnings(job.result?.warnings ?? []);
        if (job.status === 'failed') setPageError(job.result?.error ?? 'Ingestion failed.');
        await loadQueue();
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : 'Unable to check ingestion progress.');
          timer = setTimeout(poll, 5000);
        }
      }
    }
    void poll();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [jobId, loadQueue]);

  /* ------------------- Submit a decision ------------------- */

  async function submitDecision(item: ReviewItem, decision: Decision) {
    const reason = item.reasonDraft.trim();

    if (!reason) {
      patchItem(item.id, {
        state: { kind: 'error', decision, message: 'A reason is required.' },
      });
      return;
    }

    patchItem(item.id, { state: { kind: 'submitting', decision } });

    const endpoint =
      decision === 'accept' ? '/api/news/accept' : '/api/news/reject';

    // The search box controls fetching only; it must never create a ticker
    // relationship on an unrelated article. The server uses article mappings.
    const body = { articleId: item.id, reason };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok !== true) {
        const baseMessage =
          typeof data?.error === 'string'
            ? data.error
            : `Failed to ${decision} this article.`;
        // The API includes the underlying Supabase/Postgres error as
        // `detail` (see /api/news/accept's upsertError.message) — surface
        // it, since the generic `error` string alone isn't actionable.
        const detail = typeof data?.detail === 'string' ? data.detail : '';
        throw new Error(detail ? `${baseMessage}: ${detail}` : baseMessage);
      }

      // Article is now reviewed (accepted/rejected) — drop it from the list
      // immediately. If the backend flagged a non-fatal cleanup warning
      // (e.g. accept saved to Supabase but local tombstone failed), still
      // remove it from view but surface the warning at the page level.
      if (data.warning) {
        setPageError(String(data.warning));
      }
      removeItem(item.id);
    } catch (error) {
      patchItem(item.id, {
        state: {
          kind: 'error',
          decision,
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected error occurred.',
        },
      });
    }
  }

  const [isCustom, setIsCustom] = useState<boolean>(false);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      setDays(Number(val));
    }
  };

  const fetchButtonLabel = isIngesting
    ? 'Fetching…'
    : isQueueLoading
      ? 'Loading list…'
      : 'Fetch';

  /* ------------------- Render ------------------- */

  return (
    <section className="w-full">
      {jobStatus && <p role="status" className="mb-4 text-sm">Ingestion: {jobStatus}{jobStatus === 'queued' ? ' — waiting for the worker' : ''}</p>}
      <nav aria-label="Review queue pages" className="flex gap-4 mb-4">
        <button disabled={offset === 0 || isQueueLoading} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
        <span>Queue page {Math.floor(offset / 50) + 1}</span>
        <button disabled={!hasMore || isQueueLoading} onClick={() => setOffset(offset + 50)}>Next</button>
      </nav>
      {/* ---------- Search form ---------- */}
      <form onSubmit={handleFetchNews} className="mb-6">
        <div className="flex flex-wrap gap-2">


          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Ticker (e.g. SBIN)"
            aria-label="Ticker symbol"
            className="min-w-[160px] flex-1 rounded border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm text-white placeholder:text-[#6e7681] focus:border-[#388bfd] focus:outline-none"
          />

          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            disabled={isLoadingSources || sources.length === 0}
            aria-label="News source"
            className="rounded border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm text-white focus:border-[#388bfd] focus:outline-none disabled:opacity-50"
          >
            {isLoadingSources && <option value="">Loading sources…</option>}
            {!isLoadingSources && sources.length === 0 && (
              <option value="">No sources available</option>
            )}
            {sources.map((s) => (
              <option key={s.key} value={s.key} disabled={!s.ready}>
                {s.label}
                {s.ready ? '' : ' (unavailable)'}
              </option>
            ))}
          </select>

          <select
            value={isCustom ? 'custom' : days}
            onChange={handleSelectChange}
            aria-label="Date range"
            className="rounded border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm text-white focus:border-[#388bfd] focus:outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
            <option value="custom">Custom...</option>
          </select>

          {isCustom && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                value={days || ''}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
                placeholder="Days"
                className="w-20 rounded border border-[#2b333d] bg-[#161b22] px-3 py-2 text-sm text-white focus:border-[#388bfd] focus:outline-none"
              />
              <span className="text-xs text-[#9aa7b4]">days</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isIngesting || isQueueLoading || isLoadingSources}
            className="rounded bg-[#238636] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fetchButtonLabel}
          </button>
        </div>

        {selectedSource?.description && (
          <p className="mt-2 text-xs text-[#8b949e]">
            {selectedSource.description}
          </p>
        )}
      </form>

      {/* ---------- Banners ---------- */}
      {sourcesError && (
        <div className="mb-4 rounded border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-sm text-[#ff7b72]">
          {sourcesError}
        </div>
      )}

      {pageError && (
        <div className="mb-4 rounded border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-sm text-[#ff7b72]">
          {pageError}
        </div>
      )}

      {queueError && (
        <div className="mb-4 rounded border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-sm text-[#ff7b72]">
          {queueError}
        </div>
      )}

      {ingestWarnings.length > 0 && (
        <div className="mb-4 rounded border border-[#e3b341]/40 bg-[#e3b341]/10 px-3 py-2 text-sm text-[#e3b341]">
          <p className="font-medium">Some sources had trouble during this fetch:</p>
          <ul className="mt-1 list-disc pl-5">
            {ingestWarnings.map((w, idx) => (
              <li key={`${w.source}-${idx}`}>
                {w.source}: {w.message || w.status || 'unknown error'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Summary line ---------- */}
      {queueLoaded && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8b949e]">
          <span>
            {lastIngestCount !== null && (
              <>{lastIngestCount} new article{lastIngestCount === 1 ? '' : 's'} ingested · </>
            )}
            {items.length} awaiting review
          </span>
          <button
            type="button"
            onClick={() => loadQueue()}
            disabled={isQueueLoading}
            className="text-[#58a6ff] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isQueueLoading ? 'Refreshing…' : 'Refresh list'}
          </button>
        </div>
      )}

      {/* ---------- Empty state ---------- */}
      {queueLoaded && items.length === 0 && !isQueueLoading && !queueError && (
        <div className="rounded border border-[#2b333d] bg-[#0d1117] px-4 py-8 text-center text-sm text-[#8b949e]">
          No articles awaiting review right now.
        </div>
      )}

      {/* ---------- Article list ---------- */}
      <ul className="space-y-3">
        {items.map((item) => {
          const { state } = item;
          const decision = activeDecisionOf(state);
          const isIdle = state.kind === 'idle';
          const isPrompting = state.kind === 'prompting';
          const isSubmitting = state.kind === 'submitting';
          const isError = state.kind === 'error';

          return (
            <li
              key={item.id}
              className="rounded border border-[#2b333d] bg-[#0d1117] px-4 py-3 transition"
            >
              {/* Headline + meta */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-white">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#58a6ff] hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>

                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8b949e]">
                    <span>{formatPublishedDate(item.publishedAt)}</span>
                    <span>· {item.source}</span>
                    {item.tickers.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-[#2b333d] px-2 py-0.5 text-[10px] uppercase text-[#8b949e]"
                      >
                        {t}
                      </span>
                    ))}
                  </p>
                </div>
              </div>

              {/* Accept / Reject buttons */}
              {isIdle && (
                <div className="mt-3 flex gap-2">
                  <Link href={`/app/news-review/${encodeURIComponent(item.id)}`} className="rounded border border-green-700 px-3 py-1.5 text-xs text-green-300">{draftArticles.has(item.id) ? 'Resume draft' : 'Review / Accept'}</Link>
                  <button
                    type="button"
                    onClick={() => startReview(item, 'reject')}
                    className="rounded border border-[#f85149]/50 px-3 py-1.5 text-xs font-medium text-[#ff7b72] transition hover:bg-[#f85149]/10"
                  >
                    Reject
                  </button>
                </div>
              )}

              {/* Reason capture */}
              {(isPrompting || isSubmitting) && decision && (
                <div className="mt-3 rounded border border-[#2b333d] bg-[#161b22] p-3">
                  <label
                    htmlFor={`reason-${item.id}`}
                    className="mb-1.5 block text-xs font-medium text-[#c9d1d9]"
                  >
                    Reason for{' '}
                    {decision === 'accept' ? 'accepting' : 'rejecting'}
                    <span className="text-[#ff7b72]"> *</span>
                  </label>

                  <textarea
                    id={`reason-${item.id}`}
                    value={item.reasonDraft}
                    onChange={(e) =>
                      patchItem(item.id, { reasonDraft: e.target.value })
                    }
                    disabled={isSubmitting}
                    rows={2}
                    autoFocus
                    placeholder={
                      decision === 'accept'
                        ? 'e.g. Material impact on Q3 margins'
                        : 'e.g. Duplicate coverage / not material'
                    }
                    className="w-full resize-y rounded border border-[#2b333d] bg-[#0d1117] px-2.5 py-2 text-sm text-white placeholder:text-[#6e7681] focus:border-[#388bfd] focus:outline-none disabled:opacity-50"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => submitDecision(item, decision)}
                      disabled={isSubmitting || !item.reasonDraft.trim()}
                      className={`rounded px-3 py-1.5 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        decision === 'accept'
                          ? 'bg-[#238636] hover:bg-[#2ea043]'
                          : 'bg-[#da3633] hover:bg-[#f85149]'
                      }`}
                    >
                      {isSubmitting
                        ? 'Saving…'
                        : decision === 'accept'
                          ? 'Confirm accept'
                          : 'Confirm reject'}
                    </button>

                    <button
                      type="button"
                      onClick={() => cancelReview(item)}
                      disabled={isSubmitting}
                      className="rounded border border-[#2b333d] px-3 py-1.5 text-xs text-[#8b949e] transition hover:text-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>

                  <p className="mt-2 text-[11px] text-[#8b949e]">
                    {decision === 'accept'
                      ? 'Acceptance now requires the structured review page.'
                      : 'Rejecting hides this article from future previews and removes it from this list.'}
                  </p>
                </div>
              )}

              {/* Error */}
              {isError && (
                <div className="mt-3 rounded border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2">
                  <p className="text-xs text-[#ff7b72]">{state.message}</p>
                  <button
                    type="button"
                    onClick={() => startReview(item, state.decision)}
                    className="mt-1.5 text-xs text-[#58a6ff] hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}