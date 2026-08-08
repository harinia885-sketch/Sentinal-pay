import uuid
from datetime import datetime, timezone

from .store import Store


class BankAlertAPI:
    """Simulated secure bank-alert API (mutual-TLS channel in production)."""

    def __init__(self, store: Store) -> None:
        self.store = store

    def alert(self, decision: dict) -> dict:
        incident = {
            "id": f"ALR-{uuid.uuid4().hex[:10].upper()}",
            "txn_id": decision["txn_id"],
            "score": decision["score"],
            "tier": decision["tier"],
            "payer": decision["signals"].get("payer", "unknown"),
            "beneficiary": decision["signals"].get("beneficiary", "unknown"),
            "amount": decision["signals"].get("amount", 0),
            "channel": "bank_secure_api",
            "delivery": "DELIVERED",
            "hold_applied": True,
            "evidence": decision.get("evidence", {}),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.store.add_incident(incident)
        return incident