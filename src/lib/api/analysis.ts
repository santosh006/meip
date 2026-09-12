// lib/api/analysis.ts

export interface ImpactRecord {
  id: string;
  canonical_event_id: string;
  event_type: string;
  event_subtype: string;
  event_status: string;
  causal_channel: string;
  direction: "positive" | "negative" | "mixed" | "uncertain";
  time_horizon: "immediate" | "short_term" | "medium_term" | "long_term";
  materiality_tier: "low" | "medium" | "high" | "critical";
  confidence_score: number;
  evidence_excerpts: string[];
  applied_rule_ids: string[];
  analyst_review_status: string;
  analyst_rationale?: string;
  created_at: string;
  updated_at: string;
}

export interface StockAnalysis {
  symbol: string;
  company_name: string;
  isin: string;
  sector: string;
  impact_records: ImpactRecord[];
}

// ─── API call — swap base URL or implementation without touching components ───

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export async function fetchStockAnalysis(symbol: string): Promise<StockAnalysis> {
  const res = await fetch(`${API_BASE}/analysis/${encodeURIComponent(symbol)}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch analysis for ${symbol}: ${res.statusText}`);
  }

  return res.json();
}
