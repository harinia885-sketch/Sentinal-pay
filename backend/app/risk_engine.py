from datetime import datetime, timezone

from .ml_model import FraudRiskModel, build_model
from .models import RiskDecision, RuleContribution, SignalBundle
from .store import Store

TIERS = [
    (70.0, "hold", "#dc2626", "Adaptive hold + bank alert"),
    (50.0, "verify", "#d97706", "Verify via independent channel"),
    (30.0, "warn", "#ca8a04", "Warn before processing"),
    (0.0, "allow", "#16a34a", "Allow — zero friction"),
]

RULE_MAX = 100.0


class RiskEngine:
    def __init__(self, store: Store, model: FraudRiskModel) -> None:
        self.store = store
        self.model = model

    # -------------------------------------------------------------- rules
    def _rules(self, s: SignalBundle) -> list:
        rules = []

        if s.call_active:
            rules.append(
                RuleContribution(
                    signal="call",
                    points=10,
                    max_points=20,
                    label="Active call during payment",
                    reason=f"Payment initiated while a call is active ({s.call_duration_sec}s). "
                    "This matches call-scam manipulation patterns.",
                )
            )

        kw = s.urgency_keywords or []
        if kw:
            rules.append(
                RuleContribution(
                    signal="urgency",
                    points=min(15, 3 + 3 * len(kw)),
                    max_points=15,
                    label="Urgency keywords detected",
                    reason="Live transcript contains pressure phrases: "
                    + ", ".join(f'"{k}"' for k in kw[:5])
                    + ". Scammers manufacture urgency to bypass OTP checks.",
                )
            )

        if s.screen_share_active:
            rules.append(
                RuleContribution(
                    signal="screen_share",
                    points=20,
                    max_points=20,
                    label="Screen-share / remote access active",
                    reason="Screen-sharing is live, giving the caller full visibility of "
                    "OTPs, app PINs and balances — the OTP-relay loophole.",
                )
            )

        if s.call_active and s.screen_share_active and kw:
            rules.append(
                RuleContribution(
                    signal="scam_triad",
                    points=20,
                    max_points=20,
                    label="Call + screen-share + urgency triad",
                    reason="The exact scam signature from the brief: urgency + new "
                    "beneficiary + active call + screen-share.",
                )
            )

        if s.beneficiary_age_days < 30:
            rules.append(
                RuleContribution(
                    signal="new_beneficiary",
                    points=15,
                    max_points=15,
                    label="Beneficiary is brand new",
                    reason=f"Paying a beneficiary with only {s.beneficiary_age_days} days of "
                    "history — common in one-shot fraud payouts.",
                )
            )
        elif s.beneficiary_age_days < 120:
            rules.append(
                RuleContribution(
                    signal="new_beneficiary",
                    points=7,
                    max_points=15,
                    label="Beneficiary recently added",
                    reason=f"Beneficiary history is only {s.beneficiary_age_days} days old.",
                )
            )

        if s.avg_amount_30d > 0:
            ratio = s.amount / s.avg_amount_30d
            if ratio > 10:
                rules.append(
                    RuleContribution(
                        signal="amount",
                        points=12,
                        max_points=12,
                        label="Amount far above usual spend",
                        reason=f"₹{s.amount:,.0f} is {ratio:.1f}x the 30-day average of "
                        f"₹{s.avg_amount_30d:,.0f} — a drain/emptying signature.",
                    )
                )
            elif ratio > 3:
                rules.append(
                    RuleContribution(
                        signal="amount",
                        points=6,
                        max_points=12,
                        label="Amount above usual spend",
                        reason=f"₹{s.amount:,.0f} is {ratio:.1f}x the 30-day average.",
                    )
                )

        if not s.device_trusted:
            rules.append(
                RuleContribution(
                    signal="device",
                    points=7,
                    max_points=10,
                    label="Untrusted device",
                    reason="Payment from an unrecognised device flagged by device intelligence.",
                )
            )
        if s.geo_distance_km > 100:
            rules.append(
                RuleContribution(
                    signal="geo",
                    points=4,
                    max_points=5,
                    label="Location mismatch",
                    reason=f"Device geo {s.geo_distance_km:.0f}km from usual location.",
                )
            )

        if s.voice_anomaly_score >= 0.7:
            rules.append(
                RuleContribution(
                    signal="voice_clone",
                    points=20,
                    max_points=20,
                    label="Voice-clone / synthetic speech detected",
                    reason=f"Deepfake detector scored {s.voice_anomaly_score:.0%} "
                    "confidence that the caller's voice is synthetic — impersonation.",
                )
            )
        elif s.voice_anomaly_score >= 0.5:
            rules.append(
                RuleContribution(
                    signal="voice_clone",
                    points=10,
                    max_points=20,
                    label="Suspicious voice score",
                    reason=f"Voice clone probability {s.voice_anomaly_score:.0%}.",
                )
            )

        if s.txn_frequency_anomaly > 1.5:
            rules.append(
                RuleContribution(
                    signal="frequency",
                    points=5,
                    max_points=5,
                    label="Unusual transaction frequency",
                    reason="Payment burst well above the user's normal cadence.",
                )
            )

        if s.last_txn_minutes_ago < 3 and s.amount > max(s.avg_amount_30d, 5000):
            rules.append(
                RuleContribution(
                    signal="rapid_repeat",
                    points=4,
                    max_points=5,
                    label="Rapid repeat transfer",
                    reason="Another meaningful transfer just moments earlier — re-drain pattern.",
                )
            )
        return rules

    # ------------------------------------------------------------- scoring
    def score(self, s: SignalBundle) -> dict:
        rules = self._rules(s)
        rule_score = min(RULE_MAX, round(sum(r.points for r in rules), 1))

        row = s.model_dump()
        p_fraud, conf = self.model.predict_proba(row)
        ml_score = round(p_fraud * 100, 1)

        fused = round(0.6 * rule_score + 0.4 * ml_score, 1)
        tier, color, label = self._tier(fused)
        contributions = sorted(rules, key=lambda r: r.points, reverse=True)

        explanation = self._explanation(contributions, rule_score, s)
        action = f"Recommended: {label}."

        evidence = {
            "txn_id": s.txn_id,
            "signals": {
                k: row[k]
                for k in (
                    "amount",
                    "beneficiary",
                    "beneficiary_age_days",
                    "call_active",
                    "urgency_keywords",
                    "screen_share_active",
                    "device_trusted",
                    "geo_distance_km",
                    "voice_anomaly_score",
                )
            },
            "rule_breakdown": [
                {"signal": c.signal, "points": c.points, "reason": c.reason}
                for c in contributions
            ],
            "ml_probability": round(p_fraud, 4),
            "ml_version": self.model.version,
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }

        decision = RiskDecision(
            txn_id=s.txn_id,
            score=fused,
            tier=tier,
            tier_color=color,
            tier_label=label,
            rule_score=rule_score,
            ml_score=ml_score,
            ml_confidence=conf,
            contributions=[c.model_dump() for c in contributions],
            explanation=explanation,
            recommended_action=action,
            created_at=datetime.now(timezone.utc).isoformat(),
            scenario=s.scenario,
            signals=row,
        )
        self.store.add_transaction(decision.model_dump())
        return decision.model_dump()

    @staticmethod
    def _tier(score: float) -> tuple:
        for threshold, tier, color, label in TIERS:
            if score >= threshold:
                return tier, color, label
        return "allow", "#16a34a", "Allow — zero friction"

    @staticmethod
    def _explanation(contributions, rule_score, s) -> str:
        if rule_score < 30:
            return (
                f"No scam indicators above threshold. Known beneficiary "
                f"({s.beneficiary_age_days:.0f}d history), no active call or screen-share. "
                "Processed with zero friction."
            )
        top = contributions[:3]
        parts = "; ".join(c.reason for c in top)
        return f"{parts}"

    # ------------------------------------------------------------- feedback
    def record_feedback(self, txn_id: str, was_fraudulent: bool, notes: str) -> dict:
        rec = {
            "txn_id": txn_id,
            "was_fraudulent": was_fraudulent,
            "notes": notes,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.store.add_feedback(rec)
        return rec

    def retrain(self) -> dict:
        for fb in self.store.feedback[-50:]:
            txn = next((t for t in self.store.transactions if t["txn_id"] == fb["txn_id"]), None)
            if not txn:
                continue
            row = txn.get("signals") or {}
            fb_row = {
                f: row.get(f, 0.0)
                for f in (
                    "amount",
                    "beneficiary_age_days",
                    "call_active",
                    "screen_share_active",
                    "device_trusted",
                    "geo_distance_km",
                    "voice_anomaly_score",
                    "urgency_keywords",
                    "avg_amount_30d",
                    "txn_frequency_anomaly",
                    "txn_hour",
                    "last_txn_minutes_ago",
                )
            }
            fb_row["fraud"] = int(fb["was_fraudulent"])
            self.model.feedback_rows.append(fb_row)
        self.model.fit()
        return {
            "version": self.model.version,
            "train_samples": self.model.train_samples,
            "roc_auc": self.model.roc_auc,
            "feedback_used": len(self.model.feedback_rows),
        }


def build_engine(store: Store) -> RiskEngine:
    model = build_model()
    return RiskEngine(store, model)