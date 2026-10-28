import Constants, { ExecutionEnvironment } from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/src/api";

// Expo Go has no AdMob native module, so never require it there.
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const AD_UNIT = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID;

let sdk: any = null;
let initPromise: Promise<unknown> | null = null;
function getSdk() {
  if (inExpoGo) return null;
  if (!sdk) {
    try {
      sdk = require("react-native-google-mobile-ads");
    } catch {
      sdk = null;
    }
  }
  return sdk;
}

type Opts = { enabled: boolean; onEarned: () => void; onClosed: () => void };

// Real AdMob rewarded video. Money is credited ONLY by Google's server-side
// verification callback (/api/admob/ssv); EARNED_REWARD here is UX only.
export function useRewardedAd({ enabled, onEarned, onClosed }: Opts) {
  const m = getSdk();
  const available = !!m && !!AD_UNIT;
  const [loaded, setLoaded] = useState(false);
  const adRef = useRef<any>(null);
  const unsubs = useRef<(() => void)[]>([]);
  const cbs = useRef({ onEarned, onClosed });
  cbs.current = { onEarned, onClosed };

  const cleanup = () => {
    unsubs.current.forEach((u) => u());
    unsubs.current = [];
  };

  const prepare = useCallback(async () => {
    if (!m || !AD_UNIT) return;
    cleanup();
    setLoaded(false);
    try {
      if (!initPromise) initPromise = m.default().initialize();
      await initPromise;
      // fresh signed session per ad so the SSV callback can be tied to this user
      const s = await api<{ user_id: string; custom_data: string }>("/ads/session", { method: "POST" });
      const unitId = __DEV__ ? m.TestIds.REWARDED : AD_UNIT;
      const ad = m.RewardedAd.createForAdRequest(unitId, {
        serverSideVerificationOptions: { userId: s.user_id, customData: s.custom_data },
      });
      adRef.current = ad;
      unsubs.current.push(
        ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => setLoaded(true)),
        ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => cbs.current.onEarned()),
        ad.addAdEventListener(m.AdEventType.CLOSED, () => {
          cbs.current.onClosed();
          prepare();
        }),
        ad.addAdEventListener(m.AdEventType.ERROR, () => {
          setLoaded(false);
          setTimeout(prepare, 30000);
        }),
      );
      ad.load();
    } catch {
      setLoaded(false);
    }
  }, [m]);

  useEffect(() => {
    if (!enabled || !available) return;
    prepare();
    return cleanup;
  }, [enabled, available, prepare]);

  const show = useCallback(() => {
    if (adRef.current && loaded) {
      setLoaded(false);
      adRef.current.show().catch(() => prepare());
    }
  }, [loaded, prepare]);

  return { available, loaded, show };
}
