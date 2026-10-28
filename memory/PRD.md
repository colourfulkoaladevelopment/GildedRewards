# LUXE — Rewarded Ads Earn & Cashout (PRD)

## Original problem statement
Google Play app with Main Dashboard + Cashout screen. Rewarded video ads → client-side split (User 80% / Company 20%), sync balance to minimal DB (UserID, Balance, PayPalEmail). MIN_CASHOUT = 5.00; Cashout button disabled below threshold; backend calls PayPal Payouts API (sender_batch_header, recipient email, amount, currency); 201 → deduct $5 + log + success; else keep balance + error. Luxury gold/black/ivory theme with light/dark toggle, gold-ring splash animation, VPN/Proxy/Tor block screen, first-launch legal modal (Privacy/Terms tabs + checkbox, LegalAccepted flag), daily caps 30 free / 75 premium, Premium upsell ($5/mo), paginated history (10/page, fetched only when tab selected), push notifications (FCM) on payout/renewal. Credit-optimized: client-side state, no polling.

## User choices
Simulated ads (AdMob later) · PayPal LIVE keys (user confirmed real money) · Demo premium toggle · Email/password login · Push notifications skipped.

## Architecture
- Backend FastAPI + Mongo: users (email, password_hash, balance, paypal_email, tier, ads_today, ads_date, last_ad_at), transactions, company_ledger. JWT (30d) bcrypt auth.
- Endpoints: /api/auth/register, /api/auth/login, /api/me, /api/ads/reward (atomic cap + 5s anti-bot gap), /api/premium/toggle, /api/cashout (atomic reserve → PayPal → refund on failure), /api/transactions?page=
- Frontend Expo Router: index (boot splash + VPN check via api.ipapi.is), legal, login, (tabs)/index (Earn), (tabs)/cashout. Theme override store in src/theme.ts, local storage for token/legal/theme/user cache.

## Implemented (2026-06)
- Iteration 2: Real AdMob rewarded ads (react-native-google-mobile-ads, app ID ca-app-pub-5648720019902247~9249327645, unit /8975537467) with Google SSV callback GET /api/admob/ssv (ECDSA verify, signed custom_data session, idempotent transaction_id). Simulated ads now admin-only (preview testing). RevenueCat $5/mo Premium (entitlement `pro`, paywall /premium, restore, Test Store in preview); demo toggle removed; 30/75 cap client-side from entitlement.
- All screens + flows above; tested by testing agent (17/17 backend, all frontend flows pass).
- Fixes after test: toast no longer blocks header, 5s gap between rewards, ads counter clamped, malformed token → 401.

## Backlog
- P0: Real AdMob rewarded ads with server-side verification (SSV) — current simulated rewards can be claimed by any logged-in user and PayPal is LIVE.
- P0: PayPal payout final-status check (webhook PAYOUTS-ITEM.* → refund on denied/returned).
- P1: Google Play Billing subscription (RevenueCat) + renewal webhook.
- P1: FCM push (payout dispatched, premium renewed) — needs google-services.json + build.
- P2: Login rate limiting, admin dashboard for company ledger.
