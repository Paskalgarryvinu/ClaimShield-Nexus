"""Deterministic Synthetic Data Generator for ClaimShield Nexus.
Builds ~20,000 claims, providers, members, facilities, referrals,
relationships, member stays, bundle definitions, decoys, and planted scenarios.
All dates relative to AS_OF_DATE (2026-03-31).
"""
import random
import json
import sqlite3
from datetime import datetime, timedelta, date
from typing import Dict, List, Tuple
from app.config import (
    RANDOM_SEED, AS_OF_DATE, AS_OF_DATE_STR,
    SERVICE_TYPES, DB_PATH
)
from app.database import init_db, get_db_connection

def generate_synthetic_data(db_path: str = DB_PATH) -> Dict[str, int]:
    """Generates all synthetic entities and writes directly to SQLite."""
    random.seed(RANDOM_SEED)

    # Initialize / reset tables
    init_db(db_path)
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    # 1. BUNDLE DEFINITIONS
    bundles = [
        ("BND-80053", "80048", "Comprehensive Metabolic Panel Bundle"),
        ("BND-80053", "84443", "Comprehensive Metabolic Panel Bundle"),
        ("BND-80053", "82040", "Comprehensive Metabolic Panel Bundle"),
        ("BND-29881", "29877", "Knee Arthroscopy Meniscectomy Bundle"),
        ("BND-29881", "29870", "Knee Arthroscopy Meniscectomy Bundle"),
        ("BND-93458", "93452", "Left Heart Catheterization Bundle"),
        ("BND-93458", "93567", "Left Heart Catheterization Bundle"),
        ("BND-80061", "82465", "Lipid Panel Bundle"),
        ("BND-80061", "83718", "Lipid Panel Bundle"),
        ("BND-80061", "84478", "Lipid Panel Bundle")
    ]
    cur.executemany(
        "INSERT INTO bundle_definitions (bundle_code, component_code, bundle_name) VALUES (?, ?, ?)",
        bundles
    )

    # 2. LOCATIONS
    locations = [
        "New York, NY", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
        "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX",
        "Jacksonville, FL", "Austin, TX", "Seattle, WA", "Miami, FL"
    ]

    # 3. SPECIALTIES & PEER GROUPS
    specialties = [
        ("Family Medicine", "PEER-FM", 120.0, 30.0),
        ("Internal Medicine", "PEER-IM", 140.0, 35.0),
        ("Orthopedic Surgery", "PEER-ORTHO", 450.0, 110.0),
        ("Cardiology", "PEER-CARD", 380.0, 95.0),
        ("Physical Therapy", "PEER-PT", 95.0, 20.0),
        ("Pain Management", "PEER-PAIN", 310.0, 75.0),
        ("Diagnostic Radiology", "PEER-RAD", 220.0, 50.0),
        ("Clinical Laboratory", "PEER-LAB", 65.0, 15.0),
        ("Behavioral Health", "PEER-BH", 130.0, 28.0),
        ("Ambulance Services", "PEER-AMB", 550.0, 120.0),
    ]

    # Populate code_peer_baselines
    peer_baseline_rows = []
    procedure_codes_by_spec = {
        "Family Medicine": [("99213", 85.0, 15.0, 0.45), ("99214", 130.0, 20.0, 0.35), ("99215", 190.0, 30.0, 0.08), ("99395", 160.0, 25.0, 0.12)],
        "Internal Medicine": [("99213", 90.0, 18.0, 0.40), ("99214", 140.0, 22.0, 0.40), ("99215", 200.0, 35.0, 0.10)],
        "Orthopedic Surgery": [("29881", 1200.0, 250.0, 0.20), ("20610", 150.0, 30.0, 0.35), ("27447", 3500.0, 600.0, 0.10), ("99214", 145.0, 25.0, 0.35)],
        "Cardiology": [("93000", 65.0, 12.0, 0.40), ("93306", 420.0, 80.0, 0.25), ("93458", 2200.0, 400.0, 0.15), ("99214", 150.0, 25.0, 0.20)],
        "Physical Therapy": [("97110", 75.0, 15.0, 0.45), ("97140", 70.0, 14.0, 0.30), ("97530", 85.0, 18.0, 0.25)],
        "Pain Management": [("62322", 550.0, 95.0, 0.30), ("64483", 650.0, 110.0, 0.30), ("99214", 140.0, 25.0, 0.40)],
        "Diagnostic Radiology": [("71046", 95.0, 20.0, 0.40), ("70450", 350.0, 70.0, 0.35), ("72148", 550.0, 95.0, 0.25)],
        "Clinical Laboratory": [("80053", 60.0, 12.0, 0.35), ("85025", 35.0, 8.0, 0.35), ("80061", 45.0, 10.0, 0.30)],
        "Behavioral Health": [("90834", 125.0, 22.0, 0.50), ("90837", 175.0, 30.0, 0.35), ("90791", 210.0, 35.0, 0.15)],
        "Ambulance Services": [("A0427", 750.0, 140.0, 0.60), ("A0425", 18.0, 4.0, 0.40)],
    }

    for spec_name, peer_grp, _, _ in specialties:
        procs = procedure_codes_by_spec.get(spec_name, [("99213", 100.0, 20.0, 1.0)])
        for pcode, avg_amt, std_amt, util in procs:
            peer_baseline_rows.append((peer_grp, pcode, avg_amt, std_amt, util))

    cur.executemany(
        "INSERT INTO code_peer_baselines (peer_group, procedure_code, avg_amount, std_amount, utilization_rate) VALUES (?, ?, ?, ?, ?)",
        peer_baseline_rows
    )

    # 4. FACILITIES (150 facilities including Decoy hospital)
    facilities = []
    # Mandatory Decoy Facility
    facilities.append((
        "FAC-DECOY-METRO",
        "Metro General University Medical Center",
        "General Acute Hospital",
        "New York, NY",
        "GRP-METRO-HEALTH",
        "NORMAL"
    ))
    # Planted scenario facilities
    facilities.append(("FAC-SC01-METRO", "Apex Regional Surgical & Pain Center", "Ambulatory Surgery Center", "Miami, FL", "GRP-APEX-SYNDICATE", "NORMAL"))
    facilities.append(("FAC-SC02-RURAL", "Evergreen Rural Health Clinic", "Outpatient Clinic", "Seattle, WA", "GRP-EVERGREEN", "NORMAL"))
    facilities.append(("FAC-SC03-CLINIC", "PrimeCare Specialty Diagnostic Suite", "Diagnostic Center", "Houston, TX", "GRP-PRIMECARE", "NORMAL"))
    facilities.append(("FAC-SC04-CENTER", "Pinnacle Physical Rehabilitation Pavilion", "Rehabilitation Facility", "Chicago, IL", "GRP-PINNACLE", "NORMAL"))

    fac_types = ["General Hospital", "Outpatient Surgical Center", "Diagnostic Imaging Center", "Urgent Care Center", "Rehabilitation Hospital", "Dialysis Center"]
    for i in range(1, 145):
        fac_id = f"FAC-{i:04d}"
        fac_name = f"{random.choice(['St. Jude', 'Community', 'Mercy', 'Horizon', 'Bayview', 'Heritage'])} {random.choice(fac_types)} {i}"
        fac_type = random.choice(fac_types)
        loc = random.choice(locations)
        grp = f"GRP-OWN-{(i % 30):03d}"
        facilities.append((fac_id, fac_name, fac_type, loc, grp, "NORMAL"))

    cur.executemany(
        "INSERT INTO facilities (facility_id, facility_name, facility_type, location, ownership_group, risk_indicator) VALUES (?, ?, ?, ?, ?, ?)",
        facilities
    )

    # 5. PROVIDERS (1,200 providers including planted and decoys)
    providers = []
    # Mandatory Decoy Provider
    providers.append((
        "PRV-DECOY-ORTHO",
        "Dr. Marcus Vance (Summit Orthopedic Group)",
        "Orthopedic Surgery",
        "Individual / Group Practice",
        "PEER-ORTHO",
        "New York, NY",
        "OWN-DECOY-VANCE",
        "ADDR-DECOY-METRO",
        "PHN-DECOY-1000",
        "TAX-DECOY-5500",
        "NORMAL",
        0
    ))

    # SC-01 Coordinated Billing Network Providers
    sc01_providers = [
        ("PRV-SC01-A", "Dr. Victor Vance", "Pain Management", "Individual Physician", "PEER-PAIN", "Miami, FL", "OWN-SC01-CORP", "ADDR-SC01-PLAZA", "PHN-SC01-8888", "TAX-SC01-9999", "ELEVATED", 1),
        ("PRV-SC01-B", "Dr. Elena Rostova", "Physical Therapy", "Group Practice", "PEER-PT", "Miami, FL", "OWN-SC01-CORP", "ADDR-SC01-PLAZA", "PHN-SC01-8888", "TAX-SC01-9999", "NORMAL", 0),
        ("PRV-SC01-C", "Dr. Julian Sterling", "Diagnostic Radiology", "Solo Clinic", "PEER-RAD", "Miami, FL", "OWN-SC01-CORP", "ADDR-SC01-PLAZA", "PHN-SC01-7777", "TAX-SC01-9999", "NORMAL", 0),
        ("PRV-SC01-D", "Dr. Damon Thorne", "Orthopedic Surgery", "Specialty Partner", "PEER-ORTHO", "Miami, FL", "OWN-SC01-CORP", "ADDR-SC01-ANNEX", "PHN-SC01-7777", "TAX-SC01-9999", "NORMAL", 0),
    ]
    for p in sc01_providers:
        providers.append(p)

    # SC-02 Impossible Timing / Phantom Service Provider
    providers.append(("PRV-SC02-PHANTOM", "Dr. Arthur Pendelton", "Family Medicine", "Solo Physician", "PEER-FM", "Seattle, WA", "OWN-SC02-PEND", "ADDR-SC02-RURAL", "PHN-SC02-1234", "TAX-SC02-2345", "NORMAL", 0))

    # SC-03 Duplicate Billing + Unbundling Provider
    providers.append(("PRV-SC03-DUP", "Dr. Chloe Bennett", "Orthopedic Surgery", "Surgical Specialist", "PEER-ORTHO", "Houston, TX", "OWN-SC03-BENN", "ADDR-SC03-HOU", "PHN-SC03-3456", "TAX-SC03-3456", "NORMAL", 0))
    providers.append(("PRV-SC03-ASSIST", "Dr. Noah Miller", "Clinical Laboratory", "Lab Director", "PEER-LAB", "Houston, TX", "OWN-SC03-BENN", "ADDR-SC03-HOU", "PHN-SC03-3456", "TAX-SC03-3456", "NORMAL", 0))

    # SC-04 Referral Concentration Provider
    providers.append(("PRV-SC04-REFERRAL", "Dr. Gregory House-Kovacs", "Internal Medicine", "Primary Care", "PEER-IM", "Chicago, IL", "OWN-SC04-KOV", "ADDR-SC04-CHI", "PHN-SC04-5678", "TAX-SC04-6789", "NORMAL", 0))
    providers.append(("PRV-SC04-TARGET", "Dr. Raymond Shaw", "Physical Therapy", "Physical Therapist", "PEER-PT", "Chicago, IL", "OWN-SC04-SHAW", "ADDR-SC04-CHI2", "PHN-SC04-9988", "TAX-SC04-1122", "NORMAL", 0))

    # SC-05 Upcoding Provider
    providers.append(("PRV-SC05-UPCODE", "Dr. Lawrence Sterling", "Family Medicine", "Solo Physician", "PEER-FM", "Dallas, TX", "OWN-SC05-STER", "ADDR-SC05-DAL", "PHN-SC05-9900", "TAX-SC05-8811", "NORMAL", 0))

    # Generate remaining ~1,180 background providers
    first_names = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]

    for i in range(1, 1180):
        prv_id = f"PRV-{i:04d}"
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        spec, peer_grp, _, _ = random.choice(specialties)
        ptype = random.choice(["Individual Physician", "Solo Clinic", "Group Practice", "Hospitalist"])
        loc = random.choice(locations)
        own_id = f"OWN-{random.randint(1, 600):04d}"
        addr_id = f"ADDR-{random.randint(1, 700):04d}"
        phone_id = f"PHN-{random.randint(1, 800):04d}"
        tax_id = f"TAX-{random.randint(1, 600):04d}"
        providers.append((
            prv_id, f"Dr. {fn} {ln}", spec, ptype, peer_grp, loc,
            own_id, addr_id, phone_id, tax_id, "NORMAL", 0
        ))

    cur.executemany(
        """INSERT INTO providers (
            provider_id, provider_name, specialty, provider_type, peer_group,
            location, owner_id, address_id, phone_id, tax_id, risk_history, investigation_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        providers
    )

    # 6. INVESTIGATIONS HISTORY
    investigations_history = [
        ("INV-2024-0012", "PRV-SC01-A", "CLOSED_FOUND_UNSUBSTANTIATED", "ELEVATED", "2024-05-15", "Advisory Issued - High Billing Velocity", "Moderate"),
        ("INV-2023-0089", "PRV-0012", "CLOSED_CLEARED", "NORMAL", "2023-11-10", "Standard Audit - No Finding", "Limited"),
        ("INV-2024-0044", "PRV-0045", "CLOSED_SETTLED", "ELEVATED", "2024-08-22", "Restitution Agreement", "Strong"),
        ("INV-2025-0005", "PRV-0105", "CLOSED_CLEARED", "NORMAL", "2025-01-18", "Peer Comparison Cleared", "Limited")
    ]
    cur.executemany(
        """INSERT INTO investigations_history (
            investigation_id, related_provider_id, case_status, previous_risk,
            investigation_date, outcome, evidence_strength
        ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
        investigations_history
    )

    # 7. MEMBERS (6,000 synthetic members)
    members = []
    age_groups = ["18-30", "31-45", "46-60", "61-75", "76+"]
    member_ids = []

    # SC-02 dedicated members with coverage end
    members.append(("MBR-SC02-EXPIRED", "Alex Mercer (Synthetic)", "46-60", "Seattle, WA", "TERMINATED", "2024-01-01", "2025-10-31"))
    members.append(("MBR-SC02-TRAVEL", "Jordan Reed (Synthetic)", "31-45", "Seattle, WA", "ACTIVE", "2024-01-01", None))
    members.append(("MBR-SC02-INPATIENT", "Taylor Brooks (Synthetic)", "61-75", "Chicago, IL", "ACTIVE", "2024-01-01", None))

    # Dedicated clean members for Decoys (100% active, zero stay overlaps, zero travel anomalies)
    decoy1_members = [f"MBR-DEC1-{i:04d}" for i in range(1, 1200)]
    for mid in decoy1_members:
        members.append((mid, f"Synthetic_{mid}", random.choice(age_groups), "New York, NY", "ACTIVE", "2023-01-01", None))

    decoy2_members = [f"MBR-DEC2-{i:04d}" for i in range(1, 600)]
    for mid in decoy2_members:
        members.append((mid, f"Synthetic_{mid}", random.choice(age_groups), "New York, NY", "ACTIVE", "2023-01-01", None))

    for i in range(1, 4500):
        mid = f"MBR-{i:05d}"
        member_ids.append(mid)
        name = f"Member_{i:05d}"
        ag = random.choice(age_groups)
        loc = random.choice(locations)
        cov_start = (AS_OF_DATE - timedelta(days=random.randint(400, 1500))).strftime("%Y-%m-%d")
        cov_end = None
        if random.random() < 0.05:
            cov_end = (AS_OF_DATE - timedelta(days=random.randint(15, 120))).strftime("%Y-%m-%d")
            status = "TERMINATED"
        else:
            status = "ACTIVE"
        members.append((mid, name, ag, loc, status, cov_start, cov_end))

    cur.executemany(
        "INSERT INTO members (member_id, synthetic_name, age_group, location, enrollment_status, coverage_start, coverage_end) VALUES (?, ?, ?, ?, ?, ?, ?)",
        members
    )

    # 8. MEMBER STAYS (Inpatient admissions for phantom service cross-checking)
    member_stays = [
        ("STY-001", "MBR-SC02-INPATIENT", "FAC-0001", "2025-11-10", "2025-11-20"),
        ("STY-002", "MBR-00010", "FAC-0002", "2025-06-01", "2025-06-08"),
        ("STY-003", "MBR-00025", "FAC-0003", "2025-08-14", "2025-08-21"),
        ("STY-004", "MBR-00050", "FAC-0004", "2025-12-05", "2025-12-14"),
    ]
    # Add random legitimate stays for background members
    for s_idx in range(5, 200):
        smid = random.choice(member_ids[:300])
        sfac = random.choice([f[0] for f in facilities if not f[0].startswith("FAC-DECOY") and not f[0].startswith("FAC-SC02")])
        admit = AS_OF_DATE - timedelta(days=random.randint(30, 340))
        disch = admit + timedelta(days=random.randint(2, 10))
        member_stays.append((
            f"STY-{s_idx:04d}", smid, sfac,
            admit.strftime("%Y-%m-%d"), disch.strftime("%Y-%m-%d")
        ))

    cur.executemany(
        "INSERT INTO member_stays (stay_id, member_id, facility_id, admit_date, discharge_date) VALUES (?, ?, ?, ?, ?)",
        member_stays
    )

    # 9. REFERRALS (Planted + realistic background network)
    referrals = []
    ref_id_counter = 1

    # SC-01 high referral concentration (85%+ concentration between PRV-SC01-A, B, C, D)
    for _ in range(75):
        referrals.append((
            f"REF-{ref_id_counter:05d}",
            "PRV-SC01-A",
            random.choice(["PRV-SC01-B", "PRV-SC01-C", "PRV-SC01-D"]),
            random.choice(member_ids[:200]),
            (AS_OF_DATE - timedelta(days=random.randint(10, 200))).strftime("%Y-%m-%d"),
            "FAC-SC01-METRO"
        ))
        ref_id_counter += 1
    # SC-01 few other referrals (10%)
    for _ in range(8):
        referrals.append((
            f"REF-{ref_id_counter:05d}",
            "PRV-SC01-A",
            f"PRV-{random.randint(1, 50):04d}",
            random.choice(member_ids[:200]),
            (AS_OF_DATE - timedelta(days=random.randint(10, 200))).strftime("%Y-%m-%d"),
            "FAC-SC01-METRO"
        ))
        ref_id_counter += 1

    # SC-04 Referral concentration: PRV-SC04-REFERRAL sends 92% of referrals to PRV-SC04-TARGET
    for _ in range(92):
        referrals.append((
            f"REF-{ref_id_counter:05d}",
            "PRV-SC04-REFERRAL",
            "PRV-SC04-TARGET",
            random.choice(member_ids[200:400]),
            (AS_OF_DATE - timedelta(days=random.randint(15, 250))).strftime("%Y-%m-%d"),
            "FAC-SC04-CENTER"
        ))
        ref_id_counter += 1
    for _ in range(8):
        referrals.append((
            f"REF-{ref_id_counter:05d}",
            "PRV-SC04-REFERRAL",
            f"PRV-{random.randint(50, 100):04d}",
            random.choice(member_ids[200:400]),
            (AS_OF_DATE - timedelta(days=random.randint(15, 250))).strftime("%Y-%m-%d"),
            "FAC-SC04-CENTER"
        ))
        ref_id_counter += 1

    # Background referrals for normal providers (~2,000 distributed referrals)
    for _ in range(2200):
        ref_p1 = f"PRV-{random.randint(1, 400):04d}"
        ref_p2 = f"PRV-{random.randint(1, 400):04d}"
        if ref_p1 != ref_p2:
            referrals.append((
                f"REF-{ref_id_counter:05d}",
                ref_p1,
                ref_p2,
                random.choice(member_ids[:1000]),
                (AS_OF_DATE - timedelta(days=random.randint(5, 360))).strftime("%Y-%m-%d"),
                random.choice([f[0] for f in facilities[:20]])
            ))
            ref_id_counter += 1

    cur.executemany(
        "INSERT INTO referrals (referral_id, referring_provider_id, receiving_provider_id, member_id, referral_date, facility_id) VALUES (?, ?, ?, ?, ?, ?)",
        referrals
    )

    # 10. CLAIMS GENERATION (~18,000 - 22,000 claims)
    claims = []
    claim_id_counter = 1

    planted_sc01_claims = []
    planted_sc02_claims = []
    planted_sc03_claims = []
    planted_sc04_claims = []
    planted_sc05_claims = []

    # A. MANDATORY DECOY 1: Metro General University Medical Center (FAC-DECOY-METRO)
    # Generates ~2,500 legitimate claims with diverse doctors, standard rates, zero duplicate anomalies
    decoy_prvs = [f"PRV-{i:04d}" for i in range(10, 110)]
    for _ in range(2500):
        srv_date = AS_OF_DATE - timedelta(days=random.randint(1, 360))
        sub_date = srv_date + timedelta(days=random.randint(2, 14))
        p = random.choice(decoy_prvs)
        m = random.choice(decoy1_members)
        pcode, base_amt, std_amt, _ = random.choice(procedure_codes_by_spec["Internal Medicine"])
        billed = round(max(30.0, random.gauss(base_amt * 1.25, std_amt)), 2)
        paid = round(billed * 0.80, 2)
        cid = f"CLM-DEC-{claim_id_counter:06d}"
        claims.append((
            cid, m, p, "FAC-DECOY-METRO", srv_date.strftime("%Y-%m-%d"), sub_date.strftime("%Y-%m-%d"),
            "facility", pcode, "Z00.00", billed, paid, 1, "PAID", "21 - Inpatient Hospital", "New York, NY", None
        ))
        claim_id_counter += 1

    # B. MANDATORY DECOY 2: Summit Orthopedic Group (PRV-DECOY-ORTHO)
    # Generates ~800 legitimate high-volume orthopedic claims with normal peer ratios
    for _ in range(800):
        srv_date = AS_OF_DATE - timedelta(days=random.randint(1, 360))
        sub_date = srv_date + timedelta(days=random.randint(2, 10))
        m = random.choice(decoy2_members)
        pcode, base_amt, std_amt, _ = random.choice(procedure_codes_by_spec["Orthopedic Surgery"])
        billed = round(max(80.0, random.gauss(base_amt * 1.1, std_amt)), 2)
        paid = round(billed * 0.82, 2)
        cid = f"CLM-DEC-{claim_id_counter:06d}"
        claims.append((
            cid, m, "PRV-DECOY-ORTHO", "FAC-0001", srv_date.strftime("%Y-%m-%d"), sub_date.strftime("%Y-%m-%d"),
            "professional", pcode, "M25.561", billed, paid, 1, "PAID", "11 - Office", "New York, NY", None
        ))
        claim_id_counter += 1


    # C. SC-01 Planted Scenario: Coordinated Billing Network (Escalating month-over-month)
    # Providers: PRV-SC01-A, B, C, D at FAC-SC01-METRO
    # Month 1-6 (before cutoff): ~40 claims/month
    # Month 7-12 (approaching AS_OF_DATE): escalates to ~120 claims/month with duplicates & unbundling
    sc01_members = member_ids[50:110]
    for month_back in range(12, 0, -1):
        # Rising frequency
        claims_in_month = 35 + (12 - month_back) * 16
        for _ in range(claims_in_month):
            days_ago = month_back * 30 - random.randint(0, 28)
            srv_date = AS_OF_DATE - timedelta(days=max(1, days_ago))
            sub_date = srv_date + timedelta(days=random.randint(1, 5))
            m = random.choice(sc01_members)
            p = random.choice(["PRV-SC01-A", "PRV-SC01-B", "PRV-SC01-C", "PRV-SC01-D"])
            # High pain / therapy / ortho billing
            stype = "professional"
            pcode = "62322" if p == "PRV-SC01-A" else ("97110" if p == "PRV-SC01-B" else ("72148" if p == "PRV-SC01-C" else "29881"))
            billed = 750.0 if pcode == "62322" else (160.0 if pcode == "97110" else (820.0 if pcode == "72148" else 1850.0))
            paid = round(billed * 0.85, 2)
            cid = f"CLM-SC01-{claim_id_counter:06d}"
            claims.append((
                cid, m, p, "FAC-SC01-METRO", srv_date.strftime("%Y-%m-%d"), sub_date.strftime("%Y-%m-%d"),
                stype, pcode, "M54.5", billed, paid, 1, "PAID", "24 - Ambulatory Surgical Center", "Miami, FL", None
            ))
            planted_sc01_claims.append(cid)
            claim_id_counter += 1

            # Plant duplicate claims inside SC-01 in recent 3 months
            if month_back <= 3 and random.random() < 0.22:
                cid_dup = f"CLM-SC01-DUP-{claim_id_counter:06d}"
                sub_dup = srv_date + timedelta(days=random.randint(1, 3))
                claims.append((
                    cid_dup, m, p, "FAC-SC01-METRO", srv_date.strftime("%Y-%m-%d"), sub_dup.strftime("%Y-%m-%d"),
                    stype, pcode, "M54.5", billed, paid, 1, "PAID", "24 - Ambulatory Surgical Center", "Miami, FL", None
                ))
                planted_sc01_claims.append(cid_dup)
                claim_id_counter += 1

    # D. SC-02 Planted Scenario: Impossible Timing / Phantom Service
    # 1. Conflicting inpatient stay: MBR-SC02-INPATIENT admitted at FAC-0001 (Chicago) from 2025-11-10 to 2025-11-20
    # Plant claims by PRV-SC02-PHANTOM in Seattle, WA on 2025-11-14 and 2025-11-15
    for dt_str in ["2025-11-14", "2025-11-15"]:
        cid = f"CLM-SC02-{claim_id_counter:06d}"
        claims.append((
            cid, "MBR-SC02-INPATIENT", "PRV-SC02-PHANTOM", "FAC-SC02-RURAL", dt_str, dt_str,
            "professional", "99214", "R07.9", 220.0, 180.0, 1, "PAID", "11 - Office", "Seattle, WA", None
        ))
        planted_sc02_claims.append(cid)
        claim_id_counter += 1

    # 2. Billing after coverage end: MBR-SC02-EXPIRED terminated on 2025-10-31
    for dt_str in ["2025-11-25", "2025-12-10", "2026-01-15"]:
        cid = f"CLM-SC02-{claim_id_counter:06d}"
        claims.append((
            cid, "MBR-SC02-EXPIRED", "PRV-SC02-PHANTOM", "FAC-SC02-RURAL", dt_str, dt_str,
            "professional", "99214", "Z00.00", 210.0, 175.0, 1, "PAID", "11 - Office", "Seattle, WA", None
        ))
        planted_sc02_claims.append(cid)
        claim_id_counter += 1

    # 3. Impossible geographic distance on same day:
    # MBR-SC02-TRAVEL billed by PRV-0010 in Miami, FL at 10:00 AM and PRV-SC02-PHANTOM in Seattle, WA on 2026-02-12
    cid_travel1 = f"CLM-SC02-{claim_id_counter:06d}"
    claims.append((
        cid_travel1, "MBR-SC02-TRAVEL", "PRV-0010", "FAC-0005", "2026-02-12", "2026-02-13",
        "professional", "99213", "M79.1", 120.0, 95.0, 1, "PAID", "11 - Office", "Miami, FL", None
    ))
    planted_sc02_claims.append(cid_travel1)
    claim_id_counter += 1

    cid_travel2 = f"CLM-SC02-{claim_id_counter:06d}"
    claims.append((
        cid_travel2, "MBR-SC02-TRAVEL", "PRV-SC02-PHANTOM", "FAC-SC02-RURAL", "2026-02-12", "2026-02-13",
        "professional", "99214", "M79.1", 240.0, 195.0, 1, "PAID", "11 - Office", "Seattle, WA", None
    ))
    planted_sc02_claims.append(cid_travel2)
    claim_id_counter += 1

    # 4. Implausible daily capacity: PRV-SC02-PHANTOM billing 32 units/services on 2026-03-05
    for u in range(28):
        cid = f"CLM-SC02-VOL-{claim_id_counter:06d}"
        claims.append((
            cid, random.choice(member_ids[:100]), "PRV-SC02-PHANTOM", "FAC-SC02-RURAL", "2026-03-05", "2026-03-06",
            "professional", "99214", "Z00.00", 185.0, 150.0, 1, "PAID", "11 - Office", "Seattle, WA", None
        ))
        planted_sc02_claims.append(cid)
        claim_id_counter += 1

    # E. SC-03 Planted Scenario: Duplicate Billing + Unbundling
    # PRV-SC03-DUP and PRV-SC03-ASSIST at FAC-SC03-CLINIC
    # Unbundling: Components 29877 and 29870 billed on same date for knee surgery where BND-29881 applies
    # Components 80048 and 84443 billed on same date where BND-80053 applies
    for i in range(18):
        m = random.choice(member_ids[100:150])
        dt = (AS_OF_DATE - timedelta(days=random.randint(5, 180))).strftime("%Y-%m-%d")
        # Component 1
        cid1 = f"CLM-SC03-UNB1-{claim_id_counter:06d}"
        claims.append((
            cid1, m, "PRV-SC03-DUP", "FAC-SC03-CLINIC", dt, dt,
            "facility", "29877", "M23.22", 980.0, 810.0, 1, "PAID", "24 - Ambulatory Surgical Center", "Houston, TX", None
        ))
        planted_sc03_claims.append(cid1)
        claim_id_counter += 1
        # Component 2
        cid2 = f"CLM-SC03-UNB2-{claim_id_counter:06d}"
        claims.append((
            cid2, m, "PRV-SC03-DUP", "FAC-SC03-CLINIC", dt, dt,
            "facility", "29870", "M23.22", 750.0, 620.0, 1, "PAID", "24 - Ambulatory Surgical Center", "Houston, TX", None
        ))
        planted_sc03_claims.append(cid2)
        claim_id_counter += 1

    # Exact duplicate billing pairs (same member, provider, date, procedure, amount)
    for _ in range(16):
        m = random.choice(member_ids[150:200])
        dt = (AS_OF_DATE - timedelta(days=random.randint(2, 90))).strftime("%Y-%m-%d")
        sub1 = dt
        sub2 = (datetime.strptime(dt, "%Y-%m-%d") + timedelta(days=random.randint(1, 3))).strftime("%Y-%m-%d")
        cid_a = f"CLM-SC03-DUP-A-{claim_id_counter:06d}"
        claims.append((
            cid_a, m, "PRV-SC03-DUP", "FAC-SC03-CLINIC", dt, sub1,
            "professional", "29881", "M23.22", 1450.0, 1200.0, 1, "PAID", "24 - Ambulatory Surgical Center", "Houston, TX", None
        ))
        planted_sc03_claims.append(cid_a)
        claim_id_counter += 1

        cid_b = f"CLM-SC03-DUP-B-{claim_id_counter:06d}"
        claims.append((
            cid_b, m, "PRV-SC03-DUP", "FAC-SC03-CLINIC", dt, sub2,
            "professional", "29881", "M23.22", 1450.0, 1200.0, 1, "PAID", "24 - Ambulatory Surgical Center", "Houston, TX", None
        ))
        planted_sc03_claims.append(cid_b)
        claim_id_counter += 1

    # F. SC-04 Planted Scenario: Referral Concentration & Excessive Utilization
    # PRV-SC04-TARGET receives massive volume, 5.2x peer standard deviation
    for _ in range(420):
        srv_date = AS_OF_DATE - timedelta(days=random.randint(1, 280))
        sub_date = srv_date + timedelta(days=random.randint(1, 4))
        m = random.choice(member_ids[200:350])
        cid = f"CLM-SC04-{claim_id_counter:06d}"
        claims.append((
            cid, m, "PRV-SC04-TARGET", "FAC-SC04-CENTER", srv_date.strftime("%Y-%m-%d"), sub_date.strftime("%Y-%m-%d"),
            "professional", "97110", "M54.5", 145.0, 125.0, 1, "PAID", "11 - Office", "Chicago, IL", None
        ))
        planted_sc04_claims.append(cid)
        claim_id_counter += 1

    # G. SC-05 Planted Scenario: Upcoding / Unusual Billing
    # PRV-SC05-UPCODE bills 85% 99215 ($280.00 vs peer $190 avg)
    for _ in range(250):
        srv_date = AS_OF_DATE - timedelta(days=random.randint(1, 300))
        sub_date = srv_date + timedelta(days=random.randint(1, 5))
        m = random.choice(member_ids[350:500])
        # 85% Level 5 comprehensive code
        pcode = "99215" if random.random() < 0.85 else "99214"
        amt = 285.0 if pcode == "99215" else 175.0
        cid = f"CLM-SC05-{claim_id_counter:06d}"
        claims.append((
            cid, m, "PRV-SC05-UPCODE", "FAC-0010", srv_date.strftime("%Y-%m-%d"), sub_date.strftime("%Y-%m-%d"),
            "professional", pcode, "I10", amt, round(amt * 0.85, 2), 1, "PAID", "11 - Office", "Dallas, TX", None
        ))
        planted_sc05_claims.append(cid)
        claim_id_counter += 1

    # H. Background Normal Claims (~12,000 claims across other providers)
    normal_prvs = [f"PRV-{i:04d}" for i in range(110, 1180)]
    for _ in range(12500):
        srv_date = AS_OF_DATE - timedelta(days=random.randint(1, 360))
        sub_date = srv_date + timedelta(days=random.randint(2, 20))
        p = random.choice(normal_prvs)
        m = random.choice(member_ids)
        fac = random.choice(facilities)[0]
        stype = random.choice(SERVICE_TYPES)
        # Select procedure code based on service type
        if stype == "professional":
            pcode = random.choice(["99213", "99214", "99212"])
            amt = round(random.gauss(110.0, 20.0), 2)
        elif stype == "facility":
            pcode = random.choice(["99283", "99284", "29881"])
            amt = round(random.gauss(450.0, 90.0), 2)
        elif stype == "pharmacy":
            pcode = "RX-GEN"
            amt = round(random.gauss(65.0, 15.0), 2)
        elif stype == "laboratory":
            pcode = random.choice(["80053", "85025", "80061"])
            amt = round(random.gauss(55.0, 10.0), 2)
        elif stype == "ambulance":
            pcode = "A0427"
            amt = round(random.gauss(650.0, 80.0), 2)
        elif stype == "behavioral_health":
            pcode = random.choice(["90834", "90837"])
            amt = round(random.gauss(135.0, 22.0), 2)
        elif stype == "home_health":
            pcode = "G0151"
            amt = round(random.gauss(140.0, 25.0), 2)
        else: # DME
            pcode = "E0601"
            amt = round(random.gauss(210.0, 40.0), 2)

        amt = max(15.0, amt)
        paid = round(amt * 0.80, 2)
        cid = f"CLM-NORM-{claim_id_counter:06d}"
        claims.append((
            cid, m, p, fac, srv_date.strftime("%Y-%m-%d"), sub_date.strftime("%Y-%m-%d"),
            stype, pcode, "R00.0", amt, paid, 1, "PAID", "11 - Office", random.choice(locations), None
        ))
        claim_id_counter += 1

    cur.executemany(
        """INSERT INTO claims (
            claim_id, member_id, provider_id, facility_id, service_date, submission_date,
            service_type, procedure_code, diagnosis_code, billed_amount, paid_amount,
            units, claim_status, place_of_service, location, referral_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        claims
    )

    # 11. RELATIONSHIPS TABLE (Explicit network edges)
    relationships = []
    # SC-01 shared owner/address/phone
    relationships.append(("provider", "PRV-SC01-A", "provider", "PRV-SC01-B", "shared_owner", 2.0))
    relationships.append(("provider", "PRV-SC01-B", "provider", "PRV-SC01-C", "shared_owner", 2.0))
    relationships.append(("provider", "PRV-SC01-C", "provider", "PRV-SC01-D", "shared_owner", 2.0))
    relationships.append(("provider", "PRV-SC01-A", "facility", "FAC-SC01-METRO", "shared_facility", 2.5))
    relationships.append(("provider", "PRV-SC01-B", "facility", "FAC-SC01-METRO", "shared_facility", 2.5))
    relationships.append(("provider", "PRV-SC01-C", "facility", "FAC-SC01-METRO", "shared_facility", 2.5))
    relationships.append(("provider", "PRV-SC01-D", "facility", "FAC-SC01-METRO", "shared_facility", 2.5))

    # SC-03 shared address/tax
    relationships.append(("provider", "PRV-SC03-DUP", "provider", "PRV-SC03-ASSIST", "shared_tax_id", 2.0))
    relationships.append(("provider", "PRV-SC03-DUP", "facility", "FAC-SC03-CLINIC", "shared_facility", 2.5))

    # SC-04 high referral relationship
    relationships.append(("provider", "PRV-SC04-REFERRAL", "provider", "PRV-SC04-TARGET", "concentrated_referral", 3.0))

    cur.executemany(
        "INSERT INTO relationships (source_type, source_id, target_type, target_id, relationship_type, weight) VALUES (?, ?, ?, ?, ?, ?)",
        relationships
    )

    # 12. CONFIG TABLE (Initial rules and weights)
    default_configs = [
        ("rules_enabled", json.dumps({
            "duplicate_billing": True,
            "unbundling": True,
            "phantom_service": True,
            "impossible_timing": True,
            "excessive_utilization": True,
            "unusual_billing": True,
            "referral_concentration": True,
            "shared_identity_linkage": True
        })),
        ("thresholds", json.dumps({
            "utilization_zscore": 2.5,
            "unusual_billing_zscore": 2.5,
            "referral_concentration_pct": 0.70,
            "min_cluster_evidence_types": 1,
            "min_cluster_supporting_claims": 2
        })),
        ("service_type_weights", json.dumps({
            "professional": 1.0,
            "facility": 1.2,
            "pharmacy": 0.9,
            "laboratory": 0.8,
            "ambulance": 1.3,
            "behavioral_health": 1.4,
            "home_health": 1.3,
            "dme": 1.1
        })),
        ("investigation_capacity", "15"),
        ("priority_strategy", "Balanced")
    ]
    cur.executemany(
        "INSERT INTO config (key, value_json, updated_at) VALUES (?, ?, ?)",
        [(k, v, AS_OF_DATE_STR) for k, v in default_configs]
    )

    # 13. GROUND TRUTH TABLE (READ ONLY BY EVALUATION MODULE, NOT DETECTION)
    ground_truth = [
        (
            "SC-01",
            "Coordinated Billing Network",
            "Multi-provider entity syndicate sharing address/tax_id, high referral concentration, duplicate claims, and escalating volume.",
            json.dumps(["PRV-SC01-A", "PRV-SC01-B", "PRV-SC01-C", "PRV-SC01-D", "FAC-SC01-METRO"]),
            json.dumps(planted_sc01_claims[:50]),
            json.dumps(["shared_identity_linkage", "referral_concentration", "duplicate_billing", "excessive_utilization"]),
            len(planted_sc01_claims),
            "HIGH",
            0
        ),
        (
            "SC-02",
            "Impossible Timing / Phantom Service",
            "Billing during member inpatient stay, claims after coverage expiration, and impossible geographic distances.",
            json.dumps(["PRV-SC02-PHANTOM", "FAC-SC02-RURAL", "MBR-SC02-EXPIRED", "MBR-SC02-INPATIENT", "MBR-SC02-TRAVEL"]),
            json.dumps(planted_sc02_claims),
            json.dumps(["phantom_service", "impossible_timing"]),
            len(planted_sc02_claims),
            "HIGH",
            0
        ),
        (
            "SC-03",
            "Duplicate Billing + Unbundling",
            "Near-identical claims within 48h and separate billing of surgical/lab components where bundles exist.",
            json.dumps(["PRV-SC03-DUP", "PRV-SC03-ASSIST", "FAC-SC03-CLINIC"]),
            json.dumps(planted_sc03_claims),
            json.dumps(["duplicate_billing", "unbundling", "shared_identity_linkage"]),
            len(planted_sc03_claims),
            "HIGH",
            0
        ),
        (
            "SC-04",
            "Referral Concentration + Excessive Utilization",
            "92% referral concentration funnel between providers with therapy utilization > 5x peer standard deviation.",
            json.dumps(["PRV-SC04-REFERRAL", "PRV-SC04-TARGET", "FAC-SC04-CENTER"]),
            json.dumps(planted_sc04_claims),
            json.dumps(["referral_concentration", "excessive_utilization"]),
            len(planted_sc04_claims),
            "HIGH",
            0
        ),
        (
            "SC-05",
            "Upcoding / Unusual Billing",
            "85% Level 5 billing mix and procedure charges exceeding peer baseline.",
            json.dumps(["PRV-SC05-UPCODE", "FAC-0010"]),
            json.dumps(planted_sc05_claims),
            json.dumps(["unusual_billing"]),
            len(planted_sc05_claims),
            "ELEVATED",
            0
        ),
        # Mandatory Decoy Ground Truth Records (Expected risk band: NORMAL, is_decoy=1)
        (
            "DECOY-01",
            "Metro General University Medical Center (High Volume Hospital Decoy)",
            "High-volume legitimate university hospital with >2,500 claims and >100 providers. Must NOT be flagged as high-risk case.",
            json.dumps(["FAC-DECOY-METRO"]),
            json.dumps([]),
            json.dumps([]),
            0,
            "NORMAL",
            1
        ),
        (
            "DECOY-02",
            "Summit Comprehensive Orthopedics (High Volume Practice Decoy)",
            "High-volume legitimate orthopedic group with >800 claims. Must NOT be flagged as high-risk case.",
            json.dumps(["PRV-DECOY-ORTHO"]),
            json.dumps([]),
            json.dumps([]),
            0,
            "NORMAL",
            1
        )
    ]

    cur.executemany(
        """INSERT INTO ground_truth_scenarios (
            scenario_id, scenario_name, pattern_description, involved_entities,
            claim_ids, expected_signal_types, expected_signal_count, expected_risk_band, is_decoy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ground_truth
    )

    # Initial Audit Log entry
    cur.execute(
        """INSERT INTO audit_log (timestamp, event_type, entity_type, entity_id, actor_role, details)
        VALUES (datetime('now'), 'SYSTEM_INIT', 'SYSTEM', 'DB', 'System', 'Synthetic dataset seeded successfully.')"""
    )

    conn.commit()
    conn.close()

    counts = {
        "claims": len(claims),
        "providers": len(providers),
        "members": len(members),
        "facilities": len(facilities),
        "referrals": len(referrals),
        "member_stays": len(member_stays),
        "scenarios": len(ground_truth)
    }
    return counts

if __name__ == "__main__":
    stats = generate_synthetic_data()
    print("Synthetic Data Generation Complete:", stats)
