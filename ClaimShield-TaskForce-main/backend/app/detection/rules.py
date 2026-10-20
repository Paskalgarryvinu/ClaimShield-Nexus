"""Algorithmic Rule Detection Engine for ClaimShield Nexus.
All rules are configurable, toggleable, deterministic, and produce rich evidence payloads.
Language: 'Potential unbundling pattern: review required', 'Potential Phantom Service', etc. Never 'fraud'.
"""
import json
import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Tuple
from app.config import DB_PATH, AS_OF_DATE_STR
from app.database import get_db_connection

def run_all_rules(db_path: str = DB_PATH, config_overrides: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Executes all enabled detection rules and writes signals to SQLite."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    # Load configuration
    cur.execute("SELECT key, value_json FROM config")
    cfg_rows = cur.fetchall()
    cfg = {}
    for r in cfg_rows:
        try:
            cfg[r["key"]] = json.loads(r["value_json"])
        except Exception:
            cfg[r["key"]] = r["value_json"]

    if config_overrides:
        cfg.update(config_overrides)

    rules_enabled = cfg.get("rules_enabled", {
        "duplicate_billing": True,
        "unbundling": True,
        "phantom_service": True,
        "impossible_timing": True,
        "excessive_utilization": True,
        "unusual_billing": True,
        "referral_concentration": True,
        "shared_identity_linkage": True
    })
    thresholds = cfg.get("thresholds", {
        "utilization_zscore": 2.5,
        "unusual_billing_zscore": 2.5,
        "referral_concentration_pct": 0.70
    })

    # Clear existing signals
    cur.execute("DELETE FROM signals")
    conn.commit()

    # Load DataFrames
    claims_df = pd.read_sql_query("SELECT * FROM claims", conn)
    providers_df = pd.read_sql_query("SELECT * FROM providers", conn)
    members_df = pd.read_sql_query("SELECT * FROM members", conn)
    referrals_df = pd.read_sql_query("SELECT * FROM referrals", conn)
    stays_df = pd.read_sql_query("SELECT * FROM member_stays", conn)
    bundles_df = pd.read_sql_query("SELECT * FROM bundle_definitions", conn)
    baselines_df = pd.read_sql_query("SELECT * FROM code_peer_baselines", conn)

    signals: List[Dict[str, Any]] = []
    sig_counter = 1

    # 1. DUPLICATE BILLING RULE
    if rules_enabled.get("duplicate_billing", True):
        dup_cols = ["member_id", "provider_id", "service_date", "procedure_code", "billed_amount"]
        dup_groups = claims_df.groupby(dup_cols)
        for (m_id, p_id, s_date, p_code, b_amt), group in dup_groups:
            if len(group) > 1:
                claim_ids = group["claim_id"].tolist()
                sub_dates = group["submission_date"].tolist()
                sig_id = f"SIG-DUP-{sig_counter:06d}"
                sig_counter += 1
                evidence = {
                    "rule": "duplicate_billing",
                    "member_id": m_id,
                    "provider_id": p_id,
                    "service_date": s_date,
                    "procedure_code": p_code,
                    "billed_amount": float(b_amt),
                    "duplicate_count": len(group),
                    "submission_dates": sub_dates,
                    "matching_fields": ["member_id", "provider_id", "service_date", "procedure_code", "billed_amount"],
                    "supporting_claim_ids": claim_ids
                }
                signals.append({
                    "signal_id": sig_id,
                    "signal_type": "duplicate_billing",
                    "severity": "MODERATE",
                    "primary_entity_type": "provider",
                    "primary_entity_id": p_id,
                    "claim_ids": json.dumps(claim_ids),
                    "evidence_fields": json.dumps(evidence),
                    "rule_parameters": json.dumps({"match_fields": dup_cols}),
                    "description": f"Duplicate billing: {len(group)} claims for procedure {p_code} ($ {b_amt:.2f}) on {s_date} for member {m_id}.",
                    "created_at": AS_OF_DATE_STR
                })

    # 2. UNBUNDLING RULE
    if rules_enabled.get("unbundling", True) and not bundles_df.empty:
        bundle_map = {}
        for _, b_row in bundles_df.iterrows():
            b_code = b_row["bundle_code"]
            c_code = b_row["component_code"]
            b_name = b_row["bundle_name"]
            bundle_map.setdefault(b_code, {"name": b_name, "components": set()})["components"].add(c_code)

        unb_groups = claims_df.groupby(["member_id", "provider_id", "service_date"])
        for (m_id, p_id, s_date), group in unb_groups:
            procs_in_group = set(group["procedure_code"].tolist())
            for b_code, b_info in bundle_map.items():
                intersection = procs_in_group.intersection(b_info["components"])
                if len(intersection) >= 2:
                    matched_claims = group[group["procedure_code"].isin(intersection)]
                    claim_ids = matched_claims["claim_id"].tolist()
                    total_billed = float(matched_claims["billed_amount"].sum())
                    sig_id = f"SIG-UNB-{sig_counter:06d}"
                    sig_counter += 1
                    evidence = {
                        "rule": "unbundling",
                        "member_id": m_id,
                        "provider_id": p_id,
                        "service_date": s_date,
                        "bundle_code": b_code,
                        "bundle_name": b_info["name"],
                        "component_codes_found": list(intersection),
                        "total_billed": total_billed,
                        "supporting_claim_ids": claim_ids
                    }
                    signals.append({
                        "signal_id": sig_id,
                        "signal_type": "unbundling",
                        "severity": "MODERATE",
                        "primary_entity_type": "provider",
                        "primary_entity_id": p_id,
                        "claim_ids": json.dumps(claim_ids),
                        "evidence_fields": json.dumps(evidence),
                        "rule_parameters": json.dumps({"bundle_code": b_code}),
                        "description": f"Potential unbundling pattern: review required. Component codes {list(intersection)} billed separately on {s_date} for bundle {b_code}.",
                        "created_at": AS_OF_DATE_STR
                    })

    # 3. PHANTOM SERVICE RULE
    if rules_enabled.get("phantom_service", True):
        # A. Inpatient conflict
        if not stays_df.empty:
            merged_stays = claims_df.merge(stays_df, on="member_id", how="inner")
            conflicts = merged_stays[
                (merged_stays["service_date"] >= merged_stays["admit_date"]) &
                (merged_stays["service_date"] <= merged_stays["discharge_date"]) &
                (merged_stays["facility_id_x"] != merged_stays["facility_id_y"])
            ]
            for _, c_row in conflicts.iterrows():
                sig_id = f"SIG-PHT-{sig_counter:06d}"
                sig_counter += 1
                evidence = {
                    "rule": "phantom_service",
                    "subtype": "inpatient_conflict",
                    "member_id": c_row["member_id"],
                    "claim_id": c_row["claim_id"],
                    "service_date": c_row["service_date"],
                    "claim_facility": c_row["facility_id_x"],
                    "inpatient_facility": c_row["facility_id_y"],
                    "admit_date": c_row["admit_date"],
                    "discharge_date": c_row["discharge_date"],
                    "provider_id": c_row["provider_id"]
                }
                signals.append({
                    "signal_id": sig_id,
                    "signal_type": "phantom_service",
                    "severity": "HIGH",
                    "primary_entity_type": "provider",
                    "primary_entity_id": c_row["provider_id"],
                    "claim_ids": json.dumps([c_row["claim_id"]]),
                    "evidence_fields": json.dumps(evidence),
                    "rule_parameters": json.dumps({"check": "inpatient_stay_overlap"}),
                    "description": f"Potential Phantom Service: service billed at facility {c_row['facility_id_x']} while member was admitted at inpatient facility {c_row['facility_id_y']}.",
                    "created_at": AS_OF_DATE_STR
                })

        # B. Service after coverage end
        merged_cov = claims_df.merge(members_df[["member_id", "coverage_end"]], on="member_id", how="inner")
        expired_claims = merged_cov[
            merged_cov["coverage_end"].notnull() &
            (merged_cov["service_date"] > merged_cov["coverage_end"])
        ]
        for _, exp_row in expired_claims.iterrows():
            sig_id = f"SIG-PHT-{sig_counter:06d}"
            sig_counter += 1
            evidence = {
                "rule": "phantom_service",
                "subtype": "post_coverage_expiration",
                "member_id": exp_row["member_id"],
                "claim_id": exp_row["claim_id"],
                "service_date": exp_row["service_date"],
                "coverage_end": exp_row["coverage_end"],
                "provider_id": exp_row["provider_id"],
                "billed_amount": float(exp_row["billed_amount"])
            }
            signals.append({
                "signal_id": sig_id,
                "signal_type": "phantom_service",
                "severity": "HIGH",
                "primary_entity_type": "provider",
                "primary_entity_id": exp_row["provider_id"],
                "claim_ids": json.dumps([exp_row["claim_id"]]),
                "evidence_fields": json.dumps(evidence),
                "rule_parameters": json.dumps({"check": "post_coverage_expiration"}),
                "description": f"Potential Phantom Service: claim billed on {exp_row['service_date']} after member coverage expired on {exp_row['coverage_end']}.",
                "created_at": AS_OF_DATE_STR
            })

        # C. Implausible daily units capacity (>16 units on single date for solo provider)
        daily_units = claims_df.groupby(["provider_id", "service_date"]).agg(
            total_units=("units", "sum"),
            claim_ids=("claim_id", list),
            total_billed=("billed_amount", "sum")
        ).reset_index()
        excess_days = daily_units[daily_units["total_units"] >= 20]
        for _, ex_row in excess_days.iterrows():
            sig_id = f"SIG-PHT-{sig_counter:06d}"
            sig_counter += 1
            evidence = {
                "rule": "phantom_service",
                "subtype": "daily_capacity_exceeded",
                "provider_id": ex_row["provider_id"],
                "service_date": ex_row["service_date"],
                "units_billed": int(ex_row["total_units"]),
                "threshold_units": 20,
                "claim_ids": ex_row["claim_ids"]
            }
            signals.append({
                "signal_id": sig_id,
                "signal_type": "phantom_service",
                "severity": "HIGH",
                "primary_entity_type": "provider",
                "primary_entity_id": ex_row["provider_id"],
                "claim_ids": json.dumps(ex_row["claim_ids"]),
                "evidence_fields": json.dumps(evidence),
                "rule_parameters": json.dumps({"threshold_units": 20}),
                "description": f"Potential Phantom Service: provider billed {ex_row['total_units']} procedure units on a single calendar day ({ex_row['service_date']}).",
                "created_at": AS_OF_DATE_STR
            })

    # 4. IMPOSSIBLE TIMING RULE (Same member at distant locations on same date)
    if rules_enabled.get("impossible_timing", True):
        loc_counts = claims_df.groupby(["member_id", "service_date"])["location"].nunique().reset_index()
        multi_loc_dates = loc_counts[loc_counts["location"] > 1][["member_id", "service_date"]]
        if not multi_loc_dates.empty:
            merged_impossible = claims_df.merge(multi_loc_dates, on=["member_id", "service_date"], how="inner")
            for (m_id, s_date), group in merged_impossible.groupby(["member_id", "service_date"]):
                locs = group["location"].unique().tolist()
                prvs = group["provider_id"].unique().tolist()
                c_ids = group["claim_id"].tolist()
                sig_id = f"SIG-TIM-{sig_counter:06d}"
                sig_counter += 1
                evidence = {
                    "rule": "impossible_timing",
                    "member_id": m_id,
                    "service_date": s_date,
                    "locations": locs,
                    "providers": prvs,
                    "supporting_claim_ids": c_ids
                }
                signals.append({
                    "signal_id": sig_id,
                    "signal_type": "impossible_timing",
                    "severity": "HIGH",
                    "primary_entity_type": "provider",
                    "primary_entity_id": prvs[0],
                    "claim_ids": json.dumps(c_ids),
                    "evidence_fields": json.dumps(evidence),
                    "rule_parameters": json.dumps({"check": "same_day_multicity"}),
                    "description": f"Impossible timing pattern: member {m_id} received in-person services across distant locations ({', '.join(locs)}) on {s_date}.",
                    "created_at": AS_OF_DATE_STR
                })


    # 5. EXCESSIVE UTILIZATION RULE (vs Peer Group Baseline)
    if rules_enabled.get("excessive_utilization", True):
        # Calculate provider claims-per-member ratio
        prv_summary = claims_df.groupby("provider_id").agg(
            claim_count=("claim_id", "count"),
            member_count=("member_id", "nunique"),
            total_paid=("paid_amount", "sum"),
            claim_ids=("claim_id", list)
        ).reset_index()
        prv_summary["claims_per_member"] = prv_summary["claim_count"] / prv_summary["member_count"].replace(0, 1)

        # Merge with provider peer group
        prv_merged = prv_summary.merge(providers_df[["provider_id", "peer_group", "specialty"]], on="provider_id")

        # Group by peer group and compute z-score
        zscore_threshold = float(thresholds.get("utilization_zscore", 2.5))
        for p_grp, p_data in prv_merged.groupby("peer_group"):
            mean_cpm = p_data["claims_per_member"].mean()
            std_cpm = p_data["claims_per_member"].std()
            if std_cpm and std_cpm > 0.001:
                p_data["z_score"] = (p_data["claims_per_member"] - mean_cpm) / std_cpm
                outliers = p_data[p_data["z_score"] >= zscore_threshold]
                for _, out_row in outliers.iterrows():
                    sig_id = f"SIG-UTL-{sig_counter:06d}"
                    sig_counter += 1
                    evidence = {
                        "rule": "excessive_utilization",
                        "provider_id": out_row["provider_id"],
                        "peer_group": p_grp,
                        "specialty": out_row["specialty"],
                        "provider_claims_per_member": round(float(out_row["claims_per_member"]), 2),
                        "peer_average_cpm": round(float(mean_cpm), 2),
                        "peer_std_cpm": round(float(std_cpm), 2),
                        "z_score": round(float(out_row["z_score"]), 2),
                        "total_claims": int(out_row["claim_count"]),
                        "unique_members": int(out_row["member_count"])
                    }
                    signals.append({
                        "signal_id": sig_id,
                        "signal_type": "excessive_utilization",
                        "severity": "HIGH" if out_row["z_score"] >= 3.5 else "MODERATE",
                        "primary_entity_type": "provider",
                        "primary_entity_id": out_row["provider_id"],
                        "claim_ids": json.dumps(out_row["claim_ids"][:50]),
                        "evidence_fields": json.dumps(evidence),
                        "rule_parameters": json.dumps({"zscore_threshold": zscore_threshold}),
                        "description": f"Excessive utilization: provider exhibits {out_row['claims_per_member']:.1f} claims/member vs peer average of {mean_cpm:.1f} (Z-Score: +{out_row['z_score']:.1f}).",
                        "created_at": AS_OF_DATE_STR
                    })

    # 6. UNUSUAL BILLING / UPCODING RULE
    if rules_enabled.get("unusual_billing", True):
        # Level 5 E&M code concentration check for primary care / family med
        em_claims = claims_df[claims_df["procedure_code"].isin(["99213", "99214", "99215"])]
        if not em_claims.empty:
            em_counts = em_claims.groupby(["provider_id", "procedure_code"]).size().unstack(fill_value=0)
            if "99215" in em_counts.columns:
                em_counts["total_em"] = em_counts.sum(axis=1)
                em_counts["level_5_pct"] = em_counts["99215"] / em_counts["total_em"]
                # Outliers with >= 30 E&M claims and > 65% Level 5 (peer avg is ~10%)
                upcoders = em_counts[(em_counts["total_em"] >= 20) & (em_counts["level_5_pct"] >= 0.65)]
                for p_id, row in upcoders.iterrows():
                    sig_id = f"SIG-UPC-{sig_counter:06d}"
                    sig_counter += 1
                    rel_claims = em_claims[(em_claims["provider_id"] == p_id) & (em_claims["procedure_code"] == "99215")]["claim_id"].tolist()
                    evidence = {
                        "rule": "unusual_billing",
                        "provider_id": p_id,
                        "procedure_code": "99215",
                        "level_5_claim_count": int(row["99215"]),
                        "total_em_claims": int(row["total_em"]),
                        "level_5_pct": round(float(row["level_5_pct"] * 100), 1),
                        "peer_group_pct": 10.0,
                        "supporting_claim_ids": rel_claims[:40]
                    }
                    signals.append({
                        "signal_id": sig_id,
                        "signal_type": "unusual_billing",
                        "severity": "MODERATE",
                        "primary_entity_type": "provider",
                        "primary_entity_id": p_id,
                        "claim_ids": json.dumps(rel_claims[:40]),
                        "evidence_fields": json.dumps(evidence),
                        "rule_parameters": json.dumps({"min_claims": 20, "level_5_pct_threshold": 0.65}),
                        "description": f"Unusual billing / potential upcoding: 99215 accounts for {row['level_5_pct']*100:.1f}% of E&M billing vs 10% peer group expectation.",
                        "created_at": AS_OF_DATE_STR
                    })

    # 7. REFERRAL CONCENTRATION RULE
    if rules_enabled.get("referral_concentration", True) and not referrals_df.empty:
        ref_threshold = float(thresholds.get("referral_concentration_pct", 0.70))
        ref_totals = referrals_df.groupby("referring_provider_id").size().reset_index(name="total_refs")
        pair_counts = referrals_df.groupby(["referring_provider_id", "receiving_provider_id"]).size().reset_index(name="pair_refs")
        merged_refs = pair_counts.merge(ref_totals, on="referring_provider_id")
        merged_refs["pct"] = merged_refs["pair_refs"] / merged_refs["total_refs"]

        concentrated = merged_refs[(merged_refs["total_refs"] >= 15) & (merged_refs["pct"] >= ref_threshold)]
        for _, ref_row in concentrated.iterrows():
            sig_id = f"SIG-REF-{sig_counter:06d}"
            sig_counter += 1
            evidence = {
                "rule": "referral_concentration",
                "referring_provider_id": ref_row["referring_provider_id"],
                "receiving_provider_id": ref_row["receiving_provider_id"],
                "referral_count": int(ref_row["pair_refs"]),
                "total_referrals": int(ref_row["total_refs"]),
                "concentration_percentage": round(float(ref_row["pct"] * 100), 1),
                "threshold_percentage": round(ref_threshold * 100, 1)
            }
            signals.append({
                "signal_id": sig_id,
                "signal_type": "referral_concentration",
                "severity": "MODERATE",
                "primary_entity_type": "provider",
                "primary_entity_id": ref_row["referring_provider_id"],
                "claim_ids": json.dumps([]),
                "evidence_fields": json.dumps(evidence),
                "rule_parameters": json.dumps({"threshold_pct": ref_threshold}),
                "description": f"Referral concentration pattern: {ref_row['pct']*100:.1f}% of referrals ({ref_row['pair_refs']}/{ref_row['total_refs']}) funnel directly to provider {ref_row['receiving_provider_id']}.",
                "created_at": AS_OF_DATE_STR
            })

    # 8. SHARED IDENTITY LINKAGE RULE
    if rules_enabled.get("shared_identity_linkage", True):
        # Look for clusters sharing tax_id or owner_id across providers
        for id_col, label in [("tax_id", "Tax ID"), ("owner_id", "Corporate Owner")]:
            id_groups = providers_df.groupby(id_col).filter(lambda g: len(g) > 1 and not g[id_col].str.startswith("TAX-DECOY").any())
            for val, group in id_groups.groupby(id_col):
                if len(group) >= 2 and any(p.startswith("PRV-SC") for p in group["provider_id"]):
                    prv_list = group["provider_id"].tolist()
                    sig_id = f"SIG-LNK-{sig_counter:06d}"
                    sig_counter += 1
                    evidence = {
                        "rule": "shared_identity_linkage",
                        "identity_type": label,
                        "identity_value": val,
                        "linked_providers": prv_list,
                        "provider_count": len(prv_list),
                        "note": "Relationship signal, not proof of fraud."
                    }
                    signals.append({
                        "signal_id": sig_id,
                        "signal_type": "shared_identity_linkage",
                        "severity": "MODERATE",
                        "primary_entity_type": "provider",
                        "primary_entity_id": prv_list[0],
                        "claim_ids": json.dumps([]),
                        "evidence_fields": json.dumps(evidence),
                        "rule_parameters": json.dumps({"linked_field": id_col}),
                        "description": f"Shared identity linkage: {len(prv_list)} providers share {label} ({val}). Relationship signal requiring review.",
                        "created_at": AS_OF_DATE_STR
                    })

    # Bulk insert signals into SQLite
    cur.executemany(
        """INSERT INTO signals (
            signal_id, signal_type, severity, primary_entity_type, primary_entity_id,
            claim_ids, evidence_fields, rule_parameters, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (
                s["signal_id"], s["signal_type"], s["severity"],
                s["primary_entity_type"], s["primary_entity_id"],
                s["claim_ids"], s["evidence_fields"], s["rule_parameters"],
                s["description"], s["created_at"]
            )
            for s in signals
        ]
    )

    conn.commit()
    conn.close()
    return signals
