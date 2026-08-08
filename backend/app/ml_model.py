import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

FEATURES = [
    "amount_log",
    "ratio_to_avg",
    "beneficiary_age_days",
    "call_active",
    "urgency_kw_count",
    "screen_share",
    "device_trusted",
    "geo_distance_km",
    "voice_anomaly",
    "txn_hour",
    "freq_anomaly",
    "last_txn_minutes_ago",
]


class FraudRiskModel:
    """Behavioural risk model (gradient boosted trees) trained on synthetic UPI
    transaction data. Predicts P(fraud) from live signal features."""

    def __init__(self) -> None:
        self.model = None
        self.version = 1
        self.train_samples = 0
        self.roc_auc = 0.0
        self.feedback_rows = []

    # ------------------------------------------------------------------ data
    def _latent_prob(self, df: pd.DataFrame) -> np.ndarray:
        new_ben = (df["beneficiary_age_days"] < 30).astype(float)
        big_amt = (df["ratio_to_avg"] > 3.0).astype(float)
        triad = (
            df["call_active"].astype(float)
            * df["screen_share"].astype(float)
            * (df["urgency_kw_count"] > 0).astype(float)
        )
        logit = (
            -4.2
            + 1.6 * df["call_active"].astype(float)
            + 0.7 * df["urgency_kw_count"]
            + 1.9 * df["screen_share"].astype(float)
            + 1.4 * triad
            + 1.1 * new_ben
            + 0.9 * big_amt
            + 1.6 * df["voice_anomaly"]
            + 0.8 * (1 - df["device_trusted"].astype(float))
            + 0.4 * (df["geo_distance_km"] > 100).astype(float)
            + 0.35 * df["freq_anomaly"]
        )
        return 1.0 / (1.0 + np.exp(-logit))

    def _synth_df(self, n: int, seed: int) -> pd.DataFrame:
        rng = np.random.default_rng(seed)
        rows = {
            "amount_log": rng.uniform(3.5, 8.0, n),
            "ratio_to_avg": rng.lognormal(0.0, 0.9, n),
            "beneficiary_age_days": rng.uniform(0, 1500, n),
            "call_active": rng.binomial(1, 0.08, n),
            "urgency_kw_count": rng.poisson(0.25, n),
            "screen_share": rng.binomial(1, 0.03, n),
            "device_trusted": rng.binomial(1, 0.96, n),
            "geo_distance_km": rng.exponential(25, n),
            "voice_anomaly": rng.beta(1.2, 8.0, n),
            "txn_hour": rng.integers(0, 24, n),
            "freq_anomaly": rng.exponential(0.6, n),
            "last_txn_minutes_ago": rng.exponential(90, n),
        }
        df = pd.DataFrame(rows)
        p = self._latent_prob(df)
        df["fraud"] = rng.binomial(1, p)
        return df

    # ------------------------------------------------------------------ fit
    def fit(self) -> "FraudRiskModel":
        base = self._synth_df(14000, seed=42)
        if self.feedback_rows:
            fb = pd.DataFrame(self.feedback_rows)
            fb = pd.concat([fb] * 12, ignore_index=True)  # upweight human labels
            data = pd.concat([base, fb], ignore_index=True)
        else:
            data = base
        data["fraud"] = data["fraud"].astype(int)
        X = data[FEATURES]
        y = data["fraud"]
        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=7)
        model = GradientBoostingClassifier(
            n_estimators=160,
            max_depth=3,
            learning_rate=0.08,
            subsample=0.85,
            random_state=7,
        )
        model.fit(X_tr, y_tr)
        preds = model.predict_proba(X_te)[:, 1]
        self.model = model
        self.version += 1
        self.train_samples = len(data)
        self.roc_auc = round(float(roc_auc_score(y_te, preds)), 4)
        return self

    # ---------------------------------------------------------------- serve
    def features_from_row(self, row: dict) -> pd.DataFrame:
        features = {
            "amount_log": float(row.get("amount", 0.0)),
            "ratio_to_avg": 0.0,
            "beneficiary_age_days": float(row.get("beneficiary_age_days", 0)),
            "call_active": float(bool(row.get("call_active"))),
            "urgency_kw_count": float(len(row.get("urgency_keywords", []) or [])),
            "screen_share": float(bool(row.get("screen_share_active"))),
            "device_trusted": float(bool(row.get("device_trusted", True))),
            "geo_distance_km": float(row.get("geo_distance_km", 0.0)),
            "voice_anomaly": float(row.get("voice_anomaly_score", 0.0)),
            "txn_hour": float(row.get("txn_hour", 12)),
            "freq_anomaly": float(row.get("txn_frequency_anomaly", 0.0)),
            "last_txn_minutes_ago": float(row.get("last_txn_minutes_ago", 0)),
        }
        avg = float(row.get("avg_amount_30d", 0.0))
        if avg and avg > 0:
            features["amount_log"] = float(np.log(1.0 + max(row.get("amount", 0.0), 0.0)))
            features["ratio_to_avg"] = float(row.get("amount", 0.0) / avg)
        else:
            features["amount_log"] = float(np.log(1.0 + max(row.get("amount", 0.0), 0.0)))
            features["ratio_to_avg"] = 1.0
        return pd.DataFrame([features])[FEATURES]

    def predict_proba(self, row: dict) -> tuple:
        X = self.features_from_row(row)
        p = float(self.model.predict_proba(X)[0][1])
        conf = max(p, 1.0 - p)
        return p, round(conf, 3)


def build_model() -> FraudRiskModel:
    model = FraudRiskModel()
    model.fit()
    return model