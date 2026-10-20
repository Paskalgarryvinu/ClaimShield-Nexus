"""ClaimShield Nexus Configuration."""
import os
from datetime import datetime, date

RANDOM_SEED: int = 42
AS_OF_DATE_STR: str = "2026-03-31"
AS_OF_DATE: date = datetime.strptime(AS_OF_DATE_STR, "%Y-%m-%d").date()
FORECAST_CUTOFF_DATE_STR: str = "2026-01-01"
FORECAST_CUTOFF_DATE: date = datetime.strptime(FORECAST_CUTOFF_DATE_STR, "%Y-%m-%d").date()

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_PATH: str = os.path.join(BACKEND_DIR, "claimshield.db")


# Service Types
SERVICE_TYPES = [
    "professional",
    "facility",
    "pharmacy",
    "laboratory",
    "ambulance",
    "behavioral_health",
    "home_health",
    "dme"
]

# Service Type Impact Weights
SERVICE_TYPE_WEIGHTS = {
    "professional": 1.0,
    "facility": 1.2,
    "pharmacy": 0.9,
    "laboratory": 0.8,
    "ambulance": 1.3,
    "behavioral_health": 1.4,
    "home_health": 1.3,
    "dme": 1.1
}

# SIU Investigation default capacity
DEFAULT_INVESTIGATION_CAPACITY: int = 15

# Default SIU Priority Strategy: Balanced, Exposure, MemberImpact, Evidence, Severity
DEFAULT_PRIORITY_STRATEGY: str = "Balanced"
