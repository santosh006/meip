import { createSupabaseServer } from '@/lib/supabase-server';
import { scoreEvent } from './index';
import type { RawEvent } from './index';

export type IngestEvent = RawEvent & {
  company?: string;
  security?: string;
  entityId?: string;
  sourceId?: string;
  sourceUrl?: string;
  occurredAt: string;
  eventStatus?: string;
  horizon?: string;
  materiality?: string;
  evidenceUrl?: string;
};

export async function ingestAndScore(input: IngestEvent) {
  const supabase = await createSupabaseServer();
  const scored = scoreEvent(input);

  // Both writes run in one database transaction and retain UUID relationships.
  const { data, error } = await supabase.rpc('ingest_scored_event', {
    event_data: {
      entity_id: input.entityId ?? null, title: input.title, event_type: input.eventType,
      occurred_at: input.occurredAt, impact_score: scored.impactScore,
      impact_direction: scored.direction, confidence: scored.confidence,
      significance: scored.significance, rationale: scored.rationale,
      affected_metrics: scored.affectedMetrics, source_id: input.sourceId ?? null, source_url: input.sourceUrl ?? null,
    },
    impact_data: {
      company: input.company ?? input.title, security: input.security ?? null,
      sector: input.sector ?? null, event_status: input.eventStatus ?? 'analyzed',
      horizon: input.horizon ?? null, materiality: input.materiality ?? scored.significance,
      evidence_url: input.evidenceUrl ?? input.sourceUrl ?? null,
    },
  });
  if (error) throw error;
  const result = data as { event: import('@/lib/database.types').Tables<'events'>; impactRecord: import('@/lib/database.types').Tables<'impact_records'> };
  return { ...result, scored };
}
