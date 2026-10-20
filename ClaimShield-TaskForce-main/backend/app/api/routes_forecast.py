"""Risk Forecast API routes."""
import os
import json
from fastapi import APIRouter, HTTPException, Query
from app.config import DB_PATH, AS_OF_DATE_STR, FORECAST_CUTOFF_DATE_STR
from app.database import query_all, query_one
from app.forecasting.forecast_models import (
    FORECAST_META_PATH, train_forecast_models, populate_case_forecasts
)

router = APIRouter(prefix="/api/forecast", tags=["forecast"])

@router.get("")
def get_forecast_overview(horizon: int = Query(30)):
    """Retrieve forecast models performance, holdout metrics, and global drivers."""
    if not os.path.exists(FORECAST_META_PATH):
        train_forecast_models()
        populate_case_forecasts()

    with open(FORECAST_META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    metrics_for_horizon = meta["metrics"].get(str(horizon), meta["metrics"].get("30"))

    # Distribution of probabilities across cases for this horizon
    cases_forecast = query_all(
        "SELECT repeat_risk_prob FROM forecasts WHERE horizon_days = ?",
        (horizon,)
    )
    probs = [c["repeat_risk_prob"] for c in cases_forecast]
    avg_prob = round(float(sum(probs) / max(len(probs), 1)), 3) if probs else 0.45

    return {
        "model_version": meta["model_version"],
        "algorithm": "Horizon-Specific L2 Logistic Classifier",
        "as_of_date": AS_OF_DATE_STR,
        "cutoff_date": FORECAST_CUTOFF_DATE_STR,
        "active_horizon": horizon,
        "explanation": f"Estimated probability of repeat/escalating suspicious behavior within {horizon} days post-investigation.",
        "holdout_metrics": metrics_for_horizon,
        "all_horizon_metrics": meta["metrics"],
        "cases_evaluated": len(probs),
        "average_escalation_risk": avg_prob,
        "uncertainty_note": "Risk forecasts represent probabilistic decision support based on pre-cutoff billing velocity trends, not a determination of fraud."
    }
