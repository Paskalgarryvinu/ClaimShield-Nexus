"""SIU Queue Prioritization and Capacity Ranking Engine.
Computes multi-strategy weighted priority scores and applies investigation capacity constraints.
Changing the strategy actively re-ranks the queue.
"""
import json
import math
import sqlite3
import pandas as pd
import numpy as np
from typing import List, Dict, Any
from app.config import (
    DB_PATH, DEFAULT_INVESTIGATION_CAPACITY, DEFAULT_PRIORITY_STRATEGY
)
from app.database import get_db_connection

STRATEGY_WEIGHTS = {
    "Balanced": {
        "risk": 0.30,
        "exposure": 0.25,
        "member_impact": 0.20,
        "severity": 0.15,
        "evidence": 0.10
    },
    "Financial Exposure": {
        "risk": 0.15,
        "exposure": 0.55,
        "member_impact": 0.05,
        "severity": 0.15,
        "evidence": 0.10
    },
    "Member Impact": {
        "risk": 0.20,
        "exposure": 0.10,
        "member_impact": 0.50,
        "severity": 0.15,
        "evidence": 0.05
    },
    "Evidence Strength": {
        "risk": 0.20,
        "exposure": 0.15,
        "member_impact": 0.05,
        "severity": 0.15,
        "evidence": 0.45
    },
    "Severity": {
        "risk": 0.20,
        "exposure": 0.15,
        "member_impact": 0.10,
        "severity": 0.50,
        "evidence": 0.05
    }
}

IMPACT_NUMERIC = {"Low": 0.25, "Medium": 0.50, "High": 0.75, "Critical": 1.0}
SEVERITY_NUMERIC = {"Low": 0.25, "Moderate": 0.50, "High": 0.75, "Critical": 1.0}
EVIDENCE_NUMERIC = {"Limited": 0.33, "Moderate": 0.66, "Strong": 1.0}

def calculate_siu_priority(
    strategy: str = DEFAULT_PRIORITY_STRATEGY,
    capacity: int = DEFAULT_INVESTIGATION_CAPACITY,
    db_path: str = DB_PATH
) -> List[Dict[str, Any]]:
    """Calculates prioritized rank order for all cases under selected strategy and capacity."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    cases_df = pd.read_sql_query("SELECT * FROM cases", conn)
    if cases_df.empty:
        conn.close()
        return []

    # Strategy validation
    if strategy not in STRATEGY_WEIGHTS:
        strategy = "Balanced"
    weights = STRATEGY_WEIGHTS[strategy]

    # Find max exposure for normalization
    max_exp = float(cases_df["exposure_amount"].max())

    ranked_items = []
    for _, c in cases_df.iterrows():
        cid = c["case_id"]
        risk = float(c["risk_score"]) / 100.0
        exp = float(c["exposure_amount"]) / max(max_exp, 1.0)
        impact = IMPACT_NUMERIC.get(c["member_impact_level"], 0.25)
        sev = SEVERITY_NUMERIC.get(c["severity_level"], 0.25)
        ev_str = EVIDENCE_NUMERIC.get(c["evidence_strength"], 0.33)


        priority_raw = (
            weights["risk"] * risk +
            weights["exposure"] * exp +
            weights["member_impact"] * impact +
            weights["severity"] * sev +
            weights["evidence"] * ev_str
        )
        priority_score = round(min(priority_raw * 100.0, 100.0), 1)

        ranked_items.append({
            "case_id": cid,
            "case_type": c["case_type"],
            "risk_score": float(c["risk_score"]),
            "risk_band": c["risk_band"],
            "exposure_amount": float(c["exposure_amount"]),
            "member_impact_level": c["member_impact_level"],
            "member_count": int(c["member_count"]),
            "severity_level": c["severity_level"],
            "evidence_strength": c["evidence_strength"],
            "confidence_score": float(c["confidence_score"]),
            "status": c["status"],
            "primary_provider_id": c["primary_provider_id"],
            "priority_score": priority_score
        })

    # Sort descending by priority score
    ranked_items.sort(key=lambda x: (x["priority_score"], x["exposure_amount"]), reverse=True)

    # Assign rank and priority investigation slots
    queue_rows = []
    for rank_idx, item in enumerate(ranked_items, start=1):
        item["priority_rank"] = rank_idx
        item["is_priority_investigation"] = 1 if rank_idx <= capacity else 0
        item["strategy_used"] = strategy
        item["is_low_confidence"] = bool(item["confidence_score"] < 40.0)

        queue_rows.append((
            item["case_id"], item["priority_score"], item["priority_rank"],
            item["is_priority_investigation"], strategy
        ))

    # Clear and persist queue entries in SQLite
    cur.execute("DELETE FROM queue_entries")
    cur.executemany(
        """INSERT INTO queue_entries (
            case_id, priority_score, priority_rank, is_priority_investigation, strategy_used
        ) VALUES (?, ?, ?, ?, ?)""",
        queue_rows
    )

    # Save active strategy in config
    cur.execute(
        "INSERT OR REPLACE INTO config (key, value_json, updated_at) VALUES ('priority_strategy', ?, datetime('now'))",
        (json.dumps(strategy),)
    )

    conn.commit()
    conn.close()
    return ranked_items
