# LUXE rewarded-ads backend regression tests (auth, ads reward/cap, premium toggle, cashout insufficient path, transactions)
# SAFETY: PayPal is LIVE. These tests NEVER give a user balance >= $5 and only exercise the insufficient-balance cashout path.
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
DEMO_EMAIL = "demo@luxe.app"
DEMO_PASSWORD = "LuxeDemo2026!"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def new_user(s):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123!"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["token"], "user": d["user"]}


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- Auth ----
class TestAuth:
    def test_register_returns_token_and_user(self, new_user):
        u = new_user["user"]
        assert isinstance(new_user["token"], str) and len(new_user["token"]) > 20
        assert u["email"] == new_user["email"]
        assert u["balance"] == 0 and u["tier"] == "free" and u["ads_today"] == 0 and u["ads_cap"] == 30
        assert "_id" not in u and "password_hash" not in u

    def test_register_duplicate_409(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": new_user["email"], "password": "TestPass123!"})
        assert r.status_code == 409

    def test_register_invalid_email_422(self, s):
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": "bad", "password": "TestPass123!"})
        assert r.status_code == 422

    def test_login_demo(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == DEMO_EMAIL and d["token"]
        assert d["user"]["balance"] < 5

    def test_login_wrong_password_401(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": "WrongPass!!"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Incorrect email or password"

    def test_me_without_token_401(self, s):
        assert s.get(f"{BASE_URL}/api/me").status_code == 401

    def test_me_invalid_token_401(self, s):
        assert s.get(f"{BASE_URL}/api/me", headers=hdr("garbage.token.x")).status_code == 401

    def test_me_with_token(self, s, new_user):
        r = s.get(f"{BASE_URL}/api/me", headers=hdr(new_user["token"]))
        assert r.status_code == 200 and r.json()["email"] == new_user["email"]


# ---- Ads reward + daily cap (30 * 0.04 = $1.20, safely < $5) ----
class TestAds:
    def test_reward_unauth_401(self, s):
        assert s.post(f"{BASE_URL}/api/ads/reward").status_code == 401

    def test_reward_increments_and_caps(self, s, new_user):
        tok = new_user["token"]
        r = s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(tok))
        assert r.status_code == 200
        d = r.json()
        assert d["ads_today"] == 1 and abs(d["balance"] - 0.04) < 1e-6
        for i in range(2, 31):
            r = s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(tok))
            assert r.status_code == 200, f"ad {i}: {r.text}"
        d = r.json()
        assert d["ads_today"] == 30 and abs(d["balance"] - 1.20) < 1e-6
        r = s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(tok))
        assert r.status_code == 429
        assert "Daily limit" in r.json()["detail"]
        me = s.get(f"{BASE_URL}/api/me", headers=hdr(tok)).json()
        assert me["ads_today"] == 30 and abs(me["balance"] - 1.20) < 1e-6


# ---- Premium toggle ----
class TestPremium:
    def test_toggle_roundtrip(self, s, new_user):
        tok = new_user["token"]
        r = s.post(f"{BASE_URL}/api/premium/toggle", headers=hdr(tok))
        assert r.status_code == 200 and r.json()["tier"] == "premium" and r.json()["ads_cap"] == 75
        assert s.get(f"{BASE_URL}/api/me", headers=hdr(tok)).json()["tier"] == "premium"
        # premium allows ad #31 (balance 1.24, still < 5)
        r2 = s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(tok))
        assert r2.status_code == 200 and r2.json()["ads_today"] == 31
        r = s.post(f"{BASE_URL}/api/premium/toggle", headers=hdr(tok))
        assert r.json()["tier"] == "free" and r.json()["ads_cap"] == 30


# ---- Cashout (insufficient balance only) ----
class TestCashout:
    def test_cashout_insufficient_400(self, s, new_user):
        tok = new_user["token"]
        before = s.get(f"{BASE_URL}/api/me", headers=hdr(tok)).json()["balance"]
        assert before < 5
        r = s.post(f"{BASE_URL}/api/cashout", json={"paypal_email": "test@example.com"}, headers=hdr(tok))
        assert r.status_code == 400
        assert r.json()["detail"] == "Minimum cashout is $5.00."
        after = s.get(f"{BASE_URL}/api/me", headers=hdr(tok)).json()["balance"]
        assert after == before

    def test_cashout_invalid_email_422(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/cashout", json={"paypal_email": "nope"}, headers=hdr(new_user["token"]))
        assert r.status_code == 422

    def test_cashout_unauth_401(self, s):
        assert s.post(f"{BASE_URL}/api/cashout", json={"paypal_email": "a@b.com"}).status_code == 401


# ---- Transactions ----
class TestTransactions:
    def test_transactions_page1(self, s, new_user):
        r = s.get(f"{BASE_URL}/api/transactions?page=1", headers=hdr(new_user["token"]))
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"items", "page", "has_more"}
        assert d["page"] == 1 and isinstance(d["items"], list) and len(d["items"]) <= 10
        assert d["has_more"] is False

    def test_transactions_page0_422(self, s, new_user):
        assert s.get(f"{BASE_URL}/api/transactions?page=0", headers=hdr(new_user["token"])).status_code == 422

    def test_transactions_unauth_401(self, s):
        assert s.get(f"{BASE_URL}/api/transactions?page=1").status_code == 401
