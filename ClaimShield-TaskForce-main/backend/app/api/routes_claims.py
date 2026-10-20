"""Claims Intelligence API endpoints.
Provides multi-field search, filtering, outlier inspection, and 360 claim dossiers.
"""
import json
import sqlite3
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Query, HTTPException
from app.config import DB_PATH
from app.database import get_db_connection, query_all, query_one

router = APIRouter(prefix="/api/claims", tags=["Claims Intelligence"])

@router.get("")
def list_claims(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    service_type: Optional[str] = Query(None),
    provider_id: Optional[str] = Query(None),
    member_id: Optional[str] = Query(None),
    facility_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    flagged_only: bool = Query(False),
    sort_by: str = Query("service_date"),
    sort_order: str = Query("desc")
):
    """Retrieve paginated, filterable claims with signal flags and provider metadata."""
    conn = get_db_connection(DB_PATH)
    cur = conn.cursor()

    conditions = []
    params = []

    if service_type:
        conditions.append("c.service_type = ?")
        params.append(service_type)

    if provider_id:
        conditions.append("c.provider_id = ?")
        params.append(provider_id)

    if member_id:
        conditions.append("c.member_id = ?")
        params.append(member_id)

    if facility_id:
        conditions.append("c.facility_id = ?")
        params.append(facility_id)

    if search:
        search_term = f"%{search}%"
        conditions.append("(c.claim_id LIKE ? OR c.procedure_code LIKE ? OR c.diagnosis_code LIKE ? OR p.provider_name LIKE ?)")
        params.extend([search_term, search_term, search_term, search_term])

    if flagged_only:
        conditions.append("EXISTS (SELECT 1 FROM case_claims cc WHERE cc.claim_id = c.claim_id)")

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    # Count total
    count_sql = f"""
        SELECT COUNT(*) as c
        FROM claims c
        LEFT JOIN providers p ON c.provider_id = p.provider_id
        {where_clause}
    """
    cur.execute(count_sql, params)
    total_count = cur.fetchone()["c"]

    # Order by
    valid_sort_cols = {"service_date": "c.service_date", "paid_amount": "c.paid_amount", "billed_amount": "c.billed_amount", "claim_id": "c.claim_id"}
    sort_col = valid_sort_cols.get(sort_by, "c.service_date")
    order = "DESC" if sort_order.lower() == "desc" else "ASC"

    offset = (page - 1) * page_size

    claims_sql = f"""
        SELECT c.*, p.provider_name, p.specialty, f.facility_name,
               (SELECT COUNT(*) FROM case_claims cc WHERE cc.claim_id = c.claim_id) as case_flag_count
        FROM claims c
        LEFT JOIN providers p ON c.provider_id = p.provider_id
        LEFT JOIN facilities f ON c.facility_id = f.facility_id
        {where_clause}
        ORDER BY {sort_col} {order}
        LIMIT ? OFFSET ?
    """
    cur.execute(claims_sql, (*params, page_size, offset))
    rows = cur.fetchall()

    items = []
    for r in rows:
        item = dict(r)
        item["is_flagged"] = item["case_flag_count"] > 0
        items.append(item)

    conn.close()

    total_pages = (total_count + page_size - 1) // page_size

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/{claim_id}")
def get_claim_detail(claim_id: str):
    """Retrieve full 360 dossier for a specific claim including connected entities and flagged signals."""
    conn = get_db_connection(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT c.*, p.provider_name, p.specialty, p.peer_group, p.tax_id,
               m.synthetic_name as member_name, m.age_group, m.enrollment_status,
               f.facility_name, f.facility_type
        FROM claims c
        LEFT JOIN providers p ON c.provider_id = p.provider_id
        LEFT JOIN members m ON c.member_id = m.member_id
        LEFT JOIN facilities f ON c.facility_id = f.facility_id
        WHERE c.claim_id = ?
    """, (claim_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found")

    detail = dict(row)

    # Associated cases
    cur.execute("""
        SELECT c.case_id, c.case_type, c.risk_score, c.risk_band, c.status
        FROM case_claims cc
        JOIN cases c ON cc.case_id = c.case_id
        WHERE cc.claim_id = ?
    """, (claim_id,))
    detail["associated_cases"] = [dict(r) for r in cur.fetchall()]

    # Associated signals
    cur.execute("""
        SELECT signal_id, signal_type, severity, description, created_at, evidence_fields
        FROM signals
        WHERE claim_ids LIKE ?
    """, (f"%{claim_id}%",))
    signals = []
    for s in cur.fetchall():
        s_dict = dict(s)
        s_dict["evidence_fields"] = json.loads(s_dict["evidence_fields"])
        signals.append(s_dict)
    detail["signals"] = signals

    # Related claims for this member around the same date (+/- 3 days)
    cur.execute("""
        SELECT claim_id, service_date, procedure_code, billed_amount, paid_amount, provider_id
        FROM claims
        WHERE member_id = ? AND claim_id != ?
          AND service_date BETWEEN date(?, '-3 days') AND date(?, '+3 days')
        LIMIT 10
    """, (detail["member_id"], claim_id, detail["service_date"], detail["service_date"]))
    detail["temporal_cluster_claims"] = [dict(r) for r in cur.fetchall()]

    conn.close()
    return detail
