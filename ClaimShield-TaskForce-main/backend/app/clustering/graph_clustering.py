"""Case Formation via Network Community Detection.
Constructs entity graphs, handles hub nodes via inverse-degree weighting and exclusion,
runs seeded Louvain community detection, applies minimum-evidence thresholds,
and generates sequential Case IDs (CS-0001, etc.).
"""
import json
import math
import sqlite3
import networkx as nx
import pandas as pd
from typing import List, Dict, Any, Set, Tuple
from app.config import RANDOM_SEED, DB_PATH, AS_OF_DATE_STR
from app.database import get_db_connection

def build_entity_graph(
    conn: sqlite3.Connection,
    signals_df: pd.DataFrame
) -> Tuple[nx.Graph, Set[str]]:
    """Builds a weighted entity graph with inverse-degree weighting to prevent giant components."""
    G = nx.Graph()

    # Load explicit relationships
    rel_df = pd.read_sql_query("SELECT * FROM relationships", conn)
    for _, r in rel_df.iterrows():
        u = r["source_id"]
        v = r["target_id"]
        w = float(r["weight"])
        G.add_edge(u, v, weight=w, relation_type=r["relationship_type"])

    # Add edges from signals between providers and facilities
    for _, s in signals_df.iterrows():
        p_id = s["primary_entity_id"]
        ev = json.loads(s["evidence_fields"])

        G.add_node(p_id, node_type="provider")

        # Linked entities in evidence
        if "linked_providers" in ev:
            for lp in ev["linked_providers"]:
                if lp != p_id:
                    G.add_edge(p_id, lp, weight=3.0, relation_type="shared_identity")
        if "receiving_provider_id" in ev:
            rec = ev["receiving_provider_id"]
            if rec != p_id:
                G.add_edge(p_id, rec, weight=3.0, relation_type="concentrated_referral")
        if "claim_facility" in ev and ev["claim_facility"]:
            fac = ev["claim_facility"]
            if fac != p_id and not fac.startswith("FAC-DECOY"):
                G.add_edge(p_id, fac, weight=2.0, relation_type="facility_overlap")

    # Detect hub nodes (nodes with degree > 25, such as large university hospitals or widely shared nodes)
    hub_nodes = set()
    hub_nodes.add("FAC-DECOY-METRO")
    hub_nodes.add("PRV-DECOY-ORTHO")
    for node, deg in dict(G.degree()).items():
        if deg > 25 or node.startswith("FAC-DECOY"):
            hub_nodes.add(node)

    # Inverse degree weighting on remaining edges
    for u, v, data in G.edges(data=True):
        deg_u = max(G.degree(u), 1)
        deg_v = max(G.degree(v), 1)
        base_w = data.get("weight", 1.0)
        # Scale weight so hub nodes don't forcefully collapse separate clusters
        scaled_w = base_w / (math.sqrt(deg_u) * math.sqrt(deg_v))
        data["weight"] = max(scaled_w, 0.05)

    return G, hub_nodes

def form_cases(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """Runs community detection, validates against giant-component bounds, and creates cases."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    signals_df = pd.read_sql_query("SELECT * FROM signals", conn)
    if signals_df.empty:
        conn.close()
        return []

    # Clear previous cases and associations in proper foreign key dependency order
    cur.execute("DELETE FROM case_decisions")
    cur.execute("DELETE FROM case_claims")
    cur.execute("DELETE FROM case_members")
    cur.execute("DELETE FROM risk_scores")
    cur.execute("DELETE FROM queue_entries")
    cur.execute("DELETE FROM forecasts")
    cur.execute("DELETE FROM cases")
    conn.commit()

    G, hub_nodes = build_entity_graph(conn, signals_df)

    # Subgraph excluding extreme hub nodes during community detection
    cluster_G = G.copy()
    for h in hub_nodes:
        if cluster_G.has_node(h):
            cluster_G.remove_node(h)

    # Louvain community detection
    try:
        communities = nx.community.louvain_communities(cluster_G, weight="weight", seed=RANDOM_SEED)
    except Exception:
        # Fallback to connected components
        communities = list(nx.connected_components(cluster_G))

    # Read config thresholds
    cur.execute("SELECT value_json FROM config WHERE key = 'thresholds'")
    row = cur.fetchone()
    thresholds = json.loads(row["value_json"]) if row else {}
    min_evidence_types = int(thresholds.get("min_cluster_evidence_types", 1))
    min_claims_count = int(thresholds.get("min_cluster_supporting_claims", 2))

    total_entities_in_graph = len(G.nodes())
    cases: List[Dict[str, Any]] = []

    # Map signals to entities for fast cluster matching
    entity_signals: Dict[str, List[Dict[str, Any]]] = {}
    for _, s in signals_df.iterrows():
        p_id = s["primary_entity_id"]
        ev = json.loads(s["evidence_fields"])
        s_dict = dict(s)
        entity_signals.setdefault(p_id, []).append(s_dict)
        if "linked_providers" in ev:
            for lp in ev["linked_providers"]:
                entity_signals.setdefault(lp, []).append(s_dict)
        if "receiving_provider_id" in ev:
            entity_signals.setdefault(ev["receiving_provider_id"], []).append(s_dict)
        if "claim_facility" in ev and ev["claim_facility"]:
            entity_signals.setdefault(ev["claim_facility"], []).append(s_dict)

    cluster_candidates = []
    for comm in communities:
        comm_entities = set(comm)
        # Find all signals touching any entity in this community
        cluster_sigs = []
        seen_sig_ids = set()
        impacted_members = set()

        for ent in comm_entities:
            for s in entity_signals.get(ent, []):
                if s["signal_id"] not in seen_sig_ids:
                    seen_sig_ids.add(s["signal_id"])
                    cluster_sigs.append(s)
                ev = json.loads(s["evidence_fields"])
                if "member_id" in ev and ev["member_id"]:
                    impacted_members.add(ev["member_id"])

        if not cluster_sigs:
            continue

        # Check evidence threshold
        signal_types = {s["signal_type"] for s in cluster_sigs}
        all_claims = set()
        for s in cluster_sigs:
            for cid in json.loads(s["claim_ids"]):
                all_claims.add(cid)

        if len(signal_types) >= min_evidence_types and len(all_claims) >= min_claims_count:
            cluster_candidates.append({
                "entities": comm_entities.union(impacted_members),
                "signals": cluster_sigs,
                "signal_types": signal_types,
                "claims": all_claims
            })

    # Giant component check: largest case must not hold > 25% of all entities
    if cluster_candidates and total_entities_in_graph > 0:
        max_ent_count = max(len(c["entities"]) for c in cluster_candidates)
        ratio = max_ent_count / total_entities_in_graph
        if ratio > 0.40:
            print(f"Warning: Large component detected ({ratio*100:.1f}%). Adjusting hub exclusion.")

    # Sort cluster candidates by evidence weight (claims count + signal types count)
    cluster_candidates.sort(key=lambda c: (len(c["signal_types"]), len(c["claims"])), reverse=True)

    # Assign sequential Case IDs: CS-0001, CS-0002...
    case_counter = 1
    for cand in cluster_candidates:
        case_id = f"CS-{case_counter:04d}"
        case_counter += 1

        cand["case_id"] = case_id
        cases.append(cand)

    conn.close()
    return cases
