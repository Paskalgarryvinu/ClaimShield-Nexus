-- ClaimShield Nexus Schema (Authoritative Final)

-- Drop existing tables
DROP TABLE IF EXISTS claims;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS facilities;
DROP TABLE IF EXISTS referrals;
DROP TABLE IF EXISTS relationships;
DROP TABLE IF EXISTS investigations_history;
DROP TABLE IF EXISTS member_stays;
DROP TABLE IF EXISTS bundle_definitions;
DROP TABLE IF EXISTS code_peer_baselines;
DROP TABLE IF EXISTS signals;
DROP TABLE IF EXISTS cases;
DROP TABLE IF EXISTS case_members;
DROP TABLE IF EXISTS case_claims;
DROP TABLE IF EXISTS risk_scores;
DROP TABLE IF EXISTS forecasts;
DROP TABLE IF EXISTS queue_entries;
DROP TABLE IF EXISTS case_decisions;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS analysis_runs;
DROP TABLE IF EXISTS config;
DROP TABLE IF EXISTS ground_truth_scenarios;

-- Core Entity Tables
CREATE TABLE providers (
    provider_id TEXT PRIMARY KEY,
    provider_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    peer_group TEXT NOT NULL,
    location TEXT NOT NULL,
    owner_id TEXT,
    address_id TEXT,
    phone_id TEXT,
    tax_id TEXT,
    risk_history TEXT DEFAULT 'NORMAL',
    investigation_count INTEGER DEFAULT 0
);

CREATE TABLE members (
    member_id TEXT PRIMARY KEY,
    synthetic_name TEXT NOT NULL,
    age_group TEXT NOT NULL,
    location TEXT NOT NULL,
    enrollment_status TEXT NOT NULL,
    coverage_start TEXT NOT NULL,
    coverage_end TEXT
);

CREATE TABLE facilities (
    facility_id TEXT PRIMARY KEY,
    facility_name TEXT NOT NULL,
    facility_type TEXT NOT NULL,
    location TEXT NOT NULL,
    ownership_group TEXT,
    risk_indicator TEXT DEFAULT 'NORMAL'
);

CREATE TABLE claims (
    claim_id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    facility_id TEXT,
    service_date TEXT NOT NULL,
    submission_date TEXT NOT NULL,
    service_type TEXT NOT NULL,
    procedure_code TEXT NOT NULL,
    diagnosis_code TEXT NOT NULL,
    billed_amount REAL NOT NULL,
    paid_amount REAL NOT NULL,
    units INTEGER NOT NULL DEFAULT 1,
    claim_status TEXT NOT NULL DEFAULT 'PAID',
    place_of_service TEXT NOT NULL,
    location TEXT NOT NULL,
    referral_id TEXT,
    FOREIGN KEY(member_id) REFERENCES members(member_id),
    FOREIGN KEY(provider_id) REFERENCES providers(provider_id),
    FOREIGN KEY(facility_id) REFERENCES facilities(facility_id)
);

CREATE TABLE referrals (
    referral_id TEXT PRIMARY KEY,
    referring_provider_id TEXT NOT NULL,
    receiving_provider_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    referral_date TEXT NOT NULL,
    facility_id TEXT,
    FOREIGN KEY(referring_provider_id) REFERENCES providers(provider_id),
    FOREIGN KEY(receiving_provider_id) REFERENCES providers(provider_id),
    FOREIGN KEY(member_id) REFERENCES members(member_id)
);

CREATE TABLE relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE investigations_history (
    investigation_id TEXT PRIMARY KEY,
    related_provider_id TEXT NOT NULL,
    case_status TEXT NOT NULL,
    previous_risk TEXT NOT NULL,
    investigation_date TEXT NOT NULL,
    outcome TEXT NOT NULL,
    evidence_strength TEXT NOT NULL,
    FOREIGN KEY(related_provider_id) REFERENCES providers(provider_id)
);

CREATE TABLE member_stays (
    stay_id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    admit_date TEXT NOT NULL,
    discharge_date TEXT NOT NULL,
    FOREIGN KEY(member_id) REFERENCES members(member_id),
    FOREIGN KEY(facility_id) REFERENCES facilities(facility_id)
);

CREATE TABLE bundle_definitions (
    bundle_code TEXT NOT NULL,
    component_code TEXT NOT NULL,
    bundle_name TEXT NOT NULL,
    PRIMARY KEY(bundle_code, component_code)
);

CREATE TABLE code_peer_baselines (
    peer_group TEXT NOT NULL,
    procedure_code TEXT NOT NULL,
    avg_amount REAL NOT NULL,
    std_amount REAL NOT NULL,
    utilization_rate REAL NOT NULL,
    PRIMARY KEY(peer_group, procedure_code)
);

-- Analysis Pipeline Tables
CREATE TABLE signals (
    signal_id TEXT PRIMARY KEY,
    signal_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    primary_entity_type TEXT NOT NULL,
    primary_entity_id TEXT NOT NULL,
    claim_ids TEXT NOT NULL, -- JSON array
    evidence_fields TEXT NOT NULL, -- JSON object
    rule_parameters TEXT NOT NULL, -- JSON object
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE cases (
    case_id TEXT PRIMARY KEY,
    case_type TEXT NOT NULL,
    risk_score REAL NOT NULL,
    risk_band TEXT NOT NULL, -- NORMAL / MONITORED / ELEVATED / HIGH / CRITICAL
    exposure_amount REAL NOT NULL,
    member_impact_level TEXT NOT NULL, -- Low / Medium / High / Critical
    member_count INTEGER NOT NULL,
    severity_level TEXT NOT NULL, -- Low / Moderate / High / Critical
    evidence_strength TEXT NOT NULL, -- Limited / Moderate / Strong
    confidence_score REAL NOT NULL, -- 0 to 100
    confidence_breakdown TEXT, -- JSON breakdown
    status TEXT NOT NULL DEFAULT 'NEW', -- NEW / IN REVIEW / EVIDENCE REQUESTED / ESCALATED / CLOSED / FALSE POSITIVE
    primary_provider_id TEXT,
    summary_description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE case_members (
    case_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'INVOLVED',
    PRIMARY KEY(case_id, entity_type, entity_id),
    FOREIGN KEY(case_id) REFERENCES cases(case_id)
);

CREATE TABLE case_claims (
    case_id TEXT NOT NULL,
    claim_id TEXT NOT NULL,
    signal_id TEXT,
    PRIMARY KEY(case_id, claim_id),
    FOREIGN KEY(case_id) REFERENCES cases(case_id)
);

CREATE TABLE risk_scores (
    case_id TEXT PRIMARY KEY,
    total_score REAL NOT NULL,
    behavior_points REAL NOT NULL,
    network_points REAL NOT NULL,
    anomaly_points REAL NOT NULL,
    history_points REAL NOT NULL,
    temporal_points REAL NOT NULL,
    breakdown_json TEXT NOT NULL,
    FOREIGN KEY(case_id) REFERENCES cases(case_id)
);

CREATE TABLE forecasts (
    case_id TEXT NOT NULL,
    horizon_days INTEGER NOT NULL, -- 30, 60, 90
    repeat_risk_prob REAL NOT NULL, -- 0.0 to 1.0
    confidence_interval_low REAL NOT NULL,
    confidence_interval_high REAL NOT NULL,
    top_drivers TEXT NOT NULL, -- JSON array of feature contributions
    model_version TEXT NOT NULL,
    PRIMARY KEY(case_id, horizon_days),
    FOREIGN KEY(case_id) REFERENCES cases(case_id)
);

CREATE TABLE queue_entries (
    case_id TEXT PRIMARY KEY,
    priority_score REAL NOT NULL,
    priority_rank INTEGER NOT NULL,
    is_priority_investigation INTEGER NOT NULL DEFAULT 0,
    strategy_used TEXT NOT NULL,
    FOREIGN KEY(case_id) REFERENCES cases(case_id)
);

CREATE TABLE case_decisions (
    decision_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY(case_id) REFERENCES cases(case_id)
);

CREATE TABLE audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    actor_role TEXT NOT NULL,
    details TEXT NOT NULL
);

CREATE TABLE analysis_runs (
    run_id TEXT PRIMARY KEY,
    run_timestamp TEXT NOT NULL,
    duration_sec REAL NOT NULL,
    claims_count INTEGER NOT NULL,
    signals_count INTEGER NOT NULL,
    cases_count INTEGER NOT NULL,
    status TEXT NOT NULL,
    logs_json TEXT
);

CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Ground Truth Evaluation Table (ONLY READ BY EVALUATION MODULE)
CREATE TABLE ground_truth_scenarios (
    scenario_id TEXT PRIMARY KEY,
    scenario_name TEXT NOT NULL,
    pattern_description TEXT NOT NULL,
    involved_entities TEXT NOT NULL, -- JSON array
    claim_ids TEXT NOT NULL, -- JSON array
    expected_signal_types TEXT NOT NULL, -- JSON array
    expected_signal_count INTEGER NOT NULL,
    expected_risk_band TEXT NOT NULL,
    is_decoy INTEGER NOT NULL DEFAULT 0
);

-- Indexes for high-speed analysis queries
CREATE INDEX idx_claims_provider ON claims(provider_id);
CREATE INDEX idx_claims_member ON claims(member_id);
CREATE INDEX idx_claims_facility ON claims(facility_id);
CREATE INDEX idx_claims_service_date ON claims(service_date);
CREATE INDEX idx_claims_procedure ON claims(procedure_code);
CREATE INDEX idx_referrals_ref ON referrals(referring_provider_id);
CREATE INDEX idx_referrals_rec ON referrals(receiving_provider_id);
CREATE INDEX idx_member_stays_member ON member_stays(member_id);
CREATE INDEX idx_signals_entity ON signals(primary_entity_id);
CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);
CREATE INDEX idx_case_claims_claim ON case_claims(claim_id);
CREATE INDEX idx_case_members_entity ON case_members(entity_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_risk_score ON cases(risk_score);
