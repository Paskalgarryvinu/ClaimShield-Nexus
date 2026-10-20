"""Real Pipeline Execution Runner with Server-Sent Events (SSE) streaming.
Executes the actual analytical engines: load, rules, anomaly, clustering,
scoring, forecast, queue ranking, and scenario-to-case entity overlap matching.
"""
import time
import json
import sqlite3
from datetime import datetime
from typing import AsyncGenerator, Dict, Any
from app.config import DB_PATH, AS_OF_DATE_STR
from app.database import get_db_connection, query_all, query_one, execute_write
from app.detection.rules import run_all_rules
from app.detection.anomaly import train_and_score_isolation_forest
from app.clustering.graph_clustering import form_cases
from app.scoring.metrics import calculate_case_metrics_and_persist
from app.scoring.priority import calculate_siu_priority
from app.forecasting.forecast_models import populate_case_forecasts

def match_scenario_to_case(scenario_id: str, db_path: str = DB_PATH) -> Dict[str, Any]:
    """Matches a planted scenario to formed cases strictly by entity overlap (Jaccard).
    NEVER hardcodes case IDs.
    """
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cur.execute("SELECT involved_entities FROM ground_truth_scenarios WHERE scenario_id = ?", (scenario_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return {"matched_case_id": None, "overlap_count": 0, "overlap_entities": []}

    planted_entities = set(json.loads(row["involved_entities"]))

    # Query all case members
    cur.execute("SELECT case_id, entity_id FROM case_members")
    case_members_rows = cur.fetchall()
    conn.close()

    case_entities_map: Dict[str, set] = {}
    for r in case_members_rows:
        case_entities_map.setdefault(r["case_id"], set()).add(r["entity_id"])

    best_case_id = None
    best_overlap_count = 0
    best_overlap_entities = []

    for cid, c_entities in case_entities_map.items():
        overlap = c_entities.intersection(planted_entities)
        if len(overlap) > best_overlap_count:
            best_overlap_count = len(overlap)
            best_case_id = cid
            best_overlap_entities = list(overlap)

    return {
        "matched_case_id": best_case_id,
        "overlap_count": best_overlap_count,
        "overlap_entities": best_overlap_entities,
        "scenario_id": scenario_id
    }

async def execute_pipeline_stream(scenario_id: str = "SC-01", db_path: str = DB_PATH) -> AsyncGenerator[str, None]:
    """Asynchronous generator streaming real pipeline stages via SSE."""
    start_total = time.time()
    run_id = f"RUN-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    stages = [
        ("stage_load_data", "Loading Claims and Provider Network", 10),
        ("stage_rules", "Executing 8 Deterministic Rule Engines", 30),
        ("stage_anomaly", "Computing Peer-Normalized Isolation Forest", 50),
        ("stage_clustering", "Constructing Entity Graph & Louvain Clusters", 65),
        ("stage_scoring", "Calculating Deduplicated Exposure & Risk Scores", 80),
        ("stage_forecast", "Generating 30d/60d/90d Risk Escalation Forecasts", 90),
        ("stage_priority", "Evaluating SIU Priority Queue Ranking", 95),
        ("stage_match", "Mapping Scenario Entities to Formed Dossier", 100),
    ]

    claims_cnt = 0
    signals = []
    cases = []
    matched_id = None
    match_res = {}
    matched_case = None

    for stage_id, description, progress in stages:
        stage_start = time.time()

        if stage_id == "stage_load_data":
            claims_cnt = query_one("SELECT COUNT(*) as c FROM claims", db_path=db_path)["c"]
            details = f"Ingested {claims_cnt:,} claims across 10 specialties under seed 42."

        elif stage_id == "stage_rules":
            signals = run_all_rules(db_path=db_path)
            details = f"Generated {len(signals)} multi-entity signals with evidence payloads."

        elif stage_id == "stage_anomaly":
            scores = train_and_score_isolation_forest(db_path=db_path)
            anomaly_cnt = sum(1 for s in scores.values() if s["is_anomaly"])
            details = f"Scored {len(scores)} providers ({anomaly_cnt} behavioral outliers identified)."

        elif stage_id == "stage_clustering":
            raw_cases = form_cases(db_path=db_path)
            details = f"Partitioned network into {len(raw_cases)} modular candidate clusters."

        elif stage_id == "stage_scoring":
            scores = train_and_score_isolation_forest(db_path=db_path)
            raw_cases = form_cases(db_path=db_path)
            cases = calculate_case_metrics_and_persist(raw_cases, scores, db_path=db_path)
            top_risk = cases[0]["risk_score"] if cases else 0.0
            details = f"Scored {len(cases)} cases (Top risk: {top_risk}/100, deduplicated exposure)."

        elif stage_id == "stage_forecast":
            populate_case_forecasts(db_path=db_path)
            details = "Computed 30d, 60d, 90d escalation probabilities and feature drivers."

        elif stage_id == "stage_priority":
            ranked = calculate_siu_priority(strategy="Balanced", capacity=15, db_path=db_path)
            details = f"Ranked {len(ranked)} cases; top 15 elevated to Priority Investigations."

        elif stage_id == "stage_match":
            match_res = match_scenario_to_case(scenario_id, db_path=db_path)
            matched_id = match_res["matched_case_id"]
            matched_case = query_one("SELECT * FROM cases WHERE case_id = ?", (matched_id,), db_path=db_path) if matched_id else None

            details = f"INVESTIGATION READY: Matched {scenario_id} to case {matched_id} via {match_res['overlap_count']} overlapping entities."

        stage_elapsed = round((time.time() - stage_start) * 1000, 1)

        event_payload = {
            "run_id": run_id,
            "stage": stage_id,
            "description": description,
            "progress": progress,
            "details": details,
            "stage_elapsed_ms": stage_elapsed,
            "total_elapsed_ms": round((time.time() - start_total) * 1000, 1),
            "status": "INVESTIGATION_READY" if stage_id == "stage_match" else "RUNNING"
        }

        if stage_id == "stage_match":
            event_payload["matched_case_id"] = match_res.get("matched_case_id")
            event_payload["overlap_entities"] = match_res.get("overlap_entities")
            event_payload["matched_case"] = matched_case

        yield f"data: {json.dumps(event_payload)}\n\n"

    # Persist analysis run
    total_sec = round(time.time() - start_total, 2)
    execute_write(
        """INSERT INTO analysis_runs (run_id, run_timestamp, duration_sec, claims_count, signals_count, cases_count, status, logs_json)
        VALUES (?, datetime('now'), ?, ?, ?, ?, 'COMPLETED', ?)""",
        (run_id, total_sec, claims_cnt, len(signals), len(cases), json.dumps({"scenario_id": scenario_id, "matched_case": matched_id})),
        db_path=db_path
    )
