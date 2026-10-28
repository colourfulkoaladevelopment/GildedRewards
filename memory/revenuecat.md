# RevenueCat — integrated (2026-06)
This file is supposed to serve as a memory to you if you have to interact with user's RevenueCat account via integration proxy at any later point in time.

## Identifiers (from /setup response)
- rc_project_id: proj48ee43d7
- apple_app_id: app6611066bc3
- play_app_id: appdae1237284
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages:
  - $rc_monthly -> prod4ef9ffe4d5   ($5.00 / P1M, trial: none)
  - $rc_annual removed (DELETE)
- Dashboard: https://app.revenuecat.com/projects/proj48ee43d7
- Bundle/package: com.emergent.luxeadrewards.ofm1ap

## Status check
curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/<job_id>/status"
If project_state is less than project_created, re-fetch RevenueCat playbook via the integration expert tool.

## Later updates (integration proxy only — NEVER RevenueCat REST API)
- Upsert price: POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/<job_id>/products
  body: {"products":[{"package":"$rc_monthly","price":5.00,"currency":"USD","period":"P1M","prices":[{"amount_micros":5000000,"currency":"USD"}]}]}
- Remove package: DELETE .../products/%24rc_monthly
- Recover identifiers / repopulate .env: re-run idempotent /setup.

## Going live (user steps)
1. Upload Google Play service-account JSON in RevenueCat dashboard (https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)
2. Set up Play Console payments profile
3. Create matching subscription in Play Console with the SAME product ID as RevenueCat dashboard
4. Release build → Play internal testing → submit
All steps are in the FAQ section of the payments panel.

## App code
- src/revenuecat.tsx (init + SubscriptionProvider + identity logIn), init at module scope in app/_layout.tsx
- app/premium.tsx paywall (coded), dashboard gates 30/75 cap on isSubscribed (client-side only per playbook)
