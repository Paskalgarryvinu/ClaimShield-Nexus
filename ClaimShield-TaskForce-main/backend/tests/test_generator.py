"""Unit tests for Phase 1 synthetic generator and database integrity."""
import os
import gc
import tempfile
import pytest
from app.generator.synthetic_generator import generate_synthetic_data
from app.database import query_all, query_one

def test_synthetic_data_generation_and_integrity():
    fd, test_db = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    try:

        stats = generate_synthetic_data(test_db)

        # Check scale bounds
        assert stats["claims"] >= 15000, "Should generate at least 15,000 claims"
        assert stats["providers"] >= 1000, "Should generate at least 1,000 providers"
        assert stats["members"] >= 5000, "Should generate at least 5,000 members"
        assert stats["facilities"] >= 140, "Should generate at least 140 facilities"
        assert stats["referrals"] >= 2000, "Should generate at least 2,000 referrals"

        # Check Decoys exist
        metro_decoy = query_one("SELECT * FROM facilities WHERE facility_id = 'FAC-DECOY-METRO'", db_path=test_db)
        assert metro_decoy is not None, "Mandatory Decoy hospital FAC-DECOY-METRO must exist"
        assert metro_decoy["risk_indicator"] == "NORMAL"

        ortho_decoy = query_one("SELECT * FROM providers WHERE provider_id = 'PRV-DECOY-ORTHO'", db_path=test_db)
        assert ortho_decoy is not None, "Mandatory Decoy provider PRV-DECOY-ORTHO must exist"
        assert ortho_decoy["risk_history"] == "NORMAL"

        # Check Planted Scenarios in Ground Truth
        sc01 = query_one("SELECT * FROM ground_truth_scenarios WHERE scenario_id = 'SC-01'", db_path=test_db)
        assert sc01 is not None, "Planted scenario SC-01 must exist in ground truth"
        assert sc01["is_decoy"] == 0

        decoy_gt = query_one("SELECT * FROM ground_truth_scenarios WHERE scenario_id = 'DECOY-01'", db_path=test_db)
        assert decoy_gt is not None, "Decoy must be registered in ground truth table"
        assert decoy_gt["is_decoy"] == 1

        # Check bundle definitions
        bundles = query_all("SELECT * FROM bundle_definitions", db_path=test_db)
        assert len(bundles) >= 5, "Bundle definitions must be populated"

        # Check member stays
        stays = query_all("SELECT * FROM member_stays", db_path=test_db)
        assert len(stays) >= 100, "Member stays must be populated"

    finally:
        gc.collect()
        if os.path.exists(test_db):
            try:
                os.remove(test_db)
            except Exception:
                pass

