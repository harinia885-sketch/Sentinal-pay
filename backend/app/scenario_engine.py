import random
import string
from datetime import datetime, timedelta, timezone

from .models import SignalBundle

FIRST = [
    "Aarav", "Priya", "Rohan", "Sneha", "Vikram", "Ananya", "Karthik", "Meera",
    "Arjun", "Divya", "Rahul", "Pooja", "Aditya", "Kavya", "Nikhil", "Ishita",
    "Siddharth", "Tanvi", "Dev", "Nisha", "Manish", "Rekha", "Suresh", "Lakshmi",
    "Balaji", "Usha", "Ganesh", "Sarala",
]
LAST = [
    "Sharma", "Iyer", "Patel", "Nair", "Reddy", "Gupta", "Kumar", "Das",
    "Menon", "Joshi", "Choudhary", "Saxena", "Pillai", "Rao", "Bhatt", "Mehta",
    "Deshmukh", "Kulkarni", "Shetty", "Bose", "Agarwal", "Verma",
]
HANDLES = ["@okhdfcbank", "@oksbi", "@okicici", "@paytm", "@okaxis", "@upi"]
BANKS = ["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank", "Kotak", "Paytm Payments Bank"]

KEYWORDS_POOL = [
    "urgent", "share screen", "OTP", "verification", "security", "police",
    "accident", "emergency", "refund", "KYC", "suspend", "block", "your son",
    "your daughter", "prize money", "investment", "loan", "GST", "help",
]
NOISE = ["hello", "hi", "ok", "yes", "thank you", "sure", "where", "when"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _txn_id(prefix: str = "TXN") -> str:
    stamp = datetime.now().strftime("%y%m%d%H%M%S")
    return f"{prefix}-{stamp}-{random.randint(1000, 9999)}"


def _person() -> str:
    return f"{random.choice(FIRST)} {random.choice(LAST)}"


def _upi(beneficiary: str) -> str:
    slug = beneficiary.lower().replace(" ", ".")[:12]
    return f"{slug}{random.choice(HANDLES)}"


def _base(scenario: str, amount: float, **over) -> SignalBundle:
    beneficiary = over.pop("beneficiary", _person())
    return SignalBundle(
        txn_id=_txn_id(),
        payer=f"{random.choice(FIRST)} {random.choice(LAST)}",
        beneficiary=beneficiary,
        beneficiary_id=_upi(beneficiary),
        amount=amount,
        timestamp=_now(),
        txn_hour=over.pop("txn_hour", random.randint(8, 23)),
        last_txn_minutes_ago=over.pop("last_txn_minutes_ago", random.randint(5, 240)),
        txn_frequency_anomaly=over.pop("txn_frequency_anomaly", round(random.uniform(0.2, 1.2), 2)),
        scenario=scenario,
        **over,
    )


class ScenarioEngine:
    """Generates synthetic UPI payment flows. Some legitimate, some injected
    with the exact scam signature (urgency + new beneficiary + call + screen-share)."""

    def __init__(self) -> None:
        self.known_age = random.randint(400, 1400)
        self.avg_amount = random.uniform(1500, 6000)

    # ------------------------------------------------------- scenarios
    def legit_regular(self) -> SignalBundle:
        return _base(
            "legit_regular",
            amount=round(random.uniform(80, self.avg_amount * 1.2), 0),
            beneficiary_age_days=self.known_age,
            avg_amount_30d=self.avg_amount,
            device_trusted=True,
            geo_distance_km=random.uniform(0, 15),
            voice_anomaly_score=round(random.uniform(0.02, 0.12), 3),
            urgency_keywords=[],
        )

    def legit_new_merchant(self) -> SignalBundle:
        return _base(
            "legit_new_merchant",
            amount=round(random.uniform(150, 2500), 0),
            beneficiary_age_days=random.randint(2, 20),
            avg_amount_30d=self.avg_amount,
            device_trusted=True,
            geo_distance_km=random.uniform(0, 10),
            voice_anomaly_score=round(random.uniform(0.03, 0.15), 3),
        )

    def legit_urgent_family(self) -> SignalBundle:
        return _base(
            "legit_urgent_family",
            amount=round(random.uniform(5000, 20000), 0),
            beneficiary_age_days=self.known_age,
            avg_amount_30d=self.avg_amount,
            device_trusted=True,
            geo_distance_km=random.uniform(0, 12),
            urgency_keywords=["emergency"],
            last_txn_minutes_ago=random.randint(60, 600),
        )

    def scam_otp_relay(self) -> SignalBundle:
        return _base(
            "scam_otp_relay",
            amount=round(random.uniform(8000, 150000), 0),
            beneficiary_age_days=random.randint(0, 2),
            avg_amount_30d=self.avg_amount,
            call_active=True,
            call_duration_sec=random.randint(300, 2400),
            urgency_keywords=random.sample(
                ["urgent", "share screen", "OTP", "verification", "security", "police", "suspend"],
                random.randint(3, 5),
            ),
            screen_share_active=True,
            device_trusted=random.random() < 0.5,
            geo_distance_km=random.uniform(200, 900),
            voice_anomaly_score=round(random.uniform(0.8, 0.99), 3),
            txn_frequency_anomaly=round(random.uniform(2.0, 4.0), 2),
        )

    def scam_voice_clone(self) -> SignalBundle:
        return _base(
            "scam_voice_clone",
            amount=round(random.uniform(10000, 120000), 0),
            beneficiary_age_days=random.randint(0, 1),
            avg_amount_30d=self.avg_amount,
            call_active=True,
            call_duration_sec=random.randint(120, 900),
            urgency_keywords=random.sample(
                ["urgent", "your son", "accident", "hospital", "emergency", "send now"],
                random.randint(2, 4),
            ),
            device_trusted=True,
            geo_distance_km=random.uniform(0, 20),
            voice_anomaly_score=round(random.uniform(0.75, 0.98), 3),
            txn_frequency_anomaly=round(random.uniform(1.6, 3.0), 2),
        )

    def scam_urgent_new_beneficiary(self) -> SignalBundle:
        return _base(
            "scam_urgent_new_beneficiary",
            amount=round(random.uniform(5000, 60000), 0),
            beneficiary_age_days=random.randint(0, 3),
            avg_amount_30d=self.avg_amount,
            call_active=random.random() < 0.7,
            call_duration_sec=random.randint(60, 600),
            urgency_keywords=random.sample(
                ["urgent", "refund", "KYC", "suspend", "block", "police", "verification"],
                random.randint(2, 4),
            ),
            screen_share_active=random.random() < 0.5,
            device_trusted=random.random() < 0.6,
            geo_distance_km=random.uniform(100, 800),
            voice_anomaly_score=round(random.uniform(0.1, 0.9), 3),
            txn_frequency_anomaly=round(random.uniform(1.5, 3.5), 2),
        )

    def edge_drained_account(self) -> SignalBundle:
        return _base(
            "edge_drained_account",
            amount=round(random.uniform(30000, 180000), 0),
            beneficiary_age_days=random.randint(200, 900),
            avg_amount_30d=self.avg_amount * random.uniform(3, 6),
            call_active=True,
            call_duration_sec=random.randint(180, 1200),
            urgency_keywords=["urgent", "share screen"],
            screen_share_active=True,
            device_trusted=True,
            geo_distance_km=random.uniform(0, 15),
            voice_anomaly_score=round(random.uniform(0.6, 0.97), 3),
            last_txn_minutes_ago=random.randint(1, 2),
            txn_frequency_anomaly=round(random.uniform(2.0, 4.0), 2),
        )

    def _scenario_map(self) -> dict:
        return {
            "legit_regular": self.legit_regular,
            "legit_new_merchant": self.legit_new_merchant,
            "legit_urgent_family": self.legit_urgent_family,
            "scam_otp_relay": self.scam_otp_relay,
            "scam_voice_clone": self.scam_voice_clone,
            "scam_urgent_new_beneficiary": self.scam_urgent_new_beneficiary,
            "edge_drained_account": self.edge_drained_account,
        }

    def scenario(self, name: str) -> SignalBundle:
        fn = self._scenario_map().get(name)
        if not fn:
            raise ValueError(f"Unknown scenario: {name}")
        return fn()

    def next_live(self) -> SignalBundle:
        """Weighted mix — mostly legitimate traffic with injected scams."""
        pick = random.random()
        if pick < 0.32:
            return random.choice(
                [
                    self.scam_otp_relay,
                    self.scam_voice_clone,
                    self.scam_urgent_new_beneficiary,
                    self.edge_drained_account,
                ]
            )()
        if pick < 0.45:
            return self.legit_new_merchant()
        if pick < 0.60:
            return self.legit_urgent_family()
        return self.legit_regular()