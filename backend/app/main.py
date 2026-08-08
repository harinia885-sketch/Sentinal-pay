import asyncio
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .bank_api import BankAlertAPI
from .models import FeedbackRequest, ScenarioSpec
from .risk_engine import RiskEngine, build_engine
from .scenario_engine import ScenarioEngine
from .store import Store

SCENARIO_NAMES = [
    "legit_regular",
    "legit_new_merchant",
    "legit_urgent_family",
    "scam_otp_relay",
    "scam_voice_clone",
    "scam_urgent_new_beneficiary",
    "edge_drained_account",
]


class LiveStream:
    """Broadcasts scored transactions to every connected dashboard."""

    def __init__(self, engine: RiskEngine, scenarios: ScenarioEngine, bank: BankAlertAPI) -> None:
        self.engine = engine
        self.scenarios = scenarios
        self.bank = bank
        self.clients: set = set()
        self.running = False
        self.cadence = 1.4
        self.task: Optional[asyncio.Task] = None

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)
        await ws.send_json(
            {"type": "status", "data": {
                "running": self.running, "cadence": self.cadence,
                "scenarios": SCENARIO_NAMES,
                "stats": self.engine.store.stats(),
                "model_version": self.engine.model.version,
            }}
        )

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, payload: dict) -> None:
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self.task = asyncio.get_event_loop().create_task(self._run())

    def pause(self) -> None:
        self.running = False

    async def _run(self) -> None:
        while self.running:
            try:
                bundle = self.scenarios.next_live()
                decision = self.engine.score(bundle)
                await self.broadcast({"type": "transaction", "data": decision})
                if decision["tier"] == "hold":
                    incident = self.bank.alert(decision)
                    await self.broadcast({"type": "incident", "data": incident})
                await self.broadcast({"type": "stats", "data": self.engine.store.stats()})
            except Exception as exc:  # keep stream alive
                print("stream error:", exc)
            await asyncio.sleep(self.cadence)

    async def run_scenario(self, name: str) -> dict:
        bundle = self.scenarios.scenario(name)
        decision = self.engine.score(bundle)
        await self.broadcast({"type": "transaction", "data": decision})
        if decision["tier"] == "hold":
            incident = self.bank.alert(decision)
            await self.broadcast({"type": "incident", "data": incident})
        await self.broadcast({"type": "stats", "data": self.engine.store.stats()})
        return decision


store = Store()
engine = build_engine(store)
scenarios = ScenarioEngine()
bank = BankAlertAPI(store)
stream = LiveStream(engine, scenarios, bank)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    stream.pause()


app = FastAPI(title="SentinelPay", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "model_version": engine.model.version,
        "transactions": len(store.transactions),
        "incidents": len(store.incidents),
        "scenarios": SCENARIO_NAMES,
    }


@app.get("/api/stats")
async def stats():
    return store.stats()


@app.get("/api/transactions")
async def transactions(limit: int = 50):
    return store.transactions[-limit:][::-1]


@app.get("/api/transactions/{txn_id}")
async def transaction(txn_id: str):
    return next((t for t in store.transactions if t["txn_id"] == txn_id), None)


@app.get("/api/incidents")
async def incidents(limit: int = 50):
    return store.incidents[-limit:][::-1]


@app.post("/api/transactions/{txn_id}/feedback")
async def feedback(txn_id: str, body: FeedbackRequest):
    rec = engine.record_feedback(txn_id, body.was_fraudulent, body.notes)
    return rec


@app.post("/api/model/retrain")
async def retrain():
    return engine.retrain()


@app.post("/api/simulate")
async def simulate(body: ScenarioSpec):
    decision = await stream.run_scenario(body.scenario)
    return decision


@app.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    await stream.connect(ws)
    try:
        while True:
            msg = await ws.receive_json()
            action = msg.get("action")
            if action == "start":
                stream.start()
                await stream.broadcast({"type": "status", "data": {"running": True, "cadence": stream.cadence}})
            elif action == "pause":
                stream.pause()
                await stream.broadcast({"type": "status", "data": {"running": False}})
            elif action == "set_cadence":
                stream.cadence = max(0.2, float(msg.get("value", 1.4)))
                await stream.broadcast({"type": "status", "data": {"running": stream.running, "cadence": stream.cadence}})
            elif action == "run_scenario":
                await stream.run_scenario(msg.get("scenario", "scam_otp_relay"))
            elif action == "feedback":
                rec = engine.record_feedback(
                    msg.get("txn_id", ""),
                    bool(msg.get("was_fraudulent")),
                    msg.get("notes", ""),
                )
                await ws.send_json({"type": "feedback", "data": rec})
            elif action == "retrain":
                result = engine.retrain()
                await ws.send_json({"type": "retrain", "data": result})
    except WebSocketDisconnect:
        stream.disconnect(ws)
    except Exception:
        stream.disconnect(ws)