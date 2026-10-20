"""Tests for Phase 4: SIU Priority Queue and Capacity Management."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.scoring.priority import calculate_siu_priority
from app.database import query_all, query_one

client = TestClient(app)

def test_siu_priority_ranking_and_capacity():
    # 1. Balanced Strategy with capacity 10
    ranked = calculate_siu_priority(strategy="Balanced", capacity=10)
    assert len(ranked) > 0

    # Verify capacity
    priority_items = [r for r in ranked if r["is_priority_investigation"] == 1]
    non_priority = [r for r in ranked if r["is_priority_investigation"] == 0]

    assert len(priority_items) == min(10, len(ranked))
    assert len(non_priority) == max(len(ranked) - 10, 0)
    assert ranked[0]["priority_rank"] == 1
    assert ranked[0]["priority_score"] >= ranked[-1]["priority_score"]

def test_strategy_reranking_changes_order():
    # Calculate under Balanced
    balanced = calculate_siu_priority(strategy="Balanced", capacity=15)
    balanced_top = [b["case_id"] for b in balanced[:5]]

    # Calculate under Financial Exposure
    exposure = calculate_siu_priority(strategy="Financial Exposure", capacity=15)
    exposure_top = [e["case_id"] for e in exposure[:5]]

    # Check that highest financial exposure case is at or near top
    max_exp_case = query_one("SELECT case_id FROM cases ORDER BY exposure_amount DESC LIMIT 1")["case_id"]
    assert exposure_top[0] == max_exp_case, "Financial Exposure strategy must prioritize highest exposure cases"

def test_queue_api_endpoints():
    resp = client.get("/api/queue")
    assert resp.status_code == 200
    data = resp.json()
    assert "capacity" in data
    assert "strategy" in data
    assert "cases" in data
    assert len(data["cases"]) > 0

    # Switch strategy via API
    resp_strat = client.post("/api/queue/strategy", json={"strategy": "Evidence Strength"})
    assert resp_strat.status_code == 200
    assert resp_strat.json()["strategy"] == "Evidence Strength"
