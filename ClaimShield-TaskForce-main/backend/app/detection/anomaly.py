"""Provider Behavioral Anomaly Detection Model (Isolation Forest).
Implements the Liu, Ting, Zhou (2008) Isolation Forest algorithm in pure NumPy.
All features are PEER-GROUP NORMALIZED (z-scores vs peer group), NOT raw volume.
Language: 'behavioral anomaly', 'unusual pattern', never 'fraud'.
"""
import os
import json
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List
from app.config import RANDOM_SEED, DB_PATH, AS_OF_DATE_STR, BACKEND_DIR
from app.database import get_db_connection

MODEL_ARTIFACT_DIR = os.path.join(BACKEND_DIR, "models")
MODEL_ARTIFACT_PATH = os.path.join(MODEL_ARTIFACT_DIR, "isolation_forest.joblib")
MODEL_METADATA_PATH = os.path.join(MODEL_ARTIFACT_DIR, "isolation_forest_meta.json")

def c_factor(n: int) -> float:
    """Average path length of unsuccessful search in Binary Search Tree (Liu et al. 2008)."""
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (np.log(n - 1) + 0.5772156649) - (2.0 * (n - 1) / n)

class IsolationTreeNode:
    def __init__(self, max_depth: int):
        self.max_depth = max_depth
        self.left = None
        self.right = None
        self.split_feat = None
        self.split_val = None
        self.size = 0

    def fit(self, X: np.ndarray, depth: int = 0, rng: np.random.RandomState = None):
        n_samples, n_features = X.shape
        self.size = n_samples
        if depth >= self.max_depth or n_samples <= 1:
            return self

        # Randomly choose a feature
        self.split_feat = rng.randint(0, n_features)
        feat_vals = X[:, self.split_feat]
        min_v, max_v = feat_vals.min(), feat_vals.max()
        if min_v == max_v:
            return self

        # Random split between min and max
        self.split_val = rng.uniform(min_v, max_v)
        left_mask = feat_vals < self.split_val
        self.left = IsolationTreeNode(self.max_depth).fit(X[left_mask], depth + 1, rng)
        self.right = IsolationTreeNode(self.max_depth).fit(X[~left_mask], depth + 1, rng)
        return self

    def path_length(self, x: np.ndarray, depth: int = 0) -> float:
        if self.left is None or self.right is None:
            return depth + c_factor(self.size)
        if x[self.split_feat] < self.split_val:
            return self.left.path_length(x, depth + 1)
        else:
            return self.right.path_length(x, depth + 1)

class PureIsolationForest:
    """Pure NumPy implementation of Isolation Forest (Liu, Ting, Zhou 2008)."""
    def __init__(self, n_estimators: int = 100, max_samples: int = 256, random_state: int = RANDOM_SEED):
        self.n_estimators = n_estimators
        self.max_samples = max_samples
        self.random_state = random_state
        self.trees: List[IsolationTreeNode] = []
        self.c_val: float = 1.0

    def fit(self, X: np.ndarray):
        rng = np.random.RandomState(self.random_state)
        n_samples = X.shape[0]
        subsample_size = min(self.max_samples, n_samples)
        max_depth = int(np.ceil(np.log2(max(subsample_size, 2))))
        self.c_val = c_factor(subsample_size)
        self.trees = []
        for _ in range(self.n_estimators):
            idx = rng.choice(n_samples, subsample_size, replace=False)
            tree = IsolationTreeNode(max_depth).fit(X[idx], rng=rng)
            self.trees.append(tree)
        return self

    def score_samples(self, X: np.ndarray) -> np.ndarray:
        paths = np.zeros((X.shape[0], len(self.trees)))
        for t_idx, tree in enumerate(self.trees):
            for i in range(X.shape[0]):
                paths[i, t_idx] = tree.path_length(X[i])
        mean_paths = paths.mean(axis=1)
        # Score in [0, 1] where 1.0 is highest anomaly
        scores = 2.0 ** (-mean_paths / max(self.c_val, 1e-5))
        return scores

def extract_provider_features(claims_df: pd.DataFrame, providers_df: pd.DataFrame, referrals_df: pd.DataFrame, signals_df: pd.DataFrame = None) -> Tuple[pd.DataFrame, List[str]]:
    """Extracts peer-group normalized behavioral features per provider, avoiding raw volume bias."""
    prv_base = providers_df[["provider_id", "peer_group", "specialty"]].copy()

    agg = claims_df.groupby("provider_id").agg(
        claim_count=("claim_id", "count"),
        unique_members=("member_id", "nunique"),
        avg_billed=("billed_amount", "mean"),
        avg_paid=("paid_amount", "mean"),
        unique_facilities=("facility_id", "nunique"),
        unique_services=("service_type", "nunique")
    ).reset_index()

    agg["claims_per_member"] = agg["claim_count"] / agg["unique_members"].replace(0, 1)
    agg["paid_to_billed_ratio"] = agg["avg_paid"] / agg["avg_billed"].replace(0, 1)
    agg["service_diversity"] = agg["unique_services"] / np.maximum(np.log1p(agg["claim_count"]), 1.0)

    # Referral concentration feature
    ref_totals = referrals_df.groupby("referring_provider_id").size().reset_index(name="total_refs")
    ref_pairs = referrals_df.groupby(["referring_provider_id", "receiving_provider_id"]).size().reset_index(name="pair_refs")
    if not ref_pairs.empty and not ref_totals.empty:
        merged_ref = ref_pairs.merge(ref_totals, on="referring_provider_id")
        merged_ref["pair_pct"] = merged_ref["pair_refs"] / merged_ref["total_refs"]
        max_ref = merged_ref.groupby("referring_provider_id")["pair_pct"].max().reset_index(name="max_referral_conc")
        agg = agg.merge(max_ref, left_on="provider_id", right_on="referring_provider_id", how="left")
        agg.drop(columns=["referring_provider_id"], inplace=True, errors="ignore")
    else:
        agg["max_referral_conc"] = 0.0

    agg["max_referral_conc"] = agg["max_referral_conc"].fillna(0.0)

    # Signal density features if signals available
    if signals_df is not None and not signals_df.empty:
        sig_counts = signals_df.groupby(["primary_entity_id", "signal_type"]).size().unstack(fill_value=0).reset_index()
        sig_counts.rename(columns={"primary_entity_id": "provider_id"}, inplace=True)
        agg = agg.merge(sig_counts, on="provider_id", how="left")
        for stype in ["duplicate_billing", "unbundling", "phantom_service", "impossible_timing", "excessive_utilization"]:
            if stype not in agg.columns:
                agg[stype] = 0
            agg[f"{stype}_rate"] = agg[stype].fillna(0) / np.maximum(agg["claim_count"], 1.0)
    else:
        for stype in ["duplicate_billing", "unbundling", "phantom_service", "impossible_timing", "excessive_utilization"]:
            agg[f"{stype}_rate"] = 0.0

    features_df = prv_base.merge(agg, on="provider_id", how="left")
    numeric_cols = [
        "claims_per_member", "avg_billed", "avg_paid", "paid_to_billed_ratio",
        "max_referral_conc", "duplicate_billing_rate", "unbundling_rate",
        "phantom_service_rate", "excessive_utilization_rate"
    ]
    for col in numeric_cols:
        features_df[col] = features_df[col].fillna(0.0)

    # PEER GROUP NORMALIZATION (z-scores within peer_group)
    normalized_cols = []
    for col in numeric_cols:
        norm_col = f"{col}_zscore"
        normalized_cols.append(norm_col)

        def calc_z(series):
            m = series.mean()
            s = series.std()
            if pd.isna(s) or s < 1e-4:
                return series * 0.0
            return (series - m) / s

        features_df[norm_col] = features_df.groupby("peer_group")[col].transform(calc_z)
        features_df[norm_col] = features_df[norm_col].clip(-3.0, 5.0)

    return features_df, normalized_cols

def train_and_score_isolation_forest(db_path: str = DB_PATH) -> Dict[str, Dict[str, Any]]:
    """Trains Isolation Forest on peer-normalized provider features and returns scores."""
    os.makedirs(MODEL_ARTIFACT_DIR, exist_ok=True)
    conn = get_db_connection(db_path)

    claims_df = pd.read_sql_query("SELECT * FROM claims", conn)
    providers_df = pd.read_sql_query("SELECT * FROM providers", conn)
    referrals_df = pd.read_sql_query("SELECT * FROM referrals", conn)
    signals_df = pd.read_sql_query("SELECT * FROM signals", conn)
    conn.close()

    features_df, norm_cols = extract_provider_features(claims_df, providers_df, referrals_df, signals_df)

    X = features_df[norm_cols].values

    iso_model = PureIsolationForest(
        n_estimators=100,
        max_samples=min(256, len(X)),
        random_state=RANDOM_SEED
    )
    iso_model.fit(X)

    raw_scores = iso_model.score_samples(X)
    min_s, max_s = raw_scores.min(), raw_scores.max()
    norm_scores = (raw_scores - min_s) / max(max_s - min_s, 1e-5)

    joblib.dump(iso_model, MODEL_ARTIFACT_PATH)

    meta = {
        "version": "1.0.0-isolation-forest",
        "algorithm": "Liu, Ting, Zhou (2008) Isolation Forest",
        "trained_date": AS_OF_DATE_STR,
        "n_estimators": 100,
        "features": norm_cols,
        "random_seed": RANDOM_SEED,
        "total_providers": len(features_df)
    }
    with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    results: Dict[str, Dict[str, Any]] = {}
    for idx, row in features_df.iterrows():
        p_id = row["provider_id"]
        sc = round(float(norm_scores[idx]), 4)
        results[p_id] = {
            "provider_id": p_id,
            "peer_group": row["peer_group"],
            "specialty": row["specialty"],
            "anomaly_score": sc,
            "is_anomaly": bool(sc >= 0.70),
            "label": "Behavioral Anomaly" if sc >= 0.70 else "Normal Behavioral Profile"
        }

    return results

if __name__ == "__main__":
    scores = train_and_score_isolation_forest()
    print(f"Computed anomaly scores for {len(scores)} providers.")
