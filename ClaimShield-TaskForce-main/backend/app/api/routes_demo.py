"""Demo Mode API routes with SSE streaming."""
import json
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from app.database import query_all, query_one
from app.pipeline.runner import execute_pipeline_stream

router = APIRouter(prefix="/api/demo", tags=["demo"])

@router.get("/scenarios")
def get_demo_scenarios():
    """Retrieve the 4 planted live demo scenarios."""
    scenarios = [
        {
            "scenario_id": "SC-01",
            "name": "01 Coordinated Billing Network",
            "pattern": "Multi-provider syndicate sharing corporate identity, referral loops, duplicate claims, and escalating volume.",
            "main_signals": ["Shared Identity Linkage", "Referral Concentration", "Duplicate Billing", "Excessive Utilization"],
            "planted_entities": ["PRV-SC01-A", "PRV-SC01-B", "PRV-SC01-C", "PRV-SC01-D", "FAC-SC01-METRO"],
            "expected_risk_band": "HIGH",
            "is_primary": True
        },
        {
            "scenario_id": "SC-02",
            "name": "02 Impossible Timing / Phantom Service",
            "pattern": "Services billed during inpatient stays at external hospitals, claims after coverage termination, and distant travel contradictions.",
            "main_signals": ["Potential Phantom Service", "Impossible Timing", "Post-Coverage Billing"],
            "planted_entities": ["PRV-SC02-PHANTOM", "FAC-SC02-RURAL", "MBR-SC02-EXPIRED", "MBR-SC02-INPATIENT", "MBR-SC02-TRAVEL"],
            "expected_risk_band": "HIGH",
            "is_primary": False
        },
        {
            "scenario_id": "SC-03",
            "name": "03 Duplicate Billing + Unbundling",
            "pattern": "Repetitive near-identical procedure billing within 48h and component codes billed separately where surgical bundles exist.",
            "main_signals": ["Duplicate Billing", "Potential Unbundling Pattern", "Shared Identity Linkage"],
            "planted_entities": ["PRV-SC03-DUP", "PRV-SC03-ASSIST", "FAC-SC03-CLINIC"],
            "expected_risk_band": "HIGH",
            "is_primary": False
        },
        {
            "scenario_id": "SC-04",
            "name": "04 Referral Concentration + Excessive Utilization",
            "pattern": "92% referral funnel channeled to a single partner clinic with therapy utilization exceeding peer standard deviation by 5x.",
            "main_signals": ["Referral Concentration Pattern", "Excessive Utilization Outlier"],
            "planted_entities": ["PRV-SC04-REFERRAL", "PRV-SC04-TARGET", "FAC-SC04-CENTER"],
            "expected_risk_band": "HIGH",
            "is_primary": False
        }
    ]
    return scenarios

@router.get("/run-scenario")
async def run_scenario_stream(scenario_id: str = Query("SC-01")):
    """Streams real pipeline execution over Server-Sent Events (SSE)."""
    return StreamingResponse(
        execute_pipeline_stream(scenario_id=scenario_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
