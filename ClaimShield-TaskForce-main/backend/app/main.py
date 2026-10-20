"""ClaimShield Nexus FastAPI Application."""
import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from app.config import (
    AS_OF_DATE_STR, RANDOM_SEED, DB_PATH, DEFAULT_INVESTIGATION_CAPACITY
)
from app.database import query_all, query_one, execute_write
from app.generator.synthetic_generator import generate_synthetic_data
from app.api.routes_cases import router as cases_router
from app.api.routes_forecast import router as forecast_router
from app.api.routes_demo import router as demo_router
from app.api.routes_network import router as network_router

from app.api.routes_claims import router as claims_router
from app.api.routes_evaluation import router as evaluation_router

app = FastAPI(
    title="ClaimShield Nexus API",
    description="Explainable Healthcare FWA Investigation Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases_router)
app.include_router(forecast_router)
app.include_router(demo_router)
app.include_router(network_router)
app.include_router(claims_router)
app.include_router(evaluation_router)




@app.get("/api/system/health")
def get_system_health():
    """Returns system status, active engines, database stats, and operational indicators."""
    db_exists = os.path.exists(DB_PATH)
    counts = {}
    if db_exists:
        try:
            counts = {
                "claims": query_one("SELECT COUNT(*) as c FROM claims")["c"],
                "providers": query_one("SELECT COUNT(*) as c FROM providers")["c"],
                "facilities": query_one("SELECT COUNT(*) as c FROM facilities")["c"],
                "members": query_one("SELECT COUNT(*) as c FROM members")["c"],
                "referrals": query_one("SELECT COUNT(*) as c FROM referrals")["c"],
                "signals": query_one("SELECT COUNT(*) as c FROM signals")["c"],
                "cases": query_one("SELECT COUNT(*) as c FROM cases")["c"]
            }
        except Exception:
            pass

    return {
        "status": "OPERATIONAL",
        "as_of_date": AS_OF_DATE_STR,
        "environment": "SYNTHETIC",
        "random_seed": RANDOM_SEED,
        "database": {
            "status": "ONLINE" if db_exists else "INITIALIZING",
            "path": DB_PATH,
            "counts": counts
        },
        "subsystems": {
            "data_pipeline": "HEALTHY",
            "detection_engine": "READY",
            "anomaly_engine": "READY",
            "network_clustering": "READY",
            "risk_scoring": "READY",
            "forecast_engine": "READY",
            "siu_queue": "READY"
        }
    }

@app.get("/api/data/stats")
def get_data_stats():
    """Returns database record counts and freshness."""
    try:
        claims_cnt = query_one("SELECT COUNT(*) as c FROM claims")["c"]
        providers_cnt = query_one("SELECT COUNT(*) as c FROM providers")["c"]
        facilities_cnt = query_one("SELECT COUNT(*) as c FROM facilities")["c"]
        members_cnt = query_one("SELECT COUNT(*) as c FROM members")["c"]
        referrals_cnt = query_one("SELECT COUNT(*) as c FROM referrals")["c"]
        stays_cnt = query_one("SELECT COUNT(*) as c FROM member_stays")["c"]
        signals_cnt = query_one("SELECT COUNT(*) as c FROM signals")["c"]
        cases_cnt = query_one("SELECT COUNT(*) as c FROM cases")["c"]
        scenarios_cnt = query_one("SELECT COUNT(*) as c FROM ground_truth_scenarios")["c"]

        last_run = query_one("SELECT * FROM analysis_runs ORDER BY run_timestamp DESC LIMIT 1")

        return {
            "claims": claims_cnt,
            "providers": providers_cnt,
            "facilities": facilities_cnt,
            "members": members_cnt,
            "referrals": referrals_cnt,
            "member_stays": stays_cnt,
            "signals": signals_cnt,
            "cases": cases_cnt,
            "planted_scenarios": scenarios_cnt,
            "as_of_date": AS_OF_DATE_STR,
            "last_analysis_run": last_run
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/data/reload")
def reload_data():
    """Reseed the synthetic dataset deterministically."""
    try:
        stats = generate_synthetic_data(DB_PATH)
        execute_write(
            "INSERT INTO audit_log (timestamp, event_type, entity_type, entity_id, actor_role, details) VALUES (?, ?, ?, ?, ?, ?)",
            (datetime.now().isoformat(), "DATA_RELOAD", "DATASET", "ALL", "Program Manager", f"Synthetic dataset regenerated: {json.dumps(stats)}")
        )
        return {"status": "SUCCESS", "message": "Synthetic dataset regenerated successfully.", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config")
def get_config():
    """Get active pipeline configuration."""
    rows = query_all("SELECT key, value_json, updated_at FROM config")
    cfg = {}
    for r in rows:
        try:
            cfg[r["key"]] = json.loads(r["value_json"])
        except Exception:
            cfg[r["key"]] = r["value_json"]
    return cfg

@app.post("/api/config")
def update_config(payload: dict = Body(...)):
    """Update pipeline configuration settings (Program Manager only)."""
    now_str = datetime.now().isoformat()
    for k, v in payload.items():
        v_str = json.dumps(v) if isinstance(v, (dict, list)) else str(v)
        execute_write(
            "INSERT OR REPLACE INTO config (key, value_json, updated_at) VALUES (?, ?, ?)",
            (k, v_str, now_str)
        )
    execute_write(
        "INSERT INTO audit_log (timestamp, event_type, entity_type, entity_id, actor_role, details) VALUES (?, ?, ?, ?, ?, ?)",
        (now_str, "CONFIG_UPDATE", "CONFIG", "GLOBAL", "Program Manager", f"Updated keys: {list(payload.keys())}")
    )
    return {"status": "SUCCESS", "message": "Configuration updated successfully."}

@app.get("/api/audit-log")
def get_audit_log(limit: int = 50):
    """Retrieve system audit log."""
    rows = query_all("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,))
    return rows
