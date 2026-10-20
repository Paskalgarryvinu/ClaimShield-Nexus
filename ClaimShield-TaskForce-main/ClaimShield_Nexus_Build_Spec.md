# CLAIMSHIELD NEXUS: BUILD SPECIFICATION (FINAL, AUTHORITATIVE)

Build a working, explainable, end-to-end prototype of ClaimShield Nexus, a healthcare payer Fraud/Waste/Abuse (FWA) investigation platform for SIU investigators. This is a same-day hackathon build.

PRIORITY ORDER: working end-to-end flow > analytical depth > UI polish > advanced features.
CORE PRINCIPLE: Don't just flag the claim. Explain the case.
PIPELINE: Signals -> Correlation -> Case -> Risk -> Forecast -> Priority -> Brief -> Human decision.
TAGLINE: "From claim-level alerts to investigation-ready intelligence." / "Detect. Correlate. Prioritize. Explain."

This is decision support, not a fraud adjudicator. It never declares fraud.

## 0. OPERATING RULES

1. Use only synthetic data. No real PHI/PII. Show a persistent "SYNTHETIC ENVIRONMENT" badge.
2. NO HARDCODED RESULTS. Any number in this spec (claim counts, risk scores, dollar figures, percentages, case IDs) is an illustrative example only. Every displayed figure must be computed by the pipeline from the data. Never copy example numbers.
3. NO FAKE AI. Use real rules, statistics, Isolation Forest, graph analytics and a trained forecast model. No chatbot, no "AI thinking" animation.
4. Deterministic: one global RANDOM_SEED and one fixed AS_OF_DATE. All dataset dates are relative to AS_OF_DATE. The real clock is used only for audit-log timestamps.
5. The app must stay runnable after every phase. Test frontend, backend and the primary workflow before moving on. Commit after each stable phase. Do not start the next phase if the current one is broken.
6. Do not build a giant one-shot app. Follow the phases in section 17. After producing the plan (section 18), proceed directly to implement Phase 1 without waiting for approval.
7. Do not silently drop or simplify requirements. If you must cut scope, say what and why.
8. Cut line if time runs short, in this order: Claims Intelligence page, standalone Network Explorer (keep a small graph inside the case brief), Admin polish. NEVER cut: real pipeline replay, audit log, uncertainty handling, decoys, ground-truth evaluation.

## 1. USERS AND ROLES

Simple role selector, no real auth. Landing screen: "Enter ClaimShield Nexus" with [Investigator] and [Program Manager], plus "SYNTHETIC DEMO" shown.
- Investigator (primary): Command Center, Claims, Network, SIU Queue, Investigations, Forecast, Demo, Decision Transparency. Read-only on configuration.
- Program Manager (secondary, thin): everything above plus Admin (data status, rules ON/OFF, thresholds, service-type weights, investigation capacity, model status, system status). Can edit rules, thresholds, capacity. Admin must stay smaller than the investigator experience.

The investigator's questions to answer: what first, why suspicious, what evidence, who is connected, isolated or coordinated, how much exposure, will it continue, what to review next, how confident, what are the limits.

## 2. STACK (keep simple, laptop-friendly)

- Frontend: React (Vite), plain modern CSS, Recharts, React Flow (or Cytoscape.js).
- Backend: Python, FastAPI, pandas, numpy, scikit-learn, networkx (use python-louvain or networkx's louvain_communities, seeded).
- DB: SQLite.
- Streaming: SSE for demo pipeline progress.
- NOT allowed: Kubernetes, Kafka, Spark, microservices, Neo4j, cloud infra.
- Provide one-command setup and run (README + scripts or Makefile): seed data, run analysis, start backend, start frontend.

## 3. DATA MODEL (SQLite tables; synthetic only)

- claims: claim_id, member_id, provider_id, facility_id, service_date, submission_date, service_type, procedure_code, diagnosis_code, billed_amount, paid_amount, units, claim_status, place_of_service, location, referral_id
- providers: provider_id, provider_name, specialty, provider_type, peer_group, location, owner_id, address_id, phone_id, tax_id, risk_history, investigation_count
- members: member_id, synthetic_name, age_group, location, enrollment_status, coverage_start, coverage_end
- facilities: facility_id, facility_name, facility_type, location, ownership_group, risk_indicator
- referrals: referral_id, referring_provider_id, receiving_provider_id, member_id, referral_date, facility_id
- relationships: source_type, source_id, target_type, target_id, relationship_type, weight (provider-member, provider-facility, provider-provider via owner/address/phone/tax_id/referral, member-claim, facility-claim, provider-claim)
- investigations_history: investigation_id, related_provider_id, case_status, previous_risk, investigation_date, outcome, evidence_strength
- member_stays: stay_id, member_id, facility_id, admit_date, discharge_date (for phantom-service checks)
- bundle_definitions: bundle_code, component_code (configurable table)
- code_peer_baselines or equivalent for unusual-billing comparison
- Analysis outputs: signals, cases, case_members (entities), case_claims, risk_scores, forecasts (per horizon), queue_entries, case_decisions, audit_log, analysis_runs, config
- ground_truth_scenarios (see section 4). READ ONLY BY THE EVALUATION MODULE.

Missing values must be allowed and handled (missing provider, facility, referral, history). Show "Insufficient evidence" or "Confidence limited by missing data" instead of inventing information.

## 4. SYNTHETIC DATA AND PLANTED SCENARIOS

Target scale (adjustable for speed, but internally consistent): about 25,000 claims, 1,500 to 2,000 providers, 7,000 to 10,000 members, 150 to 250 facilities, several thousand referrals, historical claims covering at least 12 months before AS_OF_DATE, and historical investigation records. Cover service types: professional, facility, pharmacy, laboratory, ambulance, behavioral health, home health, DME.

Generator is seeded and deterministic. Planted scenarios escalate month by month (rising frequency, utilization, referral concentration, network size) so the forecast model has something to learn. Normal providers and decoys stay stable.

Planted scenarios (each recorded in ground truth):
- SC-01 Coordinated Billing Network: multiple providers sharing facility and/or owner_id/address_id, high referral concentration among them, similar billing, duplicates, excessive utilization, a prior investigation link. Primary demo case.
- SC-02 Impossible Timing / Phantom Service: same member at distant locations within implausible time; services during an inpatient stay by an inconsistent provider; services after coverage_end; overlapping services at two facilities; provider billing beyond plausible daily capacity.
- SC-03 Duplicate Billing + Unbundling: repeated near-identical claims (member, provider, date, procedure, amount) and component codes billed separately where a bundle exists.
- SC-04 Referral Concentration + Excessive Utilization: providers sending a very high share of referrals to one provider/facility, plus utilization far above peers.
- SC-05 Upcoding / Unusual Billing: procedure/code mix or amounts materially off peer group (a signal, never proof).
- Additional minor planted cases to produce a realistic case count.

DECOYS (mandatory): legitimate high-volume entities that look unusual by volume only, such as a large hospital with huge claim volume, many members, many providers, high total payments, and a high-volume specialty clinic. They must NOT become high-risk cases. The system must distinguish high volume from suspicious behavior via peer normalization and requiring multiple independent signals.

GROUND TRUTH TABLE: scenario_id, scenario_name, involved_entities, claim_ids, expected_signal_types, expected_signal_count, expected_risk_band, plus a decoy list. There is NO fixed expected case ID, because case IDs are generated after clustering. The detection pipeline must never read ground truth. Only the evaluation module and tests read it. Match planted scenarios to generated cases by entity overlap.

## 5. DETECTION (rules, all configurable and toggleable)

Each signal record: signal_id, signal_type, entity(ies), claim_ids, evidence fields, severity, rule parameters used, plain-language description.

1. Duplicate billing: highly similar claims on configurable fields (member, provider, date, procedure, amount).
2. Unbundling: for the same member+provider+date, component codes billed separately that map to a bundle in bundle_definitions. Show supporting claim IDs and component codes. Label: "Potential unbundling pattern: review required."
3. Phantom service (label "Potential Phantom Service"): service during an inpatient stay by an inconsistent provider/service, service after coverage_end, service at another facility during overlapping time, provider billing beyond plausible capacity (e.g., implausible service-hours per day). Show evidence.
4. Impossible timing: same member at distant locations in implausibly short time; provider with impossible service sequences.
5. Excessive utilization: provider/member/service utilization vs peer-group baseline (z-score or robust deviation).
6. Unusual billing / potential upcoding: code/amount distribution vs peer group. Treated as a signal requiring review.
7. Referral concentration: share of a provider's referrals going to one provider/facility vs expectation. A network signal, not a conclusion.
8. Shared identity linkage: providers sharing owner_id, address_id, phone_id or tax_id. A relationship signal, NOT proof of fraud.

Every signal must carry a supporting-fields evidence payload (e.g., duplicate: claim_id, member_id, provider_id, service_date, procedure_code, billed_amount; utilization: provider, peer_group, provider_utilization, peer_average, deviation; referral: referring_provider, receiving_provider, referral_count, total_referrals, concentration_percentage).

## 6. ANOMALY MODEL

Isolation Forest over provider-level behavioral features, all PEER-GROUP NORMALIZED (z-scores vs peer group), not raw volume: claim frequency, avg billed, avg paid, utilization rate, unique members, referral concentration, duplicate frequency, service diversity, timing anomaly rate, facility concentration. Output an anomaly score 0 to 1. Persist model artifact and version. Language: "behavioral anomaly", "unusual pattern", never "fraud".

## 7. CASE FORMATION (avoid the giant-component problem)

- Build a weighted entity graph. Edge strengths: provider-claim strong, provider-facility strong, referral strong, historical investigation link strong, provider-member moderate, shared owner moderate, shared address lower, shared phone/tax_id moderate.
- Down-weight edges by node degree (inverse-degree weighting) and/or exclude hub nodes (large hospitals, widely shared facilities) from community detection, so a hub cannot merge unrelated clusters.
- Run seeded weighted Louvain (fallback: simple weighted label propagation).
- Apply a minimum-evidence threshold (min independent signal types, min supporting claims, min combined weight). Clusters below it stay "monitored signals", not cases.
- Case IDs are assigned after clustering (e.g., CS-0001 in ranking order of creation). Never hardcode them.
- Output check: no single case may contain a large fraction of all entities. Fail the analysis health check if it does.

## 8. METRICS (transparent, configurable definitions)

- EXPOSURE = sum of paid_amount over UNIQUE flagged claims in the case (no double counting across signals).
- MEMBER IMPACT = distinct affected members x service-type impact weight (weights configurable). Bucket: Low / Medium / High / Critical. Show the member count.
- SEVERITY = function of exposure, member impact, number of signal types, network scale, escalation indicators. Levels: Low / Moderate / High / Critical.
- EVIDENCE STRENGTH = independent signal types, supporting claims, network relationships, historical evidence, data completeness. Levels: Limited / Moderate / Strong.
- CONFIDENCE (0 to 100%) = weighted combination of evidence quantity, signal diversity, data completeness, historical depth, rule/model agreement, and network evidence strength. Show the component contributions.
- RISK SCORE (0 to 100), transparent breakdown with configurable weights: Behavior, Network, Anomaly, History, Temporal. The brief shows each component's points out of its maximum, computed from real values.
- Status vocabularies: risk bands NORMAL / MONITORED / ELEVATED / HIGH / CRITICAL; case status NEW / IN REVIEW / EVIDENCE REQUESTED / ESCALATED / CLOSED / FALSE POSITIVE.

## 9. UNCERTAINTY AND RESPONSIBLE AI (mandatory)

- If confidence is low, evidence is Limited, important fields are missing, or history is inadequate: recommendation is capped at REQUEST MORE EVIDENCE and the UI shows "Insufficient evidence for a higher-confidence recommendation." The case stays in the queue, flagged.
- Decision Transparency panel (part of the product, not a footer): "ClaimShield Nexus does not determine fraud." What influenced this score (behavioral, network, anomaly, historical, temporal). Limitations: synthetic data, missing data affects results, correlation is not proof, forecasts are probabilistic, model performance varies, human review required.
- Language to use: elevated risk, evidence strength, potential exposure, investigation priority, suspicious pattern, requires human review, network concentration, behavioral anomaly. Never: "100% fraud", "AI caught the criminal", "confirmed fraud".

## 10. FORECAST (real model; label "Risk Forecast", never "Fraud Prediction")

- Fix a cutoff date inside the historical period. Features use ONLY pre-cutoff data (claim frequency trend, utilization trend, referral concentration trend, network growth, anomaly score, prior investigations, signal counts). Label = whether the detection pipeline's signals show repeat or escalating suspicious behavior for that provider in the next N days after the cutoff. Avoid label leakage.
- Train one model per horizon (30, 60, 90) with a time-based split, using logistic regression or gradient boosting. Persist artifacts, report holdout metrics (AUC, precision/recall) on the Forecast and Admin pages.
- Case-level forecast = weighted aggregate over member providers. Provide top drivers per forecast (coefficients or feature contributions).
- GLOBAL HORIZON SELECTOR [30 | 60 | 90 days] in the top bar. It affects the Forecast page, the Investigation Brief, SIU priority where relevant, and the explanation text ("Estimated probability of repeat/escalating suspicious behavior within N days.").
- Always show: "Forecast represents decision-support risk, not a determination of fraud." and an uncertainty note. If history is insufficient, show "Insufficient evidence to calculate forecast."

## 11. SIU QUEUE AND PRIORITY

- Priority = weighted sum of normalized components: risk, exposure, member impact, severity, evidence strength (and forecast probability for the selected horizon, if included). Weights depend on strategy: Balanced, Financial Exposure, Member Impact, Evidence Strength, Severity. Changing the strategy must actually re-rank.
- Investigation capacity N (default configurable). Top N by priority are marked "Priority Investigations"; the rest remain queued. Show "N slots available; K cases ranked; top N selected."
- Table columns: Case, Type, Risk, Exposure, Member Impact, Evidence, Confidence, Priority, Status. Sort and filter. Low-confidence cases are flagged.

## 12. INVESTIGATION WORKSPACE

For each case show:
- Header: case ID, case type label, risk, exposure, member impact, severity, evidence strength, confidence, status.
- Why flagged: signal summary with real counts (duplicates, peer utilization multiple, referral concentration, impossible-timing events, connected entities with previous investigations).
- Risk score breakdown (the five components).
- Evidence panel: per signal type, the supporting fields and the actual claim rows, each linkable.
- Timeline generated from actual event dates (first unusual pattern, referral changes, duplicates, network expansion, threshold crossing).
- Network context: embedded graph of primary provider, connected providers, facilities, members, referrals, claims, prior investigations. Click to open entity intelligence.
- Forecast for the selected horizon, with drivers.
- Confidence, limitations, and the recommended human-review action.
- Human decision buttons: Investigate, Request More Evidence, Mark False Positive, Escalate, Close Case. Require a reason. Writing a decision updates case status and creates an audit event (case_id, action, role, real timestamp, reason). Show a case activity timeline (case generated, assigned, evidence reviewed, decision, status change). State clearly that the final decision belongs to the human investigator.

## 13. NETWORK EXPLORER

Interactive graph (zoom, pan, select, highlight connected entities, search by provider/member/facility/claim/case ID). Distinct node types and colors: providers, members, facilities, claims, referrals, investigations. Shared owner/address/phone/tax_id appear as labeled relationship edges. Clicking a node opens an Entity Intelligence panel (risk score, claim count, member count, facilities, referral concentration, signals, previous investigations) with clickable related entities. Hub nodes should be collapsible or de-emphasized to keep the graph readable.

## 14. DEMO MODE (must be real)

Scenarios (each shows name, pattern demonstrated, main signals, [Run Scenario]):
- 01 Coordinated Billing Network
- 02 Impossible Timing / Phantom Service
- 03 Duplicate + Unbundling
- 04 Referral Concentration + Excessive Utilization

Run Scenario executes the FULL real pipeline via SSE, streaming real stage names and timings: load data, validate, rule detection, anomaly detection, correlate signals, build graph, calculate risk, calculate confidence, generate forecast, rank SIU queue, generate brief. Models are pre-trained so the run finishes in about 5 seconds or less. Then show "INVESTIGATION READY" and open the case whose entities overlap the scenario's planted entities (matched by overlap, not by hardcoded ID). If no case overlaps, say so honestly. The displayed numbers must match the underlying data (e.g., "N duplicate patterns" means N real matching claim pairs).

## 15. OTHER PAGES

- Command Center: counts for claims analyzed, suspicious signals, correlated cases, priority investigations; ALERT-REDUCTION FUNNEL (raw claims -> signals -> cases -> priority cases) from actual values; risk trend; signal distribution; top risk providers and facilities; emerging networks; case status; workload vs capacity; evaluation card (precision/recall at provider and case level, decoys falsely flagged, with the note that synthetic evaluation is optimistic). Every number clicks through to its data (cases -> queue, case -> brief, provider -> network, claim -> claim detail).
- Claims Intelligence: searchable, filterable table (risk, service type, provider, facility, date, signal type, status); claim detail with connected provider, member, facility, referrals, related claims.
- Risk Forecast page: selected-horizon forecast, trend chart, drivers, historical comparison, model holdout metrics, explanation of uncertainty.
- Data page: record counts, freshness, sample records, Reload synthetic dataset, Run analysis.
- Admin (Program Manager): rule toggles, thresholds, service weights, capacity, model status and versions, system health (Data Pipeline, Detection Engine, Anomaly Model, Network Analysis, Risk Engine, Forecast Engine, Database), last analysis.
- Global search: claim, provider, member, facility, case IDs route to the right entity.
- Proper empty states ("No suspicious patterns detected for this filter.", "No connected entities found.") and specific loading states ("Analyzing claims...", "Building relationship network...").

## 16. UI/VISUAL DESIGN

Serious enterprise healthcare intelligence look: deep navy/slate sidebar, light analytical surfaces, restrained accents, red/orange only for real risk, green for normal/cleared, compact dense tables, subtle borders, strong typography, consistent spacing. No neon, no heavy gradients, no glassmorphism, no robot imagery, no chatbot-first UI, no startup landing aesthetics. Desktop and laptop first. Persistent left sidebar: COMMAND CENTER, CLAIMS INTELLIGENCE, NETWORK EXPLORER, SIU QUEUE, INVESTIGATIONS, RISK FORECAST, DATA, DEMO MODE; then ADMINISTRATION, SYSTEM STATUS. Top bar: workspace, global search, forecast horizon selector, notifications, role, SYNTHETIC ENVIRONMENT badge.

## 17. BUILD PHASES (implement in order; app runnable after each; commit after each)

PHASE 1 Foundation: structure, SQLite, seeded synthetic generator (with decoys, escalating scenarios, member_stays, bundles), ground truth, basic API, frontend shell with role selector.
PHASE 2 Detection: all rules plus peer-normalized Isolation Forest; signals persisted with evidence payloads.
PHASE 3 Case + Risk: weighted graph, hub handling, Louvain, min-evidence threshold, exposure, member impact, severity, evidence strength, confidence, risk score.
PHASE 4 SIU: priority formula, strategies, capacity, filters, sorting.
PHASE 5 Investigation: workspace, evidence, timeline, network context, forecast model per horizon, uncertainty cap, decisions, audit log.
PHASE 6 Demo: scenario selector, SSE real pipeline, scenario-to-case mapping by entity overlap.
PHASE 7 Network: full explorer, search, entity intelligence.
PHASE 8 Polish: Command Center with funnel and evaluation, Claims Intelligence, Forecast page, Data, Admin, Decision Transparency, System Status.

## 18. TESTS (pytest plus a frontend smoke check)

- Ground-truth recall: planted scenarios map to cases by entity overlap above a threshold.
- Decoys never appear in the priority list (report any false flags).
- No giant case: largest case holds less than a configured share of entities.
- Exposure has no double counting; confidence, risk and priority are reproducible with a fixed seed.
- Dashboard/UI figures equal DB-derived values (counts, funnel, queue, case metrics).
- Forecast: no pre-cutoff leakage; one model per horizon; the selector changes outputs.
- Low-confidence cases cap at Request More Evidence.
- Audit event is created for every decision.
- Detection modules never import or read ground-truth tables.

## 19. FINAL ACCEPTANCE FLOW (must work with no manual data edits)

Role selector -> Investigator -> Command Center -> Demo Mode -> Scenario 01 -> Run Scenario (real SSE pipeline) -> results -> SIU Queue -> open the matched case -> Investigation Brief (risk breakdown, evidence, timeline, confidence, limitations) -> Network -> Forecast (switch 30/60/90) -> Evidence -> Human Decision with reason -> Audit log and case activity timeline updated. Then repeat for Scenarios 02, 03, 04.

## 20. FIRST ACTION

1. Inspect the existing project (if any).
2. Output: folder structure, DB schema, synthetic data schema, detection architecture, API routes, frontend routes, how Run Scenario connects to the real pipeline, dependencies to install, and top technical risks.
3. Then implement PHASE 1 only, verify it runs, commit, and report what works before continuing to Phase 2.

Detect the signal. Connect the evidence. Understand the network. Prioritize the case. Keep the human in control.
