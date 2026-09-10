import { createSupabaseServer } from '@/lib/supabase-server';
import { scoreEvent, RawEvent } from './index';

export async function ingestAndScore(input: RawEvent & {
  entityId?: string;
  sourceId?: string;
  sourceUrl?: string;
  occurredAt: string;
}) {
  const supabase = await createSupabaseServer();
  const scored = scoreEvent(input);

  // 1. write the event with its analysis
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

  // 2. mirror into impact_records (the Analysis view reads this)
  const { error: irErr } = await supabase
  .from('impact_records')
  .insert({
    event_id: event.id,
    entity_id: input.entityId ?? null,
    headline: input.title,
    impact_score: scored.impactScore,
    direction: scored.direction,
    significance: scored.significance,
    confidence: scored.confidence,
    rationale: scored.rationale,
    metrics: scored.affectedMetrics,
    occurred_at: input.occurredAt,
  });

  if (irErr) throw irErr;
  return { event, scored };
}
