# LUXE rewarded-ads backend regression tests (auth, admin-only simulated ads, ads session, SSV, premium toggle removed, cashout insufficient path, transactions)
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
        assert u["balance"] == 0 and "tier" not in u and u["ads_today"] == 0 and u["ads_max"] == 75
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


# ---- Ads: simulated reward is admin-only (iteration 2) ----
ADMIN_EMAIL = "admin@luxe.app"
ADMIN_PASSWORD = "LuxeAdmin2026!"


@pytest.fixture(scope="module")
def admin_tok(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip("admin login failed")
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_tok(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    if r.status_code != 200:
        pytest.skip("demo login failed")
    return r.json()["token"]


class TestAds:
    def test_reward_unauth_401(self, s):
        assert s.post(f"{BASE_URL}/api/ads/reward").status_code == 401

    def test_reward_demo_403(self, s, demo_tok):
        before = s.get(f"{BASE_URL}/api/me", headers=hdr(demo_tok)).json()
        r = s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(demo_tok))
        assert r.status_code == 403
        after = s.get(f"{BASE_URL}/api/me", headers=hdr(demo_tok)).json()
        assert after["balance"] == before["balance"] and after["ads_today"] == before["ads_today"]

    def test_reward_new_user_403(self, s, new_user):
        assert s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(new_user["token"])).status_code == 403

    def test_reward_admin_200_then_429_gap(self, s, admin_tok):
        before = s.get(f"{BASE_URL}/api/me", headers=hdr(admin_tok)).json()
        if before["balance"] + 0.04 >= 4.9:
            pytest.skip("admin balance too close to $5 (PayPal LIVE safety)")
        import time
        time.sleep(6)  # respect AD_MIN_GAP from prior runs
        r = s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(admin_tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["balance"] - (before["balance"] + 0.04)) < 1e-6
        assert d["ads_max"] == 75 and "tier" not in d
        # immediate second claim -> 429 (min gap)
        r2 = s.post(f"{BASE_URL}/api/ads/reward", headers=hdr(admin_tok))
        assert r2.status_code == 429
        me = s.get(f"{BASE_URL}/api/me", headers=hdr(admin_tok)).json()
        assert abs(me["balance"] - d["balance"]) < 1e-6

    def test_ads_session(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/ads/session", headers=hdr(new_user["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["user_id"] == new_user["user"]["id"]
        assert isinstance(d["custom_data"], str) and d["custom_data"].count(".") == 2

    def test_ads_session_unauth_401(self, s):
        assert s.post(f"{BASE_URL}/api/ads/session").status_code == 401


# ---- AdMob SSV signature verification ----
class TestSSV:
    @pytest.mark.parametrize("qs", [
        "",
        "user_id=x&transaction_id=t1",
        "user_id=x&transaction_id=t1&signature=abc",
        "user_id=x&transaction_id=t1&signature=AAAA&key_id=3335741209",
        "user_id=x&transaction_id=t1&signature=!!!&key_id=999",
    ])
    def test_ssv_bad_signature_400(self, s, qs):
        r = s.get(f"{BASE_URL}/api/admob/ssv?{qs}")
        assert r.status_code == 400, f"{qs}: {r.status_code} {r.text}"


# ---- /me shape + premium toggle removed ----
class TestPremium:
    def test_me_shape(self, s, new_user):
        d = s.get(f"{BASE_URL}/api/me", headers=hdr(new_user["token"])).json()
        assert d["ads_max"] == 75 and "tier" not in d and "ads_cap" not in d
        assert d["balance"] == 0 and d["ads_today"] == 0

    def test_toggle_removed(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/premium/toggle", headers=hdr(new_user["token"]))
        assert r.status_code in (404, 405)


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
