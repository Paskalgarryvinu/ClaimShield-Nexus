"""Basic API endpoint tests for Phase 1."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_system_health():
    resp = client.get("/api/system/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OPERATIONAL"
    assert data["environment"] == "SYNTHETIC"
    assert data["database"]["status"] == "ONLINE"
    assert data["database"]["counts"]["claims"] >= 15000

def test_data_stats():
    resp = client.get("/api/data/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["claims"] >= 15000
    assert data["providers"] >= 1000
    assert data["facilities"] >= 140
    assert data["planted_scenarios"] >= 5

def test_config_endpoints():
    resp = client.get("/api/config")
    assert resp.status_code == 200
    cfg = resp.json()
    assert "rules_enabled" in cfg
    assert "thresholds" in cfg
    assert "investigation_capacity" in cfg

def test_audit_log_endpoint():
    resp = client.get("/api/audit-log")
    assert resp.status_code == 200
    logs = resp.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1
