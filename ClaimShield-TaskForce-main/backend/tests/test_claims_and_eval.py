"""Tests for Claims Intelligence and Evaluation Funnel APIs."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_claims_list_and_pagination():
    resp = client.get("/api/claims?page=1&page_size=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) == 10
    assert data["total"] > 1000
    assert data["page"] == 1
    assert "is_flagged" in data["items"][0]

def test_claims_filtering_and_search():
    resp = client.get("/api/claims?service_type=professional&page_size=5")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["service_type"] == "professional"

def test_claim_detail():
    # Fetch first claim ID from listing
    list_resp = client.get("/api/claims?page_size=1")
    cid = list_resp.json()["items"][0]["claim_id"]

    resp = client.get(f"/api/claims/{cid}")
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["claim_id"] == cid
    assert "provider_name" in detail
    assert "associated_cases" in detail
    assert "signals" in detail

def test_evaluation_and_funnel_metrics():
    resp = client.get("/api/evaluation/metrics")
    assert resp.status_code == 200
    data = resp.json()

    # Funnel checks
    assert "funnel" in data
    funnel = data["funnel"]
    assert funnel["raw_claims"] > 10000
    assert funnel["signals_detected"] > 0
    assert funnel["cases_formed"] > 0
    assert funnel["priority_investigations"] > 0
    assert funnel["reduction_percentage"] > 90.0

    # Decoy checks
    assert "evaluation" in data
    eval_data = data["evaluation"]
    assert eval_data["decoy_false_positives"] == 0
    assert "PASS" in eval_data["decoy_protection_status"]
    assert eval_data["scenario_recall_pct"] >= 80.0
