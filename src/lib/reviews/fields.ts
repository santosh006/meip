export type Field = { label: string; kind?: 'text'|'textarea'|'number'|'date'|'datetime-local'|'url'; options?: readonly string[]; required?: boolean; min?: number; max?: number };
export type Fields = Record<string, Field>;
export const categories = ['earnings','guidance','ma','regulatory','litigation','product','leadership','capital_raising','macro','other'] as const;
export const directions = ['positive','negative','mixed','neutral','unknown'] as const;
export const magnitudes = ['low','medium','high','unknown'] as const;
const confidence: Field = {label:'Confidence (0–1; heuristic, not probability)',kind:'number',min:0,max:1,required:true};
export const verificationFields: Fields = {
 headline:{label:'Verified headline',required:true}, summary:{label:'Event summary',kind:'textarea',required:true}, acceptance_reason:{label:'Acceptance reason',kind:'textarea',required:true},
 category:{label:'Event category',options:categories,required:true}, verification_status:{label:'Verification status',options:['confirmed','partially_verified','unverified_claim','disputed'],required:true},
 source_classification:{label:'Source classification',required:true}, source_credibility:{...confidence,label:'Source credibility (0–1; optional heuristic)',required:false},
 occurrence_certainty:{label:'Occurrence time certainty',options:['exact','approximate','unknown'],required:true}, occurrence_at:{label:'Occurrence time (UTC)',kind:'datetime-local'},
 novelty:{label:'Novelty',options:['new','update','correction','repeated'],required:true}, related_event_id:{label:'Related existing event ID'}, concerns:{label:'Review concerns',kind:'textarea'}, additional_evidence:{label:'Additional evidence',kind:'textarea'},
};
export const evidenceFields: Fields = {label:{label:'Source title / label',required:true},url:{label:'Source URL (HTTP/HTTPS)',kind:'url'},classification:{label:'Source classification',required:true},excerpt:{label:'Quotation / excerpt',kind:'textarea'},document_ref:{label:'Document / page reference'}};
export const mappingFields: Fields = {
 entity_id:{label:'Canonical entity',required:true},entity_type:{label:'Entity type',options:['company','sector','industry','commodity','country','index','other'],required:true},security_id:{label:'Relevant security (optional)'},
 relationship:{label:'Relationship',options:['subject','acquirer','target','competitor','supplier','customer','lender','subsidiary','beneficiary','other'],required:true},exposure:{label:'Exposure',options:['direct','indirect'],required:true},
 transmission:{label:'Transmission mechanism',kind:'textarea',required:true},mapping_confidence:{...confidence,label:'Mapping confidence (0–1; heuristic)'},mapping_reason:{label:'Mapping evidence / reasoning',kind:'textarea',required:true},
 exposure_magnitude:{label:'Exposure magnitude (qualitative)'},exposure_value:{label:'Numeric exposure (optional)',kind:'number'},exposure_basis:{label:'Exposure units / basis'},
};
export const impactFields: Fields = {
 direction:{label:'Direction',options:directions,required:true},rationale:{label:'Impact rationale',kind:'textarea',required:true},metrics_status:{label:'Affected metrics',options:['specified','unknown'],required:true},
 magnitude:{label:'Expected magnitude',options:magnitudes,required:true},range_low:{label:'Magnitude range — low',kind:'number'},range_high:{label:'Magnitude range — high',kind:'number'},range_basis:{label:'Range units / supporting basis'},
 effect_type:{label:'Effect type',options:['fundamentals','sentiment','both'],required:true},impact_confidence:confidence,
 surprise:{label:'Versus expectations',options:['above','in_line','below','unknown'],required:true},expectations_evidence:{label:'Expectations evidence',kind:'textarea'},anticipated:{label:'Previously known / anticipated',options:['yes','no','unknown'],required:true},anticipated_evidence:{label:'Anticipation evidence',kind:'textarea'},
 assumptions:{label:'Material assumptions, or “none identified”',kind:'textarea',required:true},counterarguments:{label:'Counterarguments',kind:'textarea'},invalidation:{label:'Invalidation conditions',kind:'textarea'},quantitative_evidence:{label:'Quantitative evidence',kind:'textarea'},
};
export const metricFields: Fields = {
 name:{label:'Metric name',required:true},change:{label:'Observed / expected change',options:['increase','decrease','unchanged','mixed','unknown'],required:true},implication:{label:'Business implication',options:['beneficial','adverse','mixed','neutral','unknown'],required:true},
 value_low:{label:'Value / range low',kind:'number'},value_high:{label:'Range high',kind:'number'},unit:{label:'Unit / currency'},baseline:{label:'Comparison baseline'},period:{label:'Reporting / forecast period'},evidence_id:{label:'Evidence reference ID'},
};
export const horizonFields: Fields = {
 horizon:{label:'Horizon',required:true},onset:{label:'Expected onset'},duration:{label:'Expected duration'},direction:{label:'Direction',options:directions,required:true},magnitude:{label:'Magnitude',options:magnitudes,required:true},confidence,
 timing_rationale:{label:'Timing rationale',kind:'textarea',required:true},persistence:{label:'Persistence',options:['one_off','temporary','recurring','structural','unknown']},catalyst:{label:'Next catalyst'},catalyst_date:{label:'Catalyst date',kind:'date'},date_certainty:{label:'Catalyst date certainty',options:['exact','estimated','unknown']},review_date:{label:'Next review date',kind:'date',required:true},
};
export const advancedFields: Fields = {
 base:{label:'Base scenario',kind:'textarea'},upside:{label:'Upside scenario',kind:'textarea'},downside:{label:'Downside scenario',kind:'textarea'},scenario_assumptions:{label:'Scenario assumptions',kind:'textarea'},base_likelihood:{label:'Base likelihood (optional, 0–1)',kind:'number',min:0,max:1},upside_likelihood:{label:'Upside likelihood (optional, 0–1)',kind:'number',min:0,max:1},downside_likelihood:{label:'Downside likelihood (optional, 0–1)',kind:'number',min:0,max:1},dependencies:{label:'Dependencies',kind:'textarea'},second_order:{label:'Second-order effects',kind:'textarea'},monitoring:{label:'Monitoring indicators',kind:'textarea'},owner:{label:'Follow-up owner'},specialist:{label:'Specialist review',options:['yes','no']},
};
export const observationFields: Fields = {
 analysis_date:{label:'Analysis date',kind:'date',required:true},cutoff_at:{label:'Information cutoff (UTC)',kind:'datetime-local',required:true},entity_id:{label:'Canonical entity',required:true},security_id:{label:'Security (optional)'},session:{label:'Exchange / session'},assessment:{label:'Current assessment',kind:'textarea',required:true},mode:{label:'Assessment method',options:['recomputed','carried_forward'],required:true},revision_reason:{label:'Revision reason',kind:'textarea',required:true},new_evidence:{label:'New evidence',kind:'textarea'},related_events:{label:'Related event IDs (comma separated)'},price_return:{label:'Observed price return (%)',kind:'number'},benchmark_return:{label:'Benchmark / sector return (%)',kind:'number'},relative_return:{label:'Benchmark-relative return (%)',kind:'number'},volume_change:{label:'Volume change (%)',kind:'number'},outcome:{label:'Outcome',options:['pending','supporting_evidence','contradictory_evidence','inconclusive'],required:true},confounders:{label:'Confounding events',kind:'textarea'},source:{label:'Observation source'},method:{label:'Calculation method'},
};
export const specifications = {verification:verificationFields,evidence:evidenceFields,mapping:mappingFields,impact:impactFields,metric:metricFields,horizon:horizonFields,advanced:advancedFields,observation:observationFields};
