export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Expected a JSON object');
  return value as Record<string, unknown>;
}
export function text(value: unknown, name: string, max = 200, required = false): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new InputError(`${name} must be a non-empty string of at most ${max} characters`);
  return value.trim();
}
export function integer(value: unknown, name: string, fallback: number, max: number, min = 1): number {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < min || n > max) throw new InputError(`${name} must be an integer from ${min} to ${max}`);
  return n;
}
export function choice(value: unknown, name: string, choices: readonly string[]): string | undefined {
  const v = text(value, name);
  if (v !== undefined && !choices.includes(v)) throw new InputError(`Invalid ${name}`);
  return v;
}
export function uuid(value: unknown, name: string): string | undefined {
  const v = text(value, name);
  if (v && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new InputError(`Invalid ${name}`);
  return v;
}
export function ticker(value: unknown, required = false): string | undefined {
  const v = text(value, 'ticker', 32, required)?.toUpperCase();
  if (v && !/^[A-Z0-9][A-Z0-9.&_-]*$/.test(v)) throw new InputError('Invalid ticker');
  return v;
}
export function reviewBody(value: unknown, decision: 'accepted' | 'rejected') {
  const b = object(value);
  const articleId = text(b.articleId, 'articleId', 64, true)!;
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(articleId)) throw new InputError('Invalid articleId');
  const confidence = b.confidence;
  if (confidence !== undefined && (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) throw new InputError('confidence must be between 0 and 1');
  return {
    articleId, ticker: ticker(b.ticker ?? undefined), company: text(b.company, 'company'),
    summary: text(b.summary, 'summary', 10000), reason: text(b.reason, 'reason', 2000, decision === 'rejected'),
    direction: choice(b.direction, 'direction', ['positive','negative','neutral','mixed','uncertain']),
    materiality: choice(b.materiality, 'materiality', ['low','medium','high','critical']),
    horizon: choice(b.horizon, 'horizon', ['immediate','short','short_term','medium_term','long_term']),
    eventStatus: choice(b.eventStatus, 'eventStatus', ['reported','analyzed','confirmed','rumored','resolved']),
    sector: text(b.sector, 'sector'), eventType: text(b.eventType, 'eventType'),
    eventId: uuid(b.eventId, 'eventId'), confidence: confidence as number | undefined,
  };
}
export function ingestBody(value: unknown) {
  const b = object(value);
  const sources = b.sources ?? [];
  if (!Array.isArray(sources) || sources.length > 20 || sources.some(s => typeof s !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(s))) throw new InputError('Invalid sources');
  return { ticker: ticker(b.ticker, true)!, sources: sources as string[], days: integer(b.days, 'days', 1, 30), limit: integer(b.limit, 'limit', 50, 200) };
}
