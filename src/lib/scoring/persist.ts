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

  // Store the normalized event and its scoring result.
  const { data: event, error: evErr } = await supabase
    .from('events')
    .insert({
      entity_id: input.entityId ?? null,
      title: input.title,
      event_type: input.eventType,
      occurred_at: input.occurredAt,
      impact_score: scored.impactScore,
      impact_direction: scored.direction,
      confidence: scored.confidence,
      significance: scored.significance,
      rationale: scored.rationale,
      affected_metrics: scored.affectedMetrics,
      source_id: input.sourceId ?? null,
      source_url: input.sourceUrl ?? null,
    })
    .select()
    .single();

  if (evErr) throw evErr;

  // Mirror the result into the schema used by the customer-facing view.
  const { data: impactRecord, error: irErr } = await supabase
    .from('impact_records')
    .insert({
      company: input.company ?? input.title,
      security: input.security ?? null,
      sector: input.sector ?? null,
      event_type: input.eventType,
      direction: scored.direction,
      confidence: scored.confidence,
      event_status: input.eventStatus ?? 'analyzed',
      horizon: input.horizon ?? null,
      materiality: input.materiality ?? scored.significance,
      summary: scored.rationale,
      evidence_url: input.evidenceUrl ?? input.sourceUrl ?? null,
    })
    .select()
    .single();

  if (irErr) throw irErr;
  return { event, impactRecord, scored };
}
