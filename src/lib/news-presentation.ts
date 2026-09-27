import type { Json } from './database.types';
export function reportedTickers(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
}
export function safeSourceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
