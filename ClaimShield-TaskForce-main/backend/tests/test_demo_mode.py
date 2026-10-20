"""Tests for Phase 6: Demo Mode and SSE Real Pipeline Streaming."""
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.pipeline.runner import match_scenario_to_case

client = TestClient(app)

def test_demo_scenarios_listing():
    resp = client.get("/api/demo/scenarios")
    assert resp.status_code == 200
    scenarios = resp.json()
    assert len(scenarios) == 4
    s_ids = [s["scenario_id"] for s in scenarios]
    assert "SC-01" in s_ids
    assert "SC-02" in s_ids
    assert "SC-03" in s_ids
    assert "SC-04" in s_ids

def test_scenario_to_case_entity_overlap():
    for sc_id in ["SC-01", "SC-02", "SC-03", "SC-04"]:
        match_res = match_scenario_to_case(sc_id)
        assert match_res["matched_case_id"] is not None, f"Scenario {sc_id} must match to a clustered case"
        assert match_res["overlap_count"] >= 1, f"Scenario {sc_id} must have overlapping entities"
        assert len(match_res["overlap_entities"]) >= 1

def test_sse_pipeline_streaming():
    with client.stream("GET", "/api/demo/run-scenario?scenario_id=SC-01") as resp:
        assert resp.status_code == 200
        events = []
        for line in resp.iter_lines():
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                events.append(payload)

        assert len(events) >= 5, "SSE stream must yield multiple stage events"
        # Verify final event is INVESTIGATION_READY
        final_evt = events[-1]
        assert final_evt["status"] == "INVESTIGATION_READY"
        assert final_evt["matched_case_id"] is not None
        assert len(final_evt["overlap_entities"]) >= 1
