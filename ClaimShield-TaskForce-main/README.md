# ClaimShield Nexus: SIU Fraud/Waste/Abuse Investigation Platform

> **"From claim-level alerts to investigation-ready intelligence. Detect. Correlate. Prioritize. Explain."**

ClaimShield Nexus is an explainable, end-to-end healthcare payer Fraud, Waste, and Abuse (FWA) decision-support platform designed for Special Investigation Unit (SIU) investigators and program managers. Built strictly according to the authoritative build specification in `ClaimShield_Nexus_Build_Spec.md`.

---

## 🛡️ Core Operating Principles

1. **Decision Support, Not Fraud Adjudication:** ClaimShield Nexus never declares fraud. It flags statistical anomalies, correlates syndicates, synthesizes evidence, and calculates transparent risk metrics to support human investigator adjudication.
2. **Synthetic Environment & Zero PHI:** 100% synthetic data generated with deterministic `RANDOM_SEED = 42` and `AS_OF_DATE = 2026-03-31`. Persistent `SYNTHETIC ENVIRONMENT` badge is rendered on all screens.
3. **No Hardcoded Figures:** Every claim count, risk score, financial exposure dollar amount, confidence percentage, and priority rank is computed dynamically by the analytical pipeline.
4. **Transparent 5-Component Risk Model:** Scores (0–100) are broken down into Behavior (/30), Network (/25), Anomaly (/15), History (/15), and Temporal (/15) points.
5. **Decoy Protection & Ground Truth Validation:** Legitimate high-volume facilities (e.g., Metro General University Medical Center) and practices (Summit Comprehensive Orthopedics) are protected by peer normalization and hub isolation, resulting in **0 false alarms**.

---

## 🚀 Quick Start (One-Command Setup)

### Option 1: One-Click Startup (Windows)
Double-click or run:
```bat
start.bat
```
This automatically seeds the SQLite database (`backend/claimshield.db`) and launches both the FastAPI backend and Vite frontend.

### Option 2: Step-by-Step Manual Launch
1. **Seed Synthetic Warehouse & Analytical Models:**
   ```bash
   python backend/run_seed.py
   ```
2. **Start Backend Server:**
   ```bash
   run_backend.bat
   # Or: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
   *FastAPI Docs:* http://127.0.0.1:8000/docs

3. **Start Frontend Client:**
   ```bash
   run_frontend.bat
   # Or: cd frontend && npm run dev
   ```
   *Web Application:* http://127.0.0.1:5173

---

## 🧩 Architectural Pipeline

```
Raw Claims Ingested (18,000+)
       │
       ▼
Deterministic Rule Engines (8 Engines: Duplicates, Unbundling, Phantom Services, Timing, Excessive Utilization, Upcoding, Referral Concentration, Shared Identity)
       │
       ▼
Peer-Normalized Isolation Forest (Pure NumPy Implementation of Liu et al. 2008)
       │
       ▼
Weighted Entity Graph & Louvain Community Detection (Hub node isolation to prevent giant components)
       │
       ▼
Risk Scoring & Exposure Deduplication (Sum of paid_amount over unique flagged claims)
       │
       ▼
30d / 60d / 90d Pre-Cutoff Escalation Forecasting (Logistic Regression without label leakage)
       │
       ▼
SIU Capacity-Constrained Priority Queue (5 Dynamic Ranking Strategies)
       │
       ▼
Investigation Workspace & Human Adjudication (Evidence tables, timeline, and audit logging)
```

---

## 🖥️ Screen Guide & User Personas

| Module | Route / Page | Features |
|---|---|---|
| **Command Center** | `/` | Alert-reduction funnel (99.9% volume compression), Ground Truth evaluation card (100% recall, 0 decoy flags), top risk providers table, signal type distribution. |
| **Demo Mode** | `Demo Mode` | 4 planted scenarios (SC-01 to SC-04). Real-time Server-Sent Events (SSE) streaming execution of all 8 pipeline stages with live terminal logs and instant entity overlap matching. |
| **SIU Queue** | `SIU Queue` | 5 ranking strategies (Balanced, Financial Exposure, Member Impact, Evidence Strength, Severity), capacity constraint banner, filterable dossier table. |
| **Investigation Workspace** | `Investigations` | Executive brief, 5-factor risk score breakdown, supporting claims evidence tables, chronological case timeline, network context, horizon-specific forecast cards, and official human adjudication bar. |
| **Network Explorer** | `Network Explorer` | Interactive force-directed SVG graph with pan/zoom, node type filtering (Provider, Facility, Member), labeled relationship edges, and 360-degree Entity Intelligence drawer. |
| **Claims Intelligence** | `Claims Intelligence` | Multi-field search, service line filters, flagged claim highlights, and 360 claim dossier with temporal neighbor claims (±3 days). |
| **Risk Forecast** | `Risk Forecast` | Multi-horizon model comparison (30d/60d/90d), ROC-AUC holdout metrics, predictive feature drivers, and uncertainty notice. |
| **Data Warehouse** | `Data` | Database statistics, freshness, sample tables, and one-click synthetic reload. |
| **Administration** | `Administration` | (Program Manager only) Rule engine toggles, threshold sliders, capacity config, and subsystem health telemetry. |

---

## 🧪 Automated Test Suite

ClaimShield Nexus includes a comprehensive 26-test suite covering every backend engine, rule, endpoint, and ground-truth validation:

```bash
python -m pytest backend/tests/ -v
```

### Verified Test Coverage:
- `test_api_basic.py`: Health check, data stats, config persistence, and audit logging.
- `test_claims_and_eval.py`: Claims filtering, pagination, 360 detail, and evaluation funnel metrics.
- `test_clustering.py`: Louvain community detection, giant-component bounds (<25%), and sequential case IDs.
- `test_demo_mode.py`: Scenario listing, SSE real pipeline streaming, and entity overlap matching.
- `test_detection.py`: 8 deterministic rules, JSON evidence payloads, Isolation Forest anomaly scoring, and decoy hospital protection.
- `test_generator.py`: Deterministic synthetic generator, planted scenarios, decoys, and foreign key integrity.
- `test_investigation_brief.py`: Forecast training, case dossier API, human decision recording, and audit trail.
- `test_network.py`: Network graph nodes/edges, scoped case subgraphs, and 360 entity intelligence.
- `test_siu_queue.py`: Priority scoring formulas, 5-strategy reranking, and investigation capacity constraints.

---

## ⚖️ Responsible AI & Governance

- **Decision Support Only:** ClaimShield Nexus never declares fraud or replaces human judgment.
- **Uncertainty Safeguard:** When evidence strength is *Limited* or critical fields are missing, the system automatically caps recommendations at *Request More Evidence*.
- **Audit Logging:** Every human adjudication (action, role, reason, timestamp) is permanently recorded in the immutable `audit_log` SQLite table.
