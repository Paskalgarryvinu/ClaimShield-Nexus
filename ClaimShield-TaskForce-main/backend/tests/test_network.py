"""Tests for Phase 7: Network Explorer and Entity Intelligence."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_network_graph_global():
    resp = client.get("/api/network/graph?limit=50")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) > 0
    assert len(data["edges"]) > 0

def test_network_graph_case_filter():
    resp = client.get("/api/network/graph?case_id=CS-0001")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert data["case_id"] == "CS-0001"
    # Verify nodes in case have in_case = True
    in_case_nodes = [n for n in data["nodes"] if n.get("in_case")]
    assert len(in_case_nodes) > 0

def test_entity_intelligence_provider():
    # Test on a known planted provider
    resp = client.get("/api/network/entity/provider/PRV-SC01-A")
    assert resp.status_code == 200
    intel = resp.json()
    assert intel["entity_id"] == "PRV-SC01-A"
    assert "profile" in intel
    assert intel["profile"]["provider_id"] == "PRV-SC01-A"
    assert "claim_stats" in intel
    assert intel["claim_stats"]["claim_count"] > 0
    assert "signals" in intel
    assert len(intel["signals"]) > 0
    assert "connected_entities" in intel
    assert len(intel["connected_entities"]) > 0

def test_entity_intelligence_not_found():
    resp = client.get("/api/network/entity/provider/PRV-NONEXISTENT")
    assert resp.status_code == 404

def test_entity_search():
    resp = client.get("/api/network/search?q=SC01")
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) > 0
    types = {r["type"] for r in results}
    assert "provider" in types or "facility" in types
