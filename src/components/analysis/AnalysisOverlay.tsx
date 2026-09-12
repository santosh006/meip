// components/analysis/AnalysisOverlay.tsx
"use client";

import React, { useEffect, useState } from "react";
import { fetchStockAnalysis, StockAnalysis, ImpactRecord } from "@/lib/api/analysis";

interface AnalysisOverlayProps {
  symbol: string | null;
  onClose: () => void;
}

type ViewMode = "overlay" | "fullpage";

const DIRECTION_STYLES: Record<string, string> = {
  positive: "text-green-600 bg-green-50",
  negative: "text-red-600 bg-red-50",
  mixed: "text-yellow-600 bg-yellow-50",
  uncertain: "text-gray-500 bg-gray-100",
};

const MATERIALITY_STYLES: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-400 text-black",
  low: "bg-gray-200 text-gray-700",
};

export function ImpactRecordCard({ record }: { record: ImpactRecord }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-sm font-semibold text-gray-800">
          {record.event_type} — {record.event_subtype}
        </span>
        <div className="flex gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              DIRECTION_STYLES[record.direction] ?? ""
            }`}
          >
            {record.direction}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              MATERIALITY_STYLES[record.materiality_tier] ?? ""
            }`}
          >
            {record.materiality_tier}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
        <span><span className="font-medium">Channel:</span> {record.causal_channel}</span>
        <span><span className="font-medium">Horizon:</span> {record.time_horizon.replace("_", " ")}</span>
        <span><span className="font-medium">Status:</span> {record.event_status}</span>
        <span><span className="font-medium">Confidence:</span> {(record.confidence_score * 100).toFixed(0)}%</span>
      </div>

      {record.evidence_excerpts?.length > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 mb-2 italic border-l-2 border-gray-300">
          "{record.evidence_excerpts[0]}"
        </div>
      )}

      {record.analyst_rationale && (
        <div className="text-xs text-blue-700 bg-blue-50 rounded p-2">
          <span className="font-semibold">Analyst note:</span> {record.analyst_rationale}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-400">
        Rules: {record.applied_rule_ids.join(", ")} · Review: {record.analyst_review_status}
      </div>
    </div>
  );
}

function AnalysisContent({ data }: { data: StockAnalysis }) {
  return (
    <div>
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{data.sector}</p>
        <h2 className="text-xl font-bold text-gray-900">{data.company_name}</h2>
        <p className="text-sm text-gray-500">{data.symbol} · {data.isin}</p>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Impact Records ({data.impact_records.length})
        </h3>
      </div>

      {data.impact_records.length === 0 ? (
        <p className="text-sm text-gray-400 mt-4">No impact records found for this stock.</p>
      ) : (
        data.impact_records.map((record) => (
          <ImpactRecordCard key={record.id} record={record} />
        ))
      )}
    </div>
  );
}

export function AnalysisOverlay({ symbol, onClose }: AnalysisOverlayProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("overlay");
  const [data, setData] = useState<StockAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    setData(null);

    fetchStockAnalysis(symbol)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [symbol]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!symbol) return null;

  // ── Full Page Mode ──────────────────────────────────────────────────
  if (viewMode === "fullpage") {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setViewMode("overlay")}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              ← Back to overlay
            </button>
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              ✕ Close
            </button>
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading analysis…</p>}
          {error && <p className="text-red-500 text-sm">Error: {error}</p>}
          {data && <AnalysisContent data={data} />}
        </div>
      </div>
    );
  }

  // ── Overlay Mode ────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Overlay Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <span className="font-semibold text-gray-800">
            Analysis — {symbol}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode("fullpage")}
              className="text-xs text-blue-600 hover:underline"
              title="Expand to full page"
            >
              ⛶ Full page
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-sm text-gray-400 mt-8 text-center">
              Loading analysis…
            </p>
          )}
          {error && (
            <p className="text-sm text-red-500 mt-4">Error: {error}</p>
          )}
          {data && <AnalysisContent data={data} />}
        </div>
      </div>
    </>
  );
}
