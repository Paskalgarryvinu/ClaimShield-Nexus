"""Tests for Phase 2: Rule Detection and Isolation Forest Anomaly Engine."""
import json
import pytest
from app.detection.rules import run_all_rules
from app.detection.anomaly import train_and_score_isolation_forest
from app.database import query_all, query_one

def test_rule_detection_and_evidence_payloads():
    signals = run_all_rules()
    assert len(signals) > 0, "Detection engine should generate signals from synthetic data"

    # Verify signals are persisted in SQLite
    db_signals = query_all("SELECT * FROM signals")
    assert len(db_signals) == len(signals)

    # Check signal types present
    signal_types = {s["signal_type"] for s in db_signals}
    expected_types = {
        "duplicate_billing", "unbundling", "phantom_service",
        "impossible_timing", "excessive_utilization",
        "referral_concentration", "shared_identity_linkage"
    }
    for et in expected_types:
        assert et in signal_types, f"Signal type {et} should be detected"

    # Verify each signal has complete evidence payload
    for sig in db_signals[:20]:
        ev = json.loads(sig["evidence_fields"])
        assert "rule" in ev or "identity_type" in ev
        assert sig["severity"] in ["LOW", "MODERATE", "HIGH", "CRITICAL"]
        assert len(sig["description"]) > 10

def test_anomaly_model_and_decoy_protection():
    scores = train_and_score_isolation_forest()
    assert len(scores) >= 1000, "Anomaly scores should be generated for providers"

    # Verify mandatory decoy is protected from false anomaly flag
    decoy = scores.get("PRV-DECOY-ORTHO")
    assert decoy is not None, "PRV-DECOY-ORTHO must have an anomaly score"
    assert decoy["is_anomaly"] is False, "Decoy high-volume orthopedic practice must NOT be flagged as anomaly"
    assert decoy["label"] == "Normal Behavioral Profile"

    # Verify planted syndicate provider has high anomaly score
    sc01_a = scores.get("PRV-SC01-A")
    assert sc01_a is not None
    assert sc01_a["is_anomaly"] is True, "Planted coordinated billing provider PRV-SC01-A must be flagged"
    assert sc01_a["anomaly_score"] >= 0.75
