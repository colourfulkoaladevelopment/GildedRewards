from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict
from typing import Annotated, Optional, List
from datetime import datetime, timezone, timedelta
from pathlib import Path
from bson import ObjectId
import os
import uuid
import logging
import bcrypt
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_DAYS = 30

# Business constants
MIN_CASHOUT = 5.00
AD_PAYOUT = 0.05          # simulated revenue per rewarded ad (USD)
USER_SHARE = 0.80
COMPANY_SHARE = 0.20
CAP_FREE = 30
CAP_PREMIUM = 75
CURRENCY = "USD"
AD_MIN_GAP = 5  # seconds between rewards (anti-bot)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls(**doc) if doc else None

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True, exclude_none=True)
        d.pop("_id", None)
        return d


class User(BaseDocument):
    email: str
    password_hash: str
    role: str = "user"
    balance: float = 0.0
    paypal_email: Optional[str] = None
    tier: str = "free"
    ads_today: int = 0
    ads_date: str = ""
    last_ad_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Transaction(BaseDocument):
    user_id: str
    type: str  # payout
    amount: float
    currency: str = CURRENCY
    paypal_email: str
    status: str  # success | failed
    batch_id: Optional[str] = None
    payout_batch_id: Optional[str] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AuthIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class CashoutIn(BaseModel):
    paypal_email: EmailStr


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def cap_for(tier: str) -> int:
    return CAP_PREMIUM if tier == "premium" else CAP_FREE


def public_user(u: User) -> dict:
    ads_today = min(u.ads_today if u.ads_date == today() else 0, cap_for(u.tier))
    return {
        "id": u.id, "email": u.email, "role": u.role,
        "balance": round(u.balance, 4), "paypal_email": u.paypal_email,
        "tier": u.tier, "ads_today": ads_today, "ads_cap": cap_for(u.tier),
        "min_cashout": MIN_CASHOUT, "ad_payout": AD_PAYOUT,
    }


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except ValueError:
        return False


def make_token(uid: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": uid, "iat": now, "exp": now + timedelta(days=JWT_DAYS)}, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> User:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload["sub"]
    except (jwt.InvalidTokenError, KeyError):
        raise HTTPException(401, "Invalid or expired session")
    if not ObjectId.is_valid(uid):
        raise HTTPException(401, "Invalid or expired session")
    doc = await db.users.find_one({"_id": ObjectId(uid)})
    if not doc:
        raise HTTPException(401, "User not found")
    return User.from_mongo(doc)


# ---------------- Auth ----------------
@api_router.post("/auth/register")
async def register(body: AuthIn):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")
    user = User(email=email, password_hash=hash_pw(body.password))
    res = await db.users.insert_one(user.to_mongo())
    user.id = str(res.inserted_id)
    return {"token": make_token(user.id), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: AuthIn):
    email = body.email.strip().lower()
    doc = await db.users.find_one({"email": email})
    if not doc or not verify_pw(body.password, doc["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    user = User.from_mongo(doc)
    return {"token": make_token(user.id), "user": public_user(user)}


@api_router.get("/me")
async def me(user: User = Depends(current_user)):
    return public_user(user)


# ---------------- Ads ----------------
@api_router.post("/ads/reward")
async def ad_reward(user: User = Depends(current_user)):
    """Single atomic update: resets daily counter if new day, enforces cap, credits 80% share."""
    d = today()
    user_share = round(AD_PAYOUT * USER_SHARE, 4)
    cap = cap_for(user.tier)
    oid = ObjectId(user.id)
    now = datetime.now(timezone.utc)
    gap_ok = {"$or": [{"last_ad_at": None}, {"last_ad_at": {"$lt": (now - timedelta(seconds=AD_MIN_GAP)).isoformat()}}]}
    stamp = now.isoformat()
    # New day: reset counter and credit in one op
    doc = await db.users.find_one_and_update(
        {"_id": oid, "ads_date": {"$ne": d}, **gap_ok},
        {"$set": {"ads_date": d, "ads_today": 1, "last_ad_at": stamp}, "$inc": {"balance": user_share}},
        return_document=True,
    )
    if not doc:
        doc = await db.users.find_one_and_update(
            {"_id": oid, "ads_date": d, "ads_today": {"$lt": cap}, **gap_ok},
            {"$inc": {"ads_today": 1, "balance": user_share}, "$set": {"last_ad_at": stamp}},
            return_document=True,
        )
    if not doc and user.last_ad_at and user.last_ad_at >= (now - timedelta(seconds=AD_MIN_GAP)).isoformat():
        raise HTTPException(429, "Please watch the full ad before claiming another reward.")
    if not doc:
        raise HTTPException(429, f"Daily limit reached ({cap} ads). Come back tomorrow.")
    await db.company_ledger.update_one(
        {"date": d}, {"$inc": {"revenue": AD_PAYOUT, "company_share": round(AD_PAYOUT * COMPANY_SHARE, 4), "ads": 1}},
        upsert=True,
    )
    return public_user(User.from_mongo(doc))


# ---------------- Premium (demo) ----------------
@api_router.post("/premium/toggle")
async def premium_toggle(user: User = Depends(current_user)):
    new_tier = "free" if user.tier == "premium" else "premium"
    doc = await db.users.find_one_and_update({"_id": ObjectId(user.id)}, {"$set": {"tier": new_tier}}, return_document=True)
    return public_user(User.from_mongo(doc))


# ---------------- PayPal Payouts ----------------
def paypal_base() -> str:
    return "https://api-m.paypal.com" if os.environ.get("PAYPAL_MODE") == "live" else "https://api-m.sandbox.paypal.com"


async def paypal_payout(email: str, amount: float, batch_id: str) -> tuple[int, dict]:
    cid, secret = os.environ.get("PAYPAL_CLIENT_ID"), os.environ.get("PAYPAL_SECRET")
    if not cid or not secret:
        return 503, {"message": "Payouts are not configured yet."}
    async with httpx.AsyncClient(timeout=20) as hc:
        tok = await hc.post(f"{paypal_base()}/v1/oauth2/token", auth=(cid, secret),
                            data={"grant_type": "client_credentials"})
        if tok.status_code != 200:
            return tok.status_code, {"message": "PayPal authentication failed."}
        payload = {
            "sender_batch_header": {
                "sender_batch_id": batch_id,
                "email_subject": "You have a payout!",
                "email_message": "Your rewards cashout has been sent.",
            },
            "items": [{
                "recipient_type": "EMAIL",
                "amount": {"value": f"{amount:.2f}", "currency": CURRENCY},
                "receiver": email,
                "note": "Rewards cashout",
                "sender_item_id": batch_id,
            }],
        }
        r = await hc.post(f"{paypal_base()}/v1/payments/payouts", json=payload,
                          headers={"Authorization": f"Bearer {tok.json()['access_token']}"})
        try:
            body = r.json()
        except ValueError:
            body = {}
        return r.status_code, body


@api_router.post("/cashout")
async def cashout(body: CashoutIn, user: User = Depends(current_user)):
    email = body.paypal_email.strip().lower()
    oid = ObjectId(user.id)
    # Atomic reserve: deduct only if balance >= MIN_CASHOUT (prevents double-spend)
    reserved = await db.users.find_one_and_update(
        {"_id": oid, "balance": {"$gte": MIN_CASHOUT}},
        {"$inc": {"balance": -MIN_CASHOUT}, "$set": {"paypal_email": email}},
        return_document=True,
    )
    if not reserved:
        raise HTTPException(400, f"Minimum cashout is ${MIN_CASHOUT:.2f}.")
    batch_id = f"CO_{uuid.uuid4().hex[:20]}"
    try:
        status, resp = await paypal_payout(email, MIN_CASHOUT, batch_id)
    except httpx.HTTPError as e:
        logger.error("PayPal error: %s", e)
        status, resp = 502, {"message": "Could not reach PayPal."}

    if status == 201:
        tx = Transaction(user_id=user.id, type="payout", amount=MIN_CASHOUT, paypal_email=email, status="success",
                         batch_id=batch_id, payout_batch_id=resp.get("batch_header", {}).get("payout_batch_id"))
        await db.transactions.insert_one(tx.to_mongo())
        return {"success": True, "message": "Funds dispatched! Your cashout has been sent to your PayPal account.",
                "user": public_user(User.from_mongo(reserved))}

    # Failure: refund the reservation (balance retained) and log it
    refunded = await db.users.find_one_and_update({"_id": oid}, {"$inc": {"balance": MIN_CASHOUT}}, return_document=True)
    msg = resp.get("message") or resp.get("name") or "Payout failed."
    tx = Transaction(user_id=user.id, type="payout", amount=MIN_CASHOUT, paypal_email=email, status="failed",
                     batch_id=batch_id, error=str(msg)[:200])
    await db.transactions.insert_one(tx.to_mongo())
    logger.warning("Payout failed %s: %s", status, resp)
    return {"success": False, "message": f"Payout failed: {msg} Your balance was kept.",
            "user": public_user(User.from_mongo(refunded))}


@api_router.get("/transactions")
async def transactions(page: int = Query(1, ge=1), user: User = Depends(current_user)):
    cur = db.transactions.find({"user_id": user.id}).sort("created_at", -1).skip((page - 1) * 10).limit(11)
    docs = await cur.to_list(11)
    items: List[dict] = []
    for d in docs[:10]:
        t = Transaction.from_mongo(d)
        items.append(t.model_dump(exclude={"user_id"}))
    return {"items": items, "page": page, "has_more": len(docs) > 10}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    # Idempotent seeding of admin + demo user
    seeds = [
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "admin", 0.0),
        (os.environ["DEMO_EMAIL"], os.environ["DEMO_PASSWORD"], "user", 0.0),
    ]
    for email, pw, role, bal in seeds:
        email = email.lower()
        existing = await db.users.find_one({"email": email})
        if not existing:
            u = User(email=email, password_hash=hash_pw(pw), role=role, balance=bal)
            await db.users.insert_one(u.to_mongo())
        elif not verify_pw(pw, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_pw(pw)}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
