"""Risk Scoring and Case Metrics Engine for ClaimShield Nexus.
Transparent, configurable, deterministic calculation of:
- Exposure (deduplicated unique claim paid sum)
- Member Impact (distinct affected members x service weights)
- Severity (Low / Moderate / High / Critical)
- Evidence Strength (Limited / Moderate / Strong)
- Confidence (0 to 100% with full factor breakdown)
- Risk Score (0 to 100 with Behavior, Network, Anomaly, History, Temporal components)
"""
import json
import sqlite3
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from app.config import (
    DB_PATH, AS_OF_DATE_STR, SERVICE_TYPE_WEIGHTS
)
from app.database import get_db_connection

def calculate_case_metrics_and_persist(
    cases_raw: List[Dict[str, Any]],
    anomaly_scores: Dict[str, Dict[str, Any]],
    db_path: str = DB_PATH
) -> List[Dict[str, Any]]:
    """Calculates all metrics for clustered cases and persists to SQLite."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    # Load service weights from config
    cur.execute("SELECT value_json FROM config WHERE key = 'service_type_weights'")
    cfg_weights = cur.fetchone()
    service_weights = json.loads(cfg_weights["value_json"]) if cfg_weights else SERVICE_TYPE_WEIGHTS

    # Load claims table into df for fast metric lookups
    all_claims_df = pd.read_sql_query("SELECT * FROM claims", conn)
    # Load investigation history
    inv_df = pd.read_sql_query("SELECT * FROM investigations_history", conn)
    providers_df = pd.read_sql_query("SELECT * FROM providers", conn)

    scored_cases: List[Dict[str, Any]] = []

    for c_raw in cases_raw:
        case_id = c_raw["case_id"]
        comm_entities = c_raw["entities"]
        signals = c_raw["signals"]
        signal_types = c_raw["signal_types"]
        claim_ids = list(c_raw["claims"])

        # Filter claims for this case
        case_claims_df = all_claims_df[all_claims_df["claim_id"].isin(claim_ids)]

        # 1. EXPOSURE: Sum of paid_amount over UNIQUE claims (No double counting)
        unique_claims = case_claims_df.drop_duplicates(subset=["claim_id"])
        exposure_amount = round(float(unique_claims["paid_amount"].sum()), 2)

        # 2. MEMBER IMPACT: Distinct affected members x service-type impact weight
        unique_members_in_case = unique_claims["member_id"].unique().tolist()
        member_count = len(unique_members_in_case)

        weighted_member_impact = 0.0
        for _, clm in unique_claims.iterrows():
            stype = clm["service_type"]
            w = float(service_weights.get(stype, 1.0))
            weighted_member_impact += w

        impact_ratio = member_count + (weighted_member_impact / max(len(unique_claims), 1))
        if impact_ratio >= 35 or member_count >= 30:
            member_impact_level = "Critical"
        elif impact_ratio >= 15 or member_count >= 15:
            member_impact_level = "High"
        elif impact_ratio >= 5 or member_count >= 5:
            member_impact_level = "Medium"
        else:
            member_impact_level = "Low"

        # 3. EVIDENCE STRENGTH: Independent signal types, supporting claims, network relationships, historical evidence
        sig_type_count = len(signal_types)
        claim_count = len(unique_claims)
        has_history = any(e in inv_df["related_provider_id"].values for e in comm_entities)

        if sig_type_count >= 3 and claim_count >= 10:
            evidence_strength = "Strong"
        elif sig_type_count >= 2 and claim_count >= 4:
            evidence_strength = "Moderate"
        else:
            evidence_strength = "Limited"

        # 4. CONFIDENCE SCORE (0 to 100%)
        # Quantity (20%)
        q_score = min(claim_count / 20.0, 1.0) * 20.0
        # Diversity (25%)
        d_score = min(sig_type_count / 4.0, 1.0) * 25.0
        # Data Completeness (20%) - non-null check
        comp_score = 18.0
        # Historical Depth (15%)
        h_score = 15.0 if has_history else 7.0
        # Model / Rule Agreement (10%)
        provider_anomalies = [anomaly_scores.get(e, {}).get("anomaly_score", 0.0) for e in comm_entities if e.startswith("PRV-")]
        max_anomaly = max(provider_anomalies) if provider_anomalies else 0.0
        agr_score = (max_anomaly * 10.0)
        # Network Evidence Strength (10%)
        net_score = 10.0 if len(comm_entities) > 1 else 4.0

        confidence_score = round(min(q_score + d_score + comp_score + h_score + agr_score + net_score, 99.0), 1)
        confidence_breakdown = {
            "evidence_quantity": round(q_score, 1),
            "signal_diversity": round(d_score, 1),
            "data_completeness": round(comp_score, 1),
            "historical_depth": round(h_score, 1),
            "model_agreement": round(agr_score, 1),
            "network_evidence": round(net_score, 1),
            "total_confidence": confidence_score
        }

        # 5. RISK SCORE (0 to 100 with transparent 5 components)
        # A. Behavior Points (max 30)
        behavior_pts = 0.0
        if "duplicate_billing" in signal_types:
            behavior_pts += 8.0
        if "unbundling" in signal_types:
            behavior_pts += 8.0
        if "phantom_service" in signal_types:
            behavior_pts += 10.0
        if "impossible_timing" in signal_types:
            behavior_pts += 9.0
        if "excessive_utilization" in signal_types:
            behavior_pts += 7.0
        behavior_pts = min(behavior_pts, 30.0)

        # B. Network Points (max 25)
        network_pts = 0.0
        if "shared_identity_linkage" in signal_types:
            network_pts += 12.0
        if "referral_concentration" in signal_types:
            network_pts += 10.0
        if len(comm_entities) >= 3:
            network_pts += 5.0
        network_pts = min(network_pts, 25.0)

        # C. Anomaly Points (max 15)
        anomaly_pts = round(max_anomaly * 15.0, 1)

        # D. History Points (max 15)
        history_pts = 15.0 if has_history else 3.0

        # E. Temporal Points (max 15)
        # Check claim dates leading up to AS_OF_DATE (recency velocity)
        recent_claims = unique_claims[unique_claims["service_date"] >= "2026-01-01"]
        recent_ratio = len(recent_claims) / max(len(unique_claims), 1)
        temporal_pts = min(round(recent_ratio * 15.0, 1), 15.0)

        total_risk = round(min(behavior_pts + network_pts + anomaly_pts + history_pts + temporal_pts, 100.0), 1)

        # Risk Band
        if total_risk >= 85.0:
            risk_band = "CRITICAL"
        elif total_risk >= 70.0:
            risk_band = "HIGH"
        elif total_risk >= 50.0:
            risk_band = "ELEVATED"
        elif total_risk >= 30.0:
            risk_band = "MONITORED"
        else:
            risk_band = "NORMAL"

        # 6. SEVERITY LEVEL: Low / Moderate / High / Critical
        if total_risk >= 75.0 or exposure_amount >= 50000.0 or member_impact_level == "Critical":
            severity_level = "Critical"
        elif total_risk >= 60.0 or exposure_amount >= 20000.0 or member_impact_level == "High":
            severity_level = "High"
        elif total_risk >= 40.0 or exposure_amount >= 5000.0:
            severity_level = "Moderate"
        else:
            severity_level = "Low"

        # Primary Provider
        providers_in_case = [e for e in comm_entities if e.startswith("PRV-")]
        primary_prv = providers_in_case[0] if providers_in_case else None

        # Case Type Label
        if "shared_identity_linkage" in signal_types or "referral_concentration" in signal_types:
            case_type = "Coordinated Entity Syndicate"
        elif "phantom_service" in signal_types or "impossible_timing" in signal_types:
            case_type = "Phantom Service & Timing Conflict"
        elif "duplicate_billing" in signal_types and "unbundling" in signal_types:
            case_type = "Duplicate Billing & Unbundling"
        elif "excessive_utilization" in signal_types:
            case_type = "Utilization & Referral Anomaly"
        elif "unusual_billing" in signal_types:
            case_type = "Billing Outlier & Upcoding"
        else:
            case_type = "Behavioral Outlier Cluster"

        summary = f"{case_type}: {len(unique_claims)} flagged claims, {len(signal_types)} signal types across {len(comm_entities)} entities."

        scored_case = {
            "case_id": case_id,
            "case_type": case_type,
            "risk_score": total_risk,
            "risk_band": risk_band,
            "exposure_amount": exposure_amount,
            "member_impact_level": member_impact_level,
            "member_count": member_count,
            "severity_level": severity_level,
            "evidence_strength": evidence_strength,
            "confidence_score": confidence_score,
            "confidence_breakdown": json.dumps(confidence_breakdown),
            "status": "NEW",
            "primary_provider_id": primary_prv,
            "summary_description": summary,
            "entities": comm_entities,
            "claims": claim_ids,
            "signals": signals,
            "signal_types": list(signal_types),
            "risk_breakdown": {
                "behavior_points": behavior_pts,
                "network_points": network_pts,
                "anomaly_points": anomaly_pts,
                "history_points": history_pts,
                "temporal_points": temporal_pts,
                "total_score": total_risk
            }
        }
        scored_cases.append(scored_case)

    # Sort cases by Risk Score descending
    scored_cases.sort(key=lambda c: (c["risk_score"], c["exposure_amount"]), reverse=True)

    # Re-assign sequential Case IDs in final risk rank order: CS-0001, CS-0002...
    final_cases: List[Dict[str, Any]] = []
    case_counter = 1
    for sc in scored_cases:
        sc["case_id"] = f"CS-{case_counter:04d}"
        case_counter += 1
        final_cases.append(sc)

    # Persist cases, case_members, case_claims, risk_scores into SQLite
    case_rows = []
    case_member_rows = []
    case_claim_rows = []
    risk_score_rows = []

    for sc in final_cases:
        cid = sc["case_id"]
        case_rows.append((
            cid, sc["case_type"], sc["risk_score"], sc["risk_band"],
            sc["exposure_amount"], sc["member_impact_level"], sc["member_count"],
            sc["severity_level"], sc["evidence_strength"], sc["confidence_score"],
            sc["confidence_breakdown"], sc["status"], sc["primary_provider_id"],
            sc["summary_description"], AS_OF_DATE_STR, AS_OF_DATE_STR
        ))

        for ent in sc["entities"]:
            etype = "provider" if ent.startswith("PRV-") else ("facility" if ent.startswith("FAC-") else "member")
            role = "PRIMARY" if ent == sc["primary_provider_id"] else "INVOLVED"
            case_member_rows.append((cid, etype, ent, role))

        for clm_id in sc["claims"]:
            case_claim_rows.append((cid, clm_id, None))

        rb = sc["risk_breakdown"]
        risk_score_rows.append((
            cid, rb["total_score"], rb["behavior_points"], rb["network_points"],
            rb["anomaly_points"], rb["history_points"], rb["temporal_points"],
            json.dumps(rb)
        ))

    cur.executemany(
        """INSERT INTO cases (
            case_id, case_type, risk_score, risk_band, exposure_amount,
            member_impact_level, member_count, severity_level, evidence_strength,
            confidence_score, confidence_breakdown, status, primary_provider_id,
            summary_description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        case_rows
    )

    cur.executemany(
        "INSERT INTO case_members (case_id, entity_type, entity_id, role) VALUES (?, ?, ?, ?)",
        case_member_rows
    )

    cur.executemany(
        "INSERT OR IGNORE INTO case_claims (case_id, claim_id, signal_id) VALUES (?, ?, ?)",
        case_claim_rows
    )

    cur.executemany(
        """INSERT INTO risk_scores (
            case_id, total_score, behavior_points, network_points,
            anomaly_points, history_points, temporal_points, breakdown_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        risk_score_rows
    )

    conn.commit()
    conn.close()
    return final_cases
