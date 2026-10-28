// Web preview has no AdMob SDK.
export function useRewardedAd(_opts: { enabled: boolean; onEarned: () => void; onClosed: () => void }) {
  return { available: false, loaded: false, show: () => {} };
}
