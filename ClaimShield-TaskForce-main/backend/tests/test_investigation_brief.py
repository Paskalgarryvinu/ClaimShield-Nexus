"""Tests for Phase 5: Investigation Workspace, Forecast Models, and Human Adjudication."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.forecasting.forecast_models import train_forecast_models, populate_case_forecasts
from app.database import query_all, query_one

client = TestClient(app)

def test_forecast_training_and_population():
    meta = train_forecast_models()
    assert "metrics" in meta
    for h in ["30", "60", "90"]:
        assert h in meta["metrics"]
        m = meta["metrics"][h]
        assert m["holdout_auc"] >= 0.70, f"Holdout AUC for {h}d should be >= 0.70"

    count = populate_case_forecasts()
    assert count > 0

    # Test API endpoint
    resp = client.get("/api/forecast?horizon=60")
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_horizon"] == 60
    assert "holdout_metrics" in data

def test_investigation_case_detail_api():
    top_case = query_one("SELECT case_id FROM cases LIMIT 1")
    cid = top_case["case_id"]

    resp = client.get(f"/api/cases/{cid}?horizon=30")
    assert resp.status_code == 200
    dossier = resp.json()
    assert "case" in dossier
    assert "risk_breakdown" in dossier
    assert "signals" in dossier
    assert "claims" in dossier
    assert "forecast" in dossier

def test_human_decision_recording_and_audit():
    top_case = query_one("SELECT case_id FROM cases LIMIT 1")
    cid = top_case["case_id"]

    # Record decision
    payload = {
        "action": "REQUEST_MORE_EVIDENCE",
        "reason": "Requesting medical chart documentation and provider service records.",
        "role": "Investigator"
    }
    resp = client.post(f"/api/cases/{cid}/decision", json=payload)
    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "SUCCESS"
    assert res["new_status"] == "EVIDENCE REQUESTED"

    # Verify case status updated in DB
    updated_case = query_one("SELECT status FROM cases WHERE case_id = ?", (cid,))
    assert updated_case["status"] == "EVIDENCE REQUESTED"

    # Verify audit event written
    audit_evt = query_one("SELECT * FROM audit_log WHERE entity_id = ? ORDER BY timestamp DESC LIMIT 1", (cid,))
    assert audit_evt is not None
    assert audit_evt["event_type"] == "HUMAN_DECISION"
    assert "REQUEST_MORE_EVIDENCE" in audit_evt["details"]
