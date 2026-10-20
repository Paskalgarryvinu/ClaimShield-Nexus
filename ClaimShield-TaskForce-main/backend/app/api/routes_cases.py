"""Case and SIU Queue API routes."""
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Body
from app.config import DEFAULT_INVESTIGATION_CAPACITY, DEFAULT_PRIORITY_STRATEGY
from app.database import query_all, query_one, execute_write
from app.scoring.priority import calculate_siu_priority, STRATEGY_WEIGHTS

router = APIRouter(prefix="/api", tags=["cases"])

@router.get("/queue")
def get_siu_queue(
    strategy: str = Query(None),
    risk_band: str = Query(None),
    status: str = Query(None),
    sort_by: str = Query("priority"),
    search: str = Query(None)
):
    """Retrieve prioritized SIU investigation queue."""
    # Read capacity from config
    cap_row = query_one("SELECT value_json FROM config WHERE key = 'investigation_capacity'")
    capacity = int(cap_row["value_json"]) if cap_row else DEFAULT_INVESTIGATION_CAPACITY

    # Read current strategy from config if not passed
    if not strategy:
        strat_row = query_one("SELECT value_json FROM config WHERE key = 'priority_strategy'")
        strategy = json.loads(strat_row["value_json"]) if strat_row else DEFAULT_PRIORITY_STRATEGY

    # Check if queue_entries exists, if not or strategy changed, calculate
    first_qe = query_one("SELECT strategy_used FROM queue_entries LIMIT 1")
    if not first_qe or first_qe["strategy_used"] != strategy:
        calculate_siu_priority(strategy=strategy, capacity=capacity)

    sql = """
        SELECT c.*, q.priority_score, q.priority_rank, q.is_priority_investigation, q.strategy_used
        FROM cases c
        JOIN queue_entries q ON c.case_id = q.case_id
        WHERE 1=1
    """
    params = []

    if risk_band and risk_band != "ALL":
        sql += " AND c.risk_band = ?"
        params.append(risk_band)

    if status and status != "ALL":
        sql += " AND c.status = ?"
        params.append(status)

    if search:
        sql += " AND (c.case_id LIKE ? OR c.case_type LIKE ? OR c.primary_provider_id LIKE ?)"
        s_wild = f"%{search}%"
        params.extend([s_wild, s_wild, s_wild])

    # Sorting
    if sort_by == "risk":
        sql += " ORDER BY c.risk_score DESC"
    elif sort_by == "exposure":
        sql += " ORDER BY c.exposure_amount DESC"
    elif sort_by == "confidence":
        sql += " ORDER BY c.confidence_score DESC"
    else:
        sql += " ORDER BY q.priority_rank ASC"

    rows = query_all(sql, tuple(params))

    # Parse JSON fields
    for r in rows:
        if r.get("confidence_breakdown"):
            try:
                r["confidence_breakdown"] = json.loads(r["confidence_breakdown"])
            except Exception:
                pass
        r["is_low_confidence"] = bool(r.get("confidence_score", 0) < 40.0)

    total_ranked = query_one("SELECT COUNT(*) as c FROM cases")["c"]
    priority_count = query_one("SELECT COUNT(*) as c FROM queue_entries WHERE is_priority_investigation = 1")["c"]

    return {
        "capacity": capacity,
        "strategy": strategy,
        "available_strategies": list(STRATEGY_WEIGHTS.keys()),
        "total_cases_ranked": total_ranked,
        "priority_investigations_selected": priority_count,
        "cases": rows
    }

@router.post("/queue/strategy")
def set_queue_strategy(payload: dict = Body(...)):
    """Recalculate SIU priority queue under a new strategy."""
    strat = payload.get("strategy", "Balanced")
    cap_row = query_one("SELECT value_json FROM config WHERE key = 'investigation_capacity'")
    capacity = int(cap_row["value_json"]) if cap_row else DEFAULT_INVESTIGATION_CAPACITY

    ranked = calculate_siu_priority(strategy=strat, capacity=capacity)
    return {
        "status": "SUCCESS",
        "strategy": strat,
        "capacity": capacity,
        "ranked_count": len(ranked)
    }

@router.get("/cases")
def list_cases(limit: int = 100):
    """List all cases with summary statistics."""
    rows = query_all("SELECT * FROM cases ORDER BY risk_score DESC LIMIT ?", (limit,))
    return rows

@router.get("/cases/{case_id}")
def get_case_detail(case_id: str, horizon: int = 30):
    """Retrieve full investigation workspace dossier for a specific case."""
    case = query_one("SELECT * FROM cases WHERE case_id = ?", (case_id,))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Risk score breakdown
    risk_breakdown = query_one("SELECT * FROM risk_scores WHERE case_id = ?", (case_id,))
    if risk_breakdown:
        try:
            risk_breakdown["breakdown"] = json.loads(risk_breakdown["breakdown_json"])
        except Exception:
            pass

    # Confidence breakdown
    if case.get("confidence_breakdown"):
        try:
            case["confidence_breakdown"] = json.loads(case["confidence_breakdown"])
        except Exception:
            pass

    # Involved entities
    members = query_all("SELECT * FROM case_members WHERE case_id = ?", (case_id,))

    # Flagged claims
    claims = query_all("""
        SELECT cl.*, p.provider_name, p.specialty, f.facility_name, m.synthetic_name
        FROM case_claims cc
        JOIN claims cl ON cc.claim_id = cl.claim_id
        LEFT JOIN providers p ON cl.provider_id = p.provider_id
        LEFT JOIN facilities f ON cl.facility_id = f.facility_id
        LEFT JOIN members m ON cl.member_id = m.member_id
        WHERE cc.case_id = ?
        ORDER BY cl.service_date DESC
    """, (case_id,))

    # Signals connected to this case
    case_provider_ids = [m["entity_id"] for m in members if m["entity_type"] == "provider"]
    signals = []
    if case_provider_ids:
        placeholders = ",".join("?" for _ in case_provider_ids)
        signals = query_all(
            f"SELECT * FROM signals WHERE primary_entity_id IN ({placeholders})",
            tuple(case_provider_ids)
        )
        for s in signals:
            try:
                s["evidence_fields"] = json.loads(s["evidence_fields"])
            except Exception:
                pass

    # Forecast for requested horizon
    forecast = query_one(
        "SELECT * FROM forecasts WHERE case_id = ? AND horizon_days = ?",
        (case_id, horizon)
    )
    if forecast:
        try:
            forecast["top_drivers"] = json.loads(forecast["top_drivers"])
        except Exception:
            pass

    # Decision and audit history
    decisions = query_all(
        "SELECT * FROM case_decisions WHERE case_id = ? ORDER BY timestamp DESC",
        (case_id,)
    )

    activity = query_all(
        "SELECT * FROM audit_log WHERE entity_id = ? ORDER BY timestamp DESC",
        (case_id,)
    )

    # Uncertainty handling check
    evidence_str = case.get("evidence_strength", "Limited")
    confidence = case.get("confidence_score", 0.0)
    is_capped = bool(confidence < 45.0 or evidence_str == "Limited")

    return {
        "case": case,
        "risk_breakdown": risk_breakdown,
        "entities": members,
        "claims": claims,
        "signals": signals,
        "forecast": forecast,
        "decisions": decisions,
        "activity": activity,
        "is_uncertainty_capped": is_capped,
        "recommendation_cap_note": "Insufficient evidence for a higher-confidence recommendation. Case capped at REQUEST MORE EVIDENCE." if is_capped else None
    }

@router.post("/cases/{case_id}/decision")
def record_case_decision(case_id: str, payload: dict = Body(...)):
    """Record human investigator adjudication decision with reason and write audit trail."""
    action = payload.get("action")
    reason = payload.get("reason", "").strip()
    role = payload.get("role", "Investigator")

    if not action:
        raise HTTPException(status_code=400, detail="Decision action is required")
    if not reason:
        raise HTTPException(status_code=400, detail="Decision rationale / reason is mandatory")

    valid_actions = {
        "INVESTIGATE": "IN REVIEW",
        "REQUEST_MORE_EVIDENCE": "EVIDENCE REQUESTED",
        "MARK_FALSE_POSITIVE": "FALSE POSITIVE",
        "ESCALATE": "ESCALATED",
        "CLOSE_CASE": "CLOSED"
    }

    new_status = valid_actions.get(action.upper(), "IN REVIEW")
    now_str = datetime.now().isoformat()
    dec_id = f"DEC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # Insert decision
    execute_write(
        """INSERT INTO case_decisions (decision_id, case_id, user_role, action, reason, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (dec_id, case_id, role, action, reason, now_str)
    )

    # Update case status
    execute_write(
        "UPDATE cases SET status = ?, updated_at = ? WHERE case_id = ?",
        (new_status, now_str, case_id)
    )

    # Audit log entry
    execute_write(
        """INSERT INTO audit_log (timestamp, event_type, entity_type, entity_id, actor_role, details)
        VALUES (?, 'HUMAN_DECISION', 'CASE', ?, ?, ?)""",
        (now_str, case_id, role, f"Action: {action} | New Status: {new_status} | Reason: {reason}")
    )

    return {
        "status": "SUCCESS",
        "decision_id": dec_id,
        "case_id": case_id,
        "new_status": new_status,
        "recorded_at": now_str
    }
