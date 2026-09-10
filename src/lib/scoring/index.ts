export type EventType =
  | 'earnings' | 'ma' | 'regulatory' | 'product' | 'leadership' | 'macro';

export type Direction = 'positive' | 'negative' | 'mixed' | 'neutral';
export type Significance = 'low' | 'medium' | 'high' | 'critical';

export interface RawEvent {
  title: string;
  eventType: EventType;
  sector?: string;
  metrics?: Record<string, '+' | '-' | 'flat'>; // e.g. { revenue: '+', margin: '-' }
  sourceCredibility?: number;                    // 0..1
}

export interface ScoredEvent {
  impactScore: number;      // -100..100
  direction: Direction;
  confidence: number;       // 0..1
  significance: Significance;
  rationale: string;
  affectedMetrics: Record<string, '+' | '-' | 'flat'>;
}

// ── Rule tables (tune these freely) ──
const BASE_WEIGHT: Record<EventType, number> = {
  ma:         70,   // M&A tends to be high-impact
  regulatory: 60,
  earnings:   50,
  leadership: 40,
  product:    35,
  macro:      45,
};

const SECTOR_MULTIPLIER: Record<string, number> = {
  finance:    1.2,
  tech:       1.1,
  energy:     1.1,
  healthcare: 1.0,
  default:    1.0,
};

const METRIC_SIGN: Record<'+' | '-' | 'flat', number> = {
  '+': 1, '-': -1, flat: 0,
};

function significanceFrom(absScore: number): Significance {
  if (absScore >= 75) return 'critical';
  if (absScore >= 50) return 'high';
  if (absScore >= 25) return 'medium';
  return 'low';
}

export function scoreEvent(e: RawEvent): ScoredEvent {
  const reasons: string[] = [];

  // 1. base magnitude from event type
  const base = BASE_WEIGHT[e.eventType];
  reasons.push(`${e.eventType} baseline impact ${base}`);

  // 2. sector adjustment
  const mult = SECTOR_MULTIPLIER[e.sector ?? 'default'] ?? SECTOR_MULTIPLIER.default;
  if (mult !== 1) reasons.push(`sector "${e.sector}" x${mult}`);

  // 3. direction from metrics
  const metrics = e.metrics ?? {};
  const signs = Object.values(metrics).map((m) => METRIC_SIGN[m]);
  const net = signs.reduce((a, b) => a + b, 0);

  let direction: Direction = 'neutral';
  if (signs.length) {
    const hasPos = signs.some((s) => s > 0);
    const hasNeg = signs.some((s) => s < 0);
    if (hasPos && hasNeg) direction = 'mixed';
    else if (net > 0)     direction = 'positive';
    else if (net < 0)     direction = 'negative';
  }
  if (Object.keys(metrics).length)
    reasons.push(`metrics ${JSON.stringify(metrics)} → ${direction}`);

  // 4. signed magnitude, clamped to -100..100
  const magnitude = Math.min(100, base * mult);
  const sign = direction === 'negative' ? -1
             : direction === 'positive' ? 1
             : direction === 'mixed'    ? 0.5   // dampened, still notable
             : 0.75;                            // neutral-but-meaningful event
  const impactScore = Math.round(magnitude * sign);

  // 5. confidence from source credibility + metric completeness
  const cred = e.sourceCredibility ?? 0.5;
  const completeness = Object.keys(metrics).length ? 0.2 : 0;
  const confidence = Math.min(1, +(0.5 * cred + 0.3 + completeness).toFixed(2));
  reasons.push(`confidence from source ${cred} + metrics`);

  const significance = significanceFrom(Math.abs(impactScore));

  return {
    impactScore,
    direction,
    confidence,
    significance,
    affectedMetrics: metrics,
    // deterministic rationale now; LLM will rewrite this string later
    rationale: reasons.join('; ') + '.',
  };
}
