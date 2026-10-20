"""Ground Truth Evaluation and Alert-Reduction Funnel Metrics API.
Computes precision, recall, decoy false flag protection verification,
and pipeline alert reduction metrics.
"""
import json
import sqlite3
from typing import Dict, Any, List
from fastapi import APIRouter
from app.config import DB_PATH
from app.database import get_db_connection
from app.pipeline.runner import match_scenario_to_case

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation & Funnel"])

@router.get("/metrics")
def get_evaluation_and_funnel_metrics():
    """Calculates ground truth recall, decoy false alarm protection, and alert-reduction funnel."""
    conn = get_db_connection(DB_PATH)
    cur = conn.cursor()

    # 1. Alert Reduction Funnel
    cur.execute("SELECT COUNT(*) as c FROM claims")
    raw_claims = cur.fetchone()["c"]

    cur.execute("SELECT COUNT(*) as c FROM signals")
    signals_count = cur.fetchone()["c"]

    cur.execute("SELECT COUNT(*) as c FROM cases")
    cases_count = cur.fetchone()["c"]

    cur.execute("SELECT COUNT(*) as c FROM queue_entries WHERE is_priority_investigation = 1")
    priority_count = cur.fetchone()["c"]

    reduction_percentage = round((1.0 - (priority_count / max(raw_claims, 1))) * 100.0, 2)

    # 2. Planted Scenarios Evaluation
    cur.execute("SELECT scenario_id, scenario_name, expected_risk_band, is_decoy, involved_entities FROM ground_truth_scenarios WHERE is_decoy = 0")
    scenarios = cur.fetchall()

    scenario_results = []
    detected_count = 0

    for sc in scenarios:
        sc_id = sc["scenario_id"]
        match_info = match_scenario_to_case(sc_id, db_path=DB_PATH)
        matched_cid = match_info["matched_case_id"]
        overlap = match_info["overlap_count"]

        case_risk_band = None
        case_score = 0.0
        if matched_cid:
            cur.execute("SELECT risk_band, risk_score FROM cases WHERE case_id = ?", (matched_cid,))
            c_row = cur.fetchone()
            if c_row:
                case_risk_band = c_row["risk_band"]
                case_score = c_row["risk_score"]

        is_detected = matched_cid is not None and overlap >= 1 and case_score >= 50.0
        if is_detected:
            detected_count += 1

        scenario_results.append({
            "scenario_id": sc_id,
            "name": sc["scenario_name"],
            "expected_risk_band": sc["expected_risk_band"],
            "matched_case_id": matched_cid,
            "case_score": case_score,
            "case_risk_band": case_risk_band,
            "overlap_count": overlap,
            "is_detected": is_detected
        })

    scenario_recall = round((detected_count / max(len(scenarios), 1)) * 100.0, 1)

    # 3. Decoy Protection Verification
    cur.execute("""
        SELECT COUNT(*) as c FROM case_members cm
        JOIN cases c ON cm.case_id = c.case_id
        WHERE cm.entity_id IN ('FAC-DECOY-METRO', 'PRV-DECOY-ORTHO')
          AND c.risk_band IN ('HIGH', 'CRITICAL')
    """)
    decoys_flagged = cur.fetchone()["c"]

    # 4. Top Risk Providers
    cur.execute("""
        SELECT p.provider_id, p.provider_name, p.specialty, p.risk_history,
               COUNT(c.claim_id) as claim_count, SUM(c.paid_amount) as total_paid,
               (SELECT COUNT(*) FROM signals s WHERE s.primary_entity_id = p.provider_id) as signal_count
        FROM providers p
        JOIN claims c ON p.provider_id = c.provider_id
        GROUP BY p.provider_id
        ORDER BY signal_count DESC, total_paid DESC
        LIMIT 6
    """)
    top_providers = [dict(r) for r in cur.fetchall()]

    # 5. Signal Types Distribution
    cur.execute("""
        SELECT signal_type, COUNT(*) as count
        FROM signals
        GROUP BY signal_type
        ORDER BY count DESC
    """)
    signal_dist = [dict(r) for r in cur.fetchall()]

    # 6. Workload vs Capacity
    cur.execute("SELECT value_json FROM config WHERE key = 'investigation_capacity'")
    cap_row = cur.fetchone()
    capacity = int(json.loads(cap_row["value_json"])) if cap_row else 15

    cur.execute("SELECT status, COUNT(*) as count FROM cases GROUP BY status")
    status_counts = {r["status"]: r["count"] for r in cur.fetchall()}

    conn.close()

    return {
        "funnel": {
            "raw_claims": raw_claims,
            "signals_detected": signals_count,
            "cases_formed": cases_count,
            "priority_investigations": priority_count,
            "reduction_percentage": reduction_percentage
        },
        "evaluation": {
            "scenario_recall_pct": scenario_recall,
            "scenarios_tested": len(scenarios),
            "scenarios_detected": detected_count,
            "decoy_false_positives": decoys_flagged,
            "decoy_protection_status": "PASS (0 decoys flagged as high risk)" if decoys_flagged == 0 else "FAIL",
            "scenario_details": scenario_results,
            "disclaimer": "Evaluation against synthetic ground truth is optimistic compared to noisy real-world payer operations."
        },
        "top_risk_providers": top_providers,
        "signal_distribution": signal_dist,
        "workload": {
            "capacity": capacity,
            "total_cases": cases_count,
            "status_distribution": status_counts
        }
    }
