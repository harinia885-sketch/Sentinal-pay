from typing import Dict, List, Optional
from pydantic import BaseModel


class SignalBundle(BaseModel):
    txn_id: str
    payer: str
    beneficiary: str
    beneficiary_id: str
    amount: float
    currency: str = "INR"
    timestamp: str
    call_active: bool = False
    call_duration_sec: int = 0
    urgency_keywords: List[str] = []
    screen_share_active: bool = False
    device_trusted: bool = True
    geo_distance_km: float = 0.0
    voice_anomaly_score: float = 0.0
    beneficiary_age_days: int = 0
    avg_amount_30d: float = 0.0
    txn_frequency_anomaly: float = 0.0
    txn_hour: int = 0
    last_txn_minutes_ago: int = 0
    scenario: str = "live"


class RuleContribution(BaseModel):
    signal: str
    points: float
    max_points: float
    label: str
    reason: str


class RiskDecision(BaseModel):
    txn_id: str
    score: float
    tier: str
    tier_color: str
    tier_label: str
    rule_score: float
    ml_score: float
    ml_confidence: float
    contributions: List[RuleContribution]
    explanation: str
    recommended_action: str
    created_at: str
    scenario: str
    signals: Dict = {}


class FeedbackRequest(BaseModel):
    was_fraudulent: bool
    notes: str = ""


class ScenarioSpec(BaseModel):
    scenario: str