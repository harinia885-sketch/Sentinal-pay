import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class Store:
    def __init__(self) -> None:
        DATA_DIR.mkdir(exist_ok=True)
        self._txn_path = DATA_DIR / "transactions.json"
        self._inc_path = DATA_DIR / "incidents.json"
        self._fb_path = DATA_DIR / "feedback.json"
        self.transactions = self._load(self._txn_path, [])
        self.incidents = self._load(self._inc_path, [])
        self.feedback = self._load(self._fb_path, [])

    @staticmethod
    def _load(path: Path, default):
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                return default
        return default

    @staticmethod
    def _save(items, path: Path) -> None:
        path.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")

    def add_transaction(self, decision: dict) -> None:
        self.transactions.append(decision)
        if len(self.transactions) > 300:
            self.transactions = self.transactions[-300:]
        self._save(self.transactions, self._txn_path)

    def add_incident(self, incident: dict) -> None:
        self.incidents.append(incident)
        if len(self.incidents) > 150:
            self.incidents = self.incidents[-150:]
        self._save(self.incidents, self._inc_path)

    def add_feedback(self, feedback: dict) -> None:
        self.feedback.append(feedback)
        self._save(self.feedback, self._fb_path)

    def stats(self) -> dict:
        totals = {}
        for t in self.transactions:
            totals[t["tier"]] = totals.get(t["tier"], 0) + 1
        scores = [t["score"] for t in self.transactions] or [0]
        return {
            "total": len(self.transactions),
            "by_tier": totals,
            "allow": totals.get("allow", 0),
            "warn": totals.get("warn", 0),
            "verify": totals.get("verify", 0),
            "hold": totals.get("hold", 0),
            "incidents": len(self.incidents),
            "feedback": len(self.feedback),
            "avg_score": round(sum(scores) / len(scores), 1),
        }