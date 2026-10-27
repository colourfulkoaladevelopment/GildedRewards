export const MIN_CASHOUT = 5.0;
export const AD_PAYOUT = 0.05; // simulated revenue per rewarded ad (USD)
export const USER_SHARE_RATE = 0.8;
export const COMPANY_SHARE_RATE = 0.2;
export const AD_DURATION_SECONDS = 5;

export const KEYS = {
  token: "auth_token",
  legal: "LegalAccepted",
  theme: "theme_pref",
  user: "cached_user",
};

export const PRIVACY_POLICY =
  "This Application collects minimal user identifiers (User ID, PayPal Email Address) solely to calculate ad consumption metrics and distribute financial compensation. We do not sell, trade, or distribute your personal data to external third parties. Ad networks (Google AdMob and Meta Audience Network) may process anonymous device telemetry to serve relevant ad inventory. By using this service, you consent to secure data logging required for automated PayPal verification.";

export const TERMS_OF_SERVICE = [
  "1. Eligibility: Users must maintain a valid personal PayPal account capable of receiving global payouts to collect balances.",
  "2. Earning Caps: Free accounts are structurally limited to 30 incentivized ad views per 24-hour cycle. Subscription accounts are limited to 75 ad views.",
  "3. Fraud & Manipulation: The use of Virtual Private Networks (VPNs), automated ad-clicking scripts, device emulators, or multi-account farming setups is strictly prohibited. Detection of any manipulation vectors will result in immediate permanent account termination and total forfeiture of all accumulated, unpaid balances.",
  "4. Subscription Models: Premium tiers process an automated $5.00 monthly charge via the Google Play Billing ecosystem. Subscriptions can be managed or revoked at any point directly via Google Play Subscriptions settings.",
];

export const VPN_MESSAGE =
  "Network error: VPN or Proxy detected. Please disable anonymous routing tools to use this application.";

// Client-side revenue split, run when an ad is watched successfully.
export function splitRevenue(adPayout: number = AD_PAYOUT) {
  const appRevenue = adPayout;
  return {
    appRevenue,
    userShare: appRevenue * USER_SHARE_RATE,
    companyShare: appRevenue * COMPANY_SHARE_RATE,
  };
}
