Your platform should be designed as an **evidence-backed, continuously updated stock intelligence system**, not simply a news sentiment dashboard.

The central product question is:

> **What changed for this company, why does it matter, over which horizon, how does it interact with what we already know, and what evidence supports that assessment?**

You have provided enough information to recommend a roadmap without blocking on clarification. I’ll assume you are initially serving individual investors and analysts, using your existing Next.js/Supabase application, and prioritizing explainability over high-frequency trading.

**PDF note:** I can provide the complete advice here in a document-ready format, but I cannot generate or attach a PDF file in this session. You can export this response using **Print → Save as PDF**.

## 1. Define the product around six customer experiences

| Customer experience | What the platform should provide |
| :--- | :--- |
| Understand a news event | A verified event summary, original sources, affected entities, and uncertainty |
| Visualize differentiated impact | Positive, negative, mixed, neutral, or unknown effects across companies and industries |
| Understand every assessment | Evidence-linked explanations for direction, magnitude, confidence, significance, and ranking |
| Understand long-term implications | Transmission mechanisms, persistence, scenarios, catalysts, and invalidation conditions |
| Combine related information | A stock-level assessment showing reinforcing, offsetting, contradictory, and superseding events |
| Monitor change | Alerts explaining what changed in the stock’s assessment, not merely announcing a new article |

A useful differentiation would be:

> **“We explain how the investment picture changes—not just whether the news sounds positive.”**

### Important product boundary

Keep these concepts separate:

- **Text sentiment:** How positive or negative the language sounds.
- **Business impact:** How the event could affect operations, earnings, cash flow, or risk.
- **Valuation impact:** How those changes could affect estimated value.
- **Market reaction:** What the stock actually did after publication.
- **Expected return:** A forecast requiring valuation, expectations, horizon, and a validated forecasting methodology.

Good news does not necessarily imply a rising stock price. A strongly positive development may already be priced in.

## 2. Build around events, claims, and assessments—not articles

One underlying development may appear in hundreds of articles. Treating every article as independent evidence creates false confidence and double-counted impact.

### Recommended conceptual structure

**Sources → Articles → Claims → Events → Entity exposures → Impact assessments → Stock intelligence → Alerts**

| Object | Purpose |
| :--- | :--- |
| Source | Publisher, regulator, exchange, company, or other information origin |
| Article/document | A particular published item, with publication and ingestion timestamps |
| Claim | A specific assertion supported, disputed, or qualified by evidence |
| Event | The underlying real-world development described by one or more articles |
| Entity | Company, industry, commodity, country, regulator, or other relevant actor |
| Security | A tradable instrument linked to an entity, including exchange and currency |
| Exposure | Why and how an entity is affected by an event |
| Assessment | A versioned interpretation of an event’s effect on an entity over a horizon |
| Thesis | An ongoing investment proposition supported or challenged by multiple events |
| Observation | Subsequent evidence or market data used to monitor an assessment |
| Alert | A material change communicated to a customer |

**A critical distinction:** the company and its listed security are not the same object. One company can have multiple listings, share classes, or debt instruments.

### Example

**Event:** An interruption to oil supply.

- Oil producer: potentially positive through higher realized prices.
- Airline: potentially negative through fuel costs.
- Logistics company: impact depends on fuel surcharges and contract terms.
- Refinery: impact depends on feedstock prices, product prices, and margins.

Each mapping needs its own evidence, assumptions, horizon, and confidence. An industry relationship is a candidate explanation—not proof of exposure.

## 3. Use a multidimensional assessment instead of one universal score

A single “news score” hides too much. Store the underlying dimensions separately, even if the interface presents a compact summary.

### Recommended assessment dimensions

| Dimension | Meaning |
| :--- | :--- |
| Direction | Positive, negative, mixed, neutral, or unknown |
| Magnitude | Estimated size of the business effect |
| Materiality | Importance relative to the affected company |
| Horizon | When the effect is expected to emerge |
| Persistence | Temporary, recurring, structural, or unknown |
| Surprise | Difference from documented expectations |
| Novelty | New information versus repeated coverage |
| Evidence quality | Strength, directness, and independence of supporting information |
| Mapping confidence | Confidence that the event affects this entity |
| Impact confidence | Confidence in the proposed effect and mechanism |
| Uncertainty | Missing evidence, conflicting claims, and scenario sensitivity |
| Significance | Importance for customer attention, irrespective of direction |

Use different rankings for different purposes:

- **Most significant developments**
- **Largest positive/negative fundamental changes**
- **Most uncertain material developments**
- **Most important changes to a customer’s watchlist**
- **Strongest long-term thesis changes**

Do not make “most positive” synonymous with “best investment.”

### Explain each score through its actual computation

An explanation should include:

1. **What happened**
2. **Who is affected**
3. **Transmission mechanism**
4. **Relevant metrics**
5. **Horizon and persistence**
6. **Supporting evidence**
7. **Assumptions and opposing evidence**
8. **Which rules contributed to the score**
9. **What would change the assessment**

For numerical scores, show an auditable breakdown from the scoring engine. Do not ask a language model to invent a persuasive explanation after the score has been calculated.

**Important:** a confidence score of 80/100 is not an 80% probability unless you have calibrated it against a clearly defined outcome.

## 4. Make combined-news analysis a first-class capability

This is likely to become your strongest feature.

A stock’s intelligence view should not be the sum of positive and negative headlines. It should represent the current state of relevant business drivers.

### Organize information by business driver

Examples:

- Revenue growth
- Pricing power
- Input costs
- Operating margins
- Capital expenditure
- Balance-sheet risk
- Regulatory exposure
- Competitive position
- Management execution
- Cost of capital

For each driver, show the events that strengthen, weaken, or complicate the assessment.

### Relationships between events

| Relationship | Interpretation |
| :--- | :--- |
| Duplicate coverage | Additional reporting of the same information |
| Corroborates | Independently supports an existing claim |
| Contradicts | Challenges a claim or assumption |
| Updates | Adds information to an existing development |
| Supersedes | Replaces a previous estimate or status |
| Amplifies | Strengthens an existing impact mechanism |
| Offsets | Reduces another event’s expected effect |
| Depends on | Becomes relevant only if another condition holds |

### Example: an airline

1. Oil prices rise → potential fuel-cost pressure.
2. Existing hedges are disclosed → near-term exposure is reduced.
3. Ticket prices increase → some costs may be passed through.
4. Demand weakens → pricing power becomes less certain.

The resulting view should explain:

> “Near-term margin pressure is partly buffered by hedging. Medium-term risk remains if fuel costs persist and weaker demand prevents fare increases.”

This is more useful than displaying “two positive stories and two negative stories.”

### Aggregation rules

Start with transparent rules:

- Deduplicate coverage before aggregation.
- Avoid counting syndicated reporting as independent corroboration.
- Aggregate within business drivers and horizons.
- Respect superseded assessments.
- Retain contradictions rather than averaging them away.
- Show coverage gaps.
- Version the aggregate whenever its inputs change.
- Explain which events caused the revision.

Later, add probabilistic or learned aggregation where sufficient data supports it.

## 5. Treat long-term intelligence as thesis monitoring

Long-term analysis requires more than applying slower decay to a news score.

For each material development, ask:

- Does it change sustainable revenue or margins?
- Does it affect capital needs or financing risk?
- Does it strengthen or weaken competitive advantages?
- Does it alter the probability of a strategic outcome?
- Is the effect reversible?
- What assumptions must remain true?
- Which milestones will confirm or invalidate the thesis?

### Recommended long-term assessment structure

- Thesis statement
- Business driver
- Base, upside, and downside scenarios
- Expected onset and duration
- Leading indicators
- Upcoming catalysts
- Invalidation conditions
- Evidence supporting and challenging the thesis
- Next review date

Begin with qualitative and ordinal assessments. Add cash-flow or valuation ranges only when you have sufficient financial data and documented assumptions.

**Avoid mechanical decay for structural events.** A factory closure or regulatory ban does not become irrelevant simply because its headline is old.

## 6. Recommended architecture

Keep your existing stack. Start as a **modular application with background workers**, rather than introducing many microservices.

### Logical architecture

```text
Licensed feeds / filings / company releases / approved sources
                              |
                    Ingestion connectors
                              |
                  Durable queue + raw storage
                              |
           Parsing, language detection, timestamp handling
                              |
             Deduplication and event candidate matching
                              |
         Claim extraction + entity/security resolution
                              |
                 Review and verification queue
                              |
                  Canonical events and evidence
                              |
       Exposure mapping + horizon-specific scoring engine
                              |
             Versioned entity impact assessments
                              |
           Stock/driver/thesis aggregation and snapshots
                              |
               Change detection + alert outbox
                              |
          Next.js customer views + notification delivery
```

An accompanying audit and evaluation layer should track every stage.

### Practical technology choices

| Layer | Initial recommendation |
| :--- | :--- |
| Customer and reviewer UI | Existing Next.js application |
| Authentication and permissions | Supabase Auth and RLS |
| Transactional storage | Supabase PostgreSQL |
| Documents and permitted raw content | Object storage |
| Async execution | Durable job queue and background workers |
| Scoring | Versioned TypeScript rules engine |
| Search | PostgreSQL full-text search initially |
| Semantic retrieval | Optional vector search when validated against a concrete need |
| Relationships | Relational edge tables initially |
| Notifications | Worker-based email/in-app delivery |
| Operational monitoring | Structured logs, job metrics, error tracking, audit records |

You do **not** need a graph database simply because your domain contains relationships. PostgreSQL can support the initial event/entity/thesis graph.

### Non-negotiable engineering properties

- Idempotent ingestion and acceptance.
- Atomic writes for accepted assessments and their projections.
- Retries and failed-job handling.
- Immutable accepted versions.
- Reproducible scoring.
- Explicit authorization.
- Tenant isolation for customer-specific data.
- Source correction and retraction propagation.
- Point-in-time reconstruction.
- Reliable alert delivery with deduplication.

Use a **transactional outbox** so an assessment change and its pending notification are recorded together.

### Time handling

Store separately:

- When the event occurred
- When the source published it
- When your platform received it
- When a reviewer accepted it
- When an assessment became effective
- When it was revised

This is essential for trustworthy backtesting and showing what the system actually knew at a given time.

## 7. Customer-facing views

### A. Event impact explorer

Show an event at the center with affected companies and industries.

Each connection displays:

- Direction
- Direct/indirect exposure
- Magnitude
- Horizon
- Confidence
- Expandable causal explanation

Provide an accessible table alternative to the graph.

### B. Stock intelligence workspace

A focused stock view with:

- Current assessment by horizon
- Recent changes
- Business-driver breakdown
- Supporting and opposing events
- Long-term theses
- Upcoming catalysts
- Unresolved uncertainties
- Evidence timeline

### C. Multi-event analysis workspace

Customers select relevant events and compare:

- Combined effects
- Offsetting effects
- Shared assumptions
- Conflicting evidence
- Different scenarios

If customers exclude events, label the result as a **filtered analysis**, not the platform’s complete stock assessment.

### D. Evidence and score inspector

Allow customers to inspect:

- Source references and permitted excerpts
- Claim-to-source mapping
- Score components
- Rule/model version
- Reviewer involvement
- Revision history

### E. Watchlists and change alerts

Alert on meaningful changes, such as:

- Direction changed.
- Materiality crossed a threshold.
- A thesis was weakened or invalidated.
- Evidence confidence declined.
- A source retracted a claim.
- A new event introduced a major risk.
- A catalyst materially changed the outlook.

Each alert should contain **before, after, why, horizon, and evidence**.

## 8. Delivery roadmap

The phases below use **exit criteria rather than fixed dates**. Timeline depends heavily on team size, source licensing, and review capacity.

### Phase 0 — Scope and analytical contract

**Goal:** Define exactly what your first release claims to do.

Deliver:

- Initial stock universe and geography.
- Supported event categories.
- Horizon definitions.
- Assessment rubric.
- Source licensing policy.
- Score definitions and limitations.
- Annotated benchmark examples.
- Reviewer guidelines.

**Exit criterion:** Two reviewers can apply the rubric to the same examples with acceptable agreement, and disagreements reveal clear policy questions rather than vague scoring.

Start with a bounded universe and a small number of material event categories. Global ingestion can expand later.

### Phase 1 — Evidence-backed manual intelligence

**Goal:** Produce trustworthy assessments before automating them.

Deliver:

- Canonical entities and securities.
- Article-to-event mapping.
- Claim-level evidence.
- Structured review workflow.
- Per-entity, per-horizon assessments.
- Deterministic scoring.
- Accepted-version history.
- Event impact and stock views.

**Exit criterion:** Every published assessment is traceable to its evidence and reproducible from its versioned inputs.

### Phase 2 — Connected stock intelligence

**Goal:** Explain multiple events together.

Deliver:

- Event relationships.
- Business-driver grouping.
- Long-term thesis tracking.
- Combined stock assessments.
- Historical snapshots.
- Focused multi-event workspaces.
- Contradiction and supersession handling.

**Exit criterion:** The system can explain why a stock-level assessment changed without double-counting repeated coverage.

### Phase 3 — Monitoring and alerts

**Goal:** Make the platform continuously useful.

Deliver:

- Watchlists.
- Assessment-change detection.
- Materiality thresholds.
- Alert preferences and digests.
- Notification deduplication.
- Daily observations.
- Corrections and retractions handling.

**Exit criterion:** Alerts are relevant, explainable, and operationally reliable—not simply a stream of headlines.

### Phase 4 — Assisted review automation

**Goal:** Reduce reviewer effort without surrendering control.

Deliver:

- Suggested entity matches.
- Event clustering.
- Claim extraction.
- Evidence-linked draft summaries.
- Proposed exposure mappings.
- Suggested assessment fields.
- Confidence-based review routing.

**Exit criterion:** Suggestions demonstrate measured quality and reviewer time savings on held-out data.

### Phase 5 — Selective autonomous processing

**Goal:** Automatically publish only well-understood, low-risk cases.

Deliver:

- Category-specific automation policies.
- Abstention and escalation.
- Shadow-mode evaluation.
- Production monitoring.
- Rollback and correction workflows.
- Reviewer sampling of automated outputs.

**Exit criterion:** Each automated task meets a documented quality threshold; unknown cases remain human-reviewed.

### Phase 6 — Learned forecasting and personalization

**Goal:** Add validated predictive capabilities.

Deliver:

- Horizon-specific outcome datasets.
- Calibrated forecasts where feasible.
- Point-in-time backtesting.
- Customer relevance ranking.
- Scenario and valuation extensions.
- Expanded geographic and language coverage.

**Exit criterion:** New models outperform simple baselines out of sample on the task they actually claim to solve.

Do not make predictive stock-return models a prerequisite for delivering useful evidence-backed intelligence.

## 9. User stories — titles only

### Evidence and ingestion

- Ingest News from Approved Global Sources
- Preserve Source Provenance and Content Rights
- Detect Duplicate and Syndicated Coverage
- Group Articles into Canonical Events
- Extract Claims with Supporting Evidence
- Track Corrections and Retractions
- Resolve Companies, Industries, and Securities
- Review Multilingual Evidence Alongside Translations

### Review and assessment

- Save and Resume a Structured Review
- Accept News Pending Further Analysis
- Map Direct and Indirect Entity Exposure
- Assess Impact Separately by Investment Horizon
- Record Assumptions and Counterarguments
- Generate Deterministic Impact Scores
- Inspect Score Components and Rule Versions
- Preserve Immutable Assessment History
- Resolve Reviewer Disagreements
- Escalate Unsupported or Uncertain Assessments

### Connected intelligence

- Link Reinforcing and Contradictory Events
- Replace Superseded Assessments without Losing History
- Organize Stock Impacts by Business Driver
- Monitor Long-Term Investment Theses
- Combine Relevant Events into a Focused View
- Compare Impact across Companies and Industries
- Reconstruct Intelligence as Known on a Historical Date
- Explain Changes to the Stock-Level Assessment

### Customer experience

- Explore an Event’s Cross-Industry Impact
- Inspect Evidence behind Every Published Assessment
- View a Stock’s Short- and Long-Term Outlook
- Compare Supporting and Opposing Evidence
- Track Catalysts and Invalidation Conditions
- View Observed Outcomes Separately from Forecasts

### Monitoring and alerts

- Create a Stock Intelligence Watchlist
- Configure Material Assessment-Change Alerts
- Receive Before-and-After Impact Explanations
- Receive Thesis Invalidation Alerts
- Receive Source Correction Alerts
- Consolidate Related Changes into a Digest
- Suppress Duplicate and Low-Value Notifications

### Automation and learning

- Capture Reviewer Corrections as Training Labels
- Suggest Entity and Event Matches
- Draft Evidence-Grounded Impact Explanations
- Route Uncertain Cases to Human Review
- Evaluate Models in Shadow Mode
- Publish Eligible Assessments Automatically
- Monitor Model Drift and Calibration
- Roll Back a Faulty Model or Scoring Version

## 10. Build the training dataset from day one

Your review workflow should double as a high-quality annotation system.

### Store these training assets

| Asset | Future use |
| :--- | :--- |
| Accepted and rejected entity matches | Entity resolution |
| Duplicate and related-event labels | Event clustering |
| Claims and exact evidence spans | Grounded extraction |
| Reviewer-approved exposure mechanisms | Impact mapping |
| Horizon-specific assessments | Structured assessment models |
| Original suggestions and reviewer corrections | Error analysis and supervised training |
| Unsupported/insufficient-evidence decisions | Abstention training |
| Disagreements and adjudications | Label-quality improvement |
| Point-in-time observations | Outcome evaluation |
| Source language and event category | Segment-level performance analysis |

Record whether a label came from a person, a rule, a model, or an adjudication process.

**Human approval is not automatically ground truth.** Reviewers can share biases, especially when they see model suggestions first. Include some independently labeled samples.

### Use separate labels for separate tasks

Do not train everything against a single “positive/negative” label.

Examples:

- Entity mapping correctness
- Evidence support
- Event category
- Direction by horizon
- Materiality
- Realized financial outcome
- Benchmark-relative stock return
- Alert usefulness

A model trained to imitate reviewer assessments has learned reviewer behavior—not necessarily future investment performance.

## 11. Automation and model strategy

### Recommended order

| Task | Good starting approach |
| :--- | :--- |
| Source validation | Rules and source metadata |
| Entity resolution | Identifiers, aliases, retrieval, then model assistance |
| Duplicate detection | Exact/fuzzy matching plus semantic candidates |
| Event classification | Rules or supervised classifier |
| Claim extraction | Structured model output with evidence-span validation |
| Impact scoring | Versioned deterministic rules |
| Explanation rendering | Templates first; grounded language-model assistance later |
| Cross-event relationships | Rules plus reviewer-confirmed model suggestions |
| Customer ranking | Transparent relevance rules first |
| Return forecasting | Separate supervised research pipeline |

### Fine-tuning a small language model

Fine-tuning becomes useful when you have:

- Stable input/output schemas.
- Consistent labels.
- Sufficient representative examples.
- A measurable baseline.
- A clear latency, cost, privacy, or quality reason.

Good early targets include event classification, structured extraction, and standardizing assessment drafts.

Use retrieval to supply current evidence. **Fine-tuning is not a replacement for fresh knowledge or citations.**

### Do not automate all judgments at once

Use a progression:

**Suggest → Human approve → Shadow test → Auto-publish narrow cases → Expand cautiously**

Always support abstention:

> “The available information is insufficient to assess this company’s exposure reliably.”

News and retrieved documents must be treated as untrusted input. Embedded instructions in an article must never control model actions or access to tools.

## 12. Evaluation: measure intelligence quality separately from investment performance

### Analytical quality

- Entity resolution precision and recall.
- Event clustering quality.
- Claim-to-evidence correctness.
- Unsupported statement rate.
- Reviewer agreement.
- Score reproducibility.
- Correction frequency.
- Coverage and abstention rates.

### Product quality

- Time to understand a development.
- Reviewer time per assessment.
- Useful-alert rate.
- Duplicate-alert rate.
- Source-to-published-assessment latency.
- Watchlist engagement and retention.

### Predictive quality, when you introduce forecasts

- Calibration for explicitly probabilistic forecasts.
- Horizon-specific error.
- Benchmark-relative performance.
- Risk-adjusted results.
- Performance after transaction costs and realistic latency.
- Stability across sectors, languages, regimes, and time periods.

### Backtesting safeguards

- Time-based train/test splits.
- Prevent related-event leakage across splits.
- Use only information available at the decision timestamp.
- Retain delisted companies to reduce survivorship bias.
- Handle splits, dividends, currencies, and trading calendars.
- Separate model selection from final evaluation.
- Account for overlapping outcome windows.

A correct causal explanation can coexist with an opposite stock-price move because other developments also affect price. Price reaction alone is not a reliable label for whether every assessment was right.

## 13. Main risks and controls

| Risk | Control |
| :--- | :--- |
| News licensing restrictions | Review storage, display, redistribution, and training rights separately |
| Repeated coverage inflates impact | Canonical events and source-lineage tracking |
| Plausible but unsupported explanations | Claim-level citations and evidence validation |
| Speculative indirect exposure | Explicit assumptions, confidence, and review requirements |
| Scores imply false precision | Defined scales, component breakdowns, and calibrated language |
| Long-term analysis becomes stale | Catalyst monitoring, review dates, and invalidation rules |
| Model bias compounds | Independent labels, segment-level evaluation, and human sampling |
| Alerts become noise | Materiality thresholds, grouping, cooldowns, and digests |
| Regulatory ambiguity | Jurisdiction-specific legal review of recommendations and personalization |
| Global expansion reduces quality | Expand source/language coverage only with matching evaluation capacity |

Also distinguish **source credibility from claim truth**: a reputable outlet can report an unverified claim accurately, while the claim itself remains uncertain.

## 14. What I would prioritize for your existing project

Given your current Next.js/Supabase foundation, Impact Records view, and rules-driven direction:

1. **Audit the existing schema and scoring implementation.**
2. **Introduce canonical events, entities, securities, and evidence references.**
3. **Complete structured, versioned review and acceptance.**
4. **Represent one event’s impact separately for each entity and horizon.**
5. **Make Impact Records an explainable projection of accepted assessments.**
6. **Build the stock-level view around business drivers.**
7. **Add event relationships and assessment-change history.**
8. **Implement watchlists and meaningful change alerts.**
9. **Capture reviewer corrections and evaluate assisted automation.**
10. **Expand sources and autonomy only after the quality loop works.**

Avoid prioritizing a graph database, fine-tuning, elaborate return forecasts, or dozens of source connectors before these foundations.

**The most valuable first release is not “AI scores every global headline.” It is:**

> **“For a defined stock universe, we reliably explain what changed, which companies are affected, how the implications differ by horizon, and what evidence supports the conclusion—and we notify you when that conclusion changes.”**