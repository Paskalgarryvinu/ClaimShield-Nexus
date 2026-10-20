"""Tests for Phase 3: Case Formation and Risk Scoring."""
import json
import pytest
from app.clustering.graph_clustering import form_cases
from app.scoring.metrics import calculate_case_metrics_and_persist
from app.detection.anomaly import train_and_score_isolation_forest
from app.database import query_all, query_one

def test_case_formation_and_clustering():
    scores = train_and_score_isolation_forest()
    raw_cases = form_cases()
    assert len(raw_cases) > 0, "Graph clustering should produce candidate cases"

    scored_cases = calculate_case_metrics_and_persist(raw_cases, scores)
    assert len(scored_cases) > 0

    # 1. Sequential Case IDs
    case_ids = [c["case_id"] for c in scored_cases]
    assert case_ids[0] == "CS-0001"
    assert case_ids[1] == "CS-0002"

    # 2. No Giant Component: largest case holds < 25% of all entities in the graph
    total_entities = query_one("SELECT COUNT(*) as c FROM providers")["c"]
    for c in scored_cases:
        assert len(c["entities"]) < total_entities * 0.25, f"Case {c['case_id']} is too large (giant component violation)"

    # 3. Deduplicated Exposure: check that exposure equals sum of unique claim paid amounts
    top_case = scored_cases[0]
    cid = top_case["case_id"]
    db_claims = query_all(
        "SELECT DISTINCT cl.claim_id, cl.paid_amount FROM case_claims cc JOIN claims cl ON cc.claim_id = cl.claim_id WHERE cc.case_id = ?",
        (cid,)
    )
    expected_exposure = round(sum(c["paid_amount"] for c in db_claims), 2)
    assert abs(top_case["exposure_amount"] - expected_exposure) < 0.05, "Exposure must be deduplicated across signals"

    # 4. Mandatory Decoy Isolation: Decoys must NOT be members of cases
    decoy_members = query_all(
        "SELECT * FROM case_members WHERE entity_id IN ('FAC-DECOY-METRO', 'PRV-DECOY-ORTHO')"
    )
    assert len(decoy_members) == 0, "Decoys must never be merged into case clusters"

    # 5. Score ranges and breakdown
    for c in scored_cases:
        assert 0.0 <= c["risk_score"] <= 100.0
        assert 0.0 <= c["confidence_score"] <= 100.0
        assert c["risk_band"] in ["NORMAL", "MONITORED", "ELEVATED", "HIGH", "CRITICAL"]
        assert c["evidence_strength"] in ["Limited", "Moderate", "Strong"]
        assert c["member_impact_level"] in ["Low", "Medium", "High", "Critical"]
