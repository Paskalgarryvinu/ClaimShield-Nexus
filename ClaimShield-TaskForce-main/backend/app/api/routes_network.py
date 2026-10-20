"""Network Intelligence and Graph Exploration API endpoints.
Provides entity graphs, relationship links, node attributes, search,
and detailed Entity Intelligence dossiers.
"""
import json
import sqlite3
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Query, HTTPException
from app.config import DB_PATH
from app.database import get_db_connection, query_all, query_one

router = APIRouter(prefix="/api/network", tags=["Network Explorer"])

@router.get("/graph")
def get_network_graph(
    case_id: Optional[str] = Query(None, description="Optional case ID to filter graph to case neighborhood"),
    entity_id: Optional[str] = Query(None, description="Optional entity ID to focus graph around"),
    limit: int = Query(250, description="Max entities to return for optimal canvas performance")
):
    """Returns network graph nodes and edges with risk indicators and relationship types."""
    conn = get_db_connection(DB_PATH)
    cur = conn.cursor()

    nodes_map: Dict[str, Dict[str, Any]] = {}
    edges_list: List[Dict[str, Any]] = []

    # 1. If case_id is specified, gather case members and claims
    target_entities = set()
    if case_id:
        cur.execute("SELECT entity_type, entity_id, role FROM case_members WHERE case_id = ?", (case_id,))
        for r in cur.fetchall():
            target_entities.add(r["entity_id"])
            nodes_map[r["entity_id"]] = {
                "id": r["entity_id"],
                "type": r["entity_type"],
                "role": r["role"],
                "in_case": True,
                "label": r["entity_id"]
            }

    elif entity_id:
        target_entities.add(entity_id)
        # Find 1-hop neighbors from relationships
        cur.execute("""
            SELECT source_id, target_id FROM relationships 
            WHERE source_id = ? OR target_id = ?
        """, (entity_id, entity_id))
        for r in cur.fetchall():
            target_entities.add(r["source_id"])
            target_entities.add(r["target_id"])

    # 2. Query relationships
    if target_entities:
        placeholders = ",".join("?" for _ in target_entities)
        cur.execute(f"""
            SELECT source_type, source_id, target_type, target_id, relationship_type, weight
            FROM relationships
            WHERE source_id IN ({placeholders}) OR target_id IN ({placeholders})
            LIMIT ?
        """, (*target_entities, *target_entities, limit))
    else:
        # Global top connected relationships (excluding high-degree decoys)
        cur.execute("""
            SELECT source_type, source_id, target_type, target_id, relationship_type, weight
            FROM relationships
            WHERE source_id NOT LIKE 'FAC-DECOY%' AND target_id NOT LIKE 'FAC-DECOY%'
            ORDER BY weight DESC
            LIMIT ?
        """, (limit,))

    rel_rows = cur.fetchall()

    for r in rel_rows:
        s_id = r["source_id"]
        t_id = r["target_id"]
        s_type = r["source_type"]
        t_type = r["target_type"]

        if s_id not in nodes_map:
            nodes_map[s_id] = {
                "id": s_id,
                "type": s_type,
                "label": s_id,
                "in_case": False
            }
        if t_id not in nodes_map:
            nodes_map[t_id] = {
                "id": t_id,
                "type": t_type,
                "label": t_id,
                "in_case": False
            }

        edges_list.append({
            "source": s_id,
            "target": t_id,
            "type": r["relationship_type"],
            "weight": float(r["weight"]),
            "label": r["relationship_type"].replace("_", " ").title()
        })

    # Enrich nodes with provider/facility/member names and risk indicators
    for n_id, node in nodes_map.items():
        if node["type"] == "provider" or n_id.startswith("PRV-"):
            cur.execute("SELECT provider_name, specialty, peer_group, risk_history FROM providers WHERE provider_id = ?", (n_id,))
            p_row = cur.fetchone()
            if p_row:
                node["name"] = p_row["provider_name"]
                node["specialty"] = p_row["specialty"]
                node["peer_group"] = p_row["peer_group"]
                node["risk_history"] = p_row["risk_history"]
                node["label"] = f"{p_row['provider_name']} ({n_id})"
            # Check if provider has signals
            cur.execute("SELECT COUNT(*) as sig_c FROM signals WHERE primary_entity_id = ?", (n_id,))
            node["signal_count"] = cur.fetchone()["sig_c"]

        elif node["type"] == "facility" or n_id.startswith("FAC-"):
            cur.execute("SELECT facility_name, facility_type, risk_indicator FROM facilities WHERE facility_id = ?", (n_id,))
            f_row = cur.fetchone()
            if f_row:
                node["name"] = f_row["facility_name"]
                node["facility_type"] = f_row["facility_type"]
                node["risk_indicator"] = f_row["risk_indicator"]
                node["label"] = f"{f_row['facility_name']} ({n_id})"

        elif node["type"] == "member" or n_id.startswith("MBR-"):
            cur.execute("SELECT synthetic_name, age_group, enrollment_status FROM members WHERE member_id = ?", (n_id,))
            m_row = cur.fetchone()
            if m_row:
                node["name"] = m_row["synthetic_name"]
                node["age_group"] = m_row["age_group"]
                node["enrollment_status"] = m_row["enrollment_status"]
                node["label"] = f"{m_row['synthetic_name']} ({n_id})"

    conn.close()

    return {
        "nodes": list(nodes_map.values()),
        "edges": edges_list,
        "node_count": len(nodes_map),
        "edge_count": len(edges_list),
        "case_id": case_id,
        "entity_id": entity_id
    }

@router.get("/entity/{entity_type}/{entity_id}")
def get_entity_intelligence(entity_type: str, entity_id: str):
    """Returns comprehensive 360-degree Entity Intelligence profile."""
    conn = get_db_connection(DB_PATH)
    cur = conn.cursor()

    intel: Dict[str, Any] = {
        "entity_id": entity_id,
        "entity_type": entity_type,
        "profile": {},
        "claim_stats": {},
        "signals": [],
        "investigations": [],
        "connected_entities": [],
        "associated_cases": []
    }

    if entity_type.lower() == "provider" or entity_id.startswith("PRV-"):
        cur.execute("SELECT * FROM providers WHERE provider_id = ?", (entity_id,))
        p_row = cur.fetchone()
        if not p_row:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Provider {entity_id} not found")
        intel["profile"] = dict(p_row)

        # Claim statistics
        cur.execute("""
            SELECT COUNT(*) as claim_count,
                   SUM(billed_amount) as total_billed,
                   SUM(paid_amount) as total_paid,
                   COUNT(DISTINCT member_id) as unique_members,
                   COUNT(DISTINCT facility_id) as unique_facilities,
                   MIN(service_date) as earliest_service,
                   MAX(service_date) as latest_service
            FROM claims WHERE provider_id = ?
        """, (entity_id,))
        c_stats = cur.fetchone()
        intel["claim_stats"] = dict(c_stats) if c_stats else {}

        # Prior investigations
        cur.execute("SELECT * FROM investigations_history WHERE related_provider_id = ?", (entity_id,))
        intel["investigations"] = [dict(r) for r in cur.fetchall()]

    elif entity_type.lower() == "facility" or entity_id.startswith("FAC-"):
        cur.execute("SELECT * FROM facilities WHERE facility_id = ?", (entity_id,))
        f_row = cur.fetchone()
        if not f_row:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Facility {entity_id} not found")
        intel["profile"] = dict(f_row)

        cur.execute("""
            SELECT COUNT(*) as claim_count,
                   SUM(billed_amount) as total_billed,
                   SUM(paid_amount) as total_paid,
                   COUNT(DISTINCT member_id) as unique_members,
                   COUNT(DISTINCT provider_id) as unique_providers
            FROM claims WHERE facility_id = ?
        """, (entity_id,))
        intel["claim_stats"] = dict(cur.fetchone())

    elif entity_type.lower() == "member" or entity_id.startswith("MBR-"):
        cur.execute("SELECT * FROM members WHERE member_id = ?", (entity_id,))
        m_row = cur.fetchone()
        if not m_row:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Member {entity_id} not found")
        intel["profile"] = dict(m_row)

        cur.execute("""
            SELECT COUNT(*) as claim_count,
                   SUM(paid_amount) as total_paid,
                   COUNT(DISTINCT provider_id) as unique_providers
            FROM claims WHERE member_id = ?
        """, (entity_id,))
        intel["claim_stats"] = dict(cur.fetchone())

    # Associated signals
    cur.execute("""
        SELECT signal_id, signal_type, severity, description, created_at, evidence_fields
        FROM signals
        WHERE primary_entity_id = ? OR evidence_fields LIKE ?
        LIMIT 20
    """, (entity_id, f"%{entity_id}%"))
    for s in cur.fetchall():
        s_dict = dict(s)
        s_dict["evidence_fields"] = json.loads(s_dict["evidence_fields"])
        intel["signals"].append(s_dict)

    # Associated cases
    cur.execute("""
        SELECT c.case_id, c.case_type, c.risk_score, c.risk_band, c.status, cm.role
        FROM case_members cm
        JOIN cases c ON cm.case_id = c.case_id
        WHERE cm.entity_id = ?
    """, (entity_id,))
    intel["associated_cases"] = [dict(r) for r in cur.fetchall()]

    # Connected entities via relationships
    cur.execute("""
        SELECT source_id as entity_id, source_type as entity_type, relationship_type, weight
        FROM relationships WHERE target_id = ?
        UNION
        SELECT target_id as entity_id, target_type as entity_type, relationship_type, weight
        FROM relationships WHERE source_id = ?
        LIMIT 30
    """, (entity_id, entity_id))
    intel["connected_entities"] = [dict(r) for r in cur.fetchall()]

    conn.close()
    return intel

@router.get("/search")
def search_entities(q: str = Query(..., min_length=2)):
    """Search providers, facilities, members, claims, cases by identifier or keyword."""
    conn = get_db_connection(DB_PATH)
    cur = conn.cursor()
    term = f"%{q}%"

    results: List[Dict[str, Any]] = []

    # Cases
    cur.execute("""
        SELECT case_id as id, case_type as title, risk_band as badge, risk_score as score, 'case' as type
        FROM cases WHERE case_id LIKE ? OR summary_description LIKE ?
        LIMIT 5
    """, (term, term))
    results.extend([dict(r) for r in cur.fetchall()])

    # Providers
    cur.execute("""
        SELECT provider_id as id, provider_name as title, specialty as badge, risk_history as score, 'provider' as type
        FROM providers WHERE provider_id LIKE ? OR provider_name LIKE ?
        LIMIT 6
    """, (term, term))
    results.extend([dict(r) for r in cur.fetchall()])

    # Facilities
    cur.execute("""
        SELECT facility_id as id, facility_name as title, facility_type as badge, risk_indicator as score, 'facility' as type
        FROM facilities WHERE facility_id LIKE ? OR facility_name LIKE ?
        LIMIT 5
    """, (term, term))
    results.extend([dict(r) for r in cur.fetchall()])

    # Members
    cur.execute("""
        SELECT member_id as id, synthetic_name as title, enrollment_status as badge, age_group as score, 'member' as type
        FROM members WHERE member_id LIKE ? OR synthetic_name LIKE ?
        LIMIT 5
    """, (term, term))
    results.extend([dict(r) for r in cur.fetchall()])

    # Claims
    cur.execute("""
        SELECT claim_id as id, service_type as title, claim_status as badge, paid_amount as score, 'claim' as type
        FROM claims WHERE claim_id LIKE ?
        LIMIT 5
    """, (term,))
    results.extend([dict(r) for r in cur.fetchall()])

    conn.close()
    return results
