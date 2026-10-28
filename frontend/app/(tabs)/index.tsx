import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRewardedAd } from "@/src/ads/useRewardedAd";
import { api, User } from "@/src/api";
import { useSubscription } from "@/src/revenuecat";
import { useApp } from "@/src/app-context";
import { AdOverlay } from "@/src/components/AdOverlay";
import { GoldButton } from "@/src/components/GoldButton";
import { Header } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { splitRevenue } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles } from "@/src/theme";

const CAP_FREE = 30;
const CAP_PREMIUM = 75;

export default function Dashboard() {
  const { user, setUser, signOut } = useApp();
  const { isSubscribed } = useSubscription();
  const [adOpen, setAdOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const userRef = useRef(user);
  userRef.current = user;

  // Reconcile with the server once SSV has had time to land (no polling loop).
  const reconcile = useCallback(
    async (expected: number, retry = true) => {
      try {
        const fresh = await api<User>("/me");
        if (fresh.ads_today < expected && retry) {
          setTimeout(() => reconcile(expected, false), 6000);
          return;
        }
        setUser(fresh);
      } catch {
        // keep optimistic value until next boot
      } finally {
        setSyncing(false);
      }
    },
    [setUser],
  );

  const realAd = useRewardedAd({
    enabled: !!user,
    onEarned: () => {
      const u = userRef.current;
      if (!u) return;
      const { userShare } = splitRevenue(u.ad_payout);
      setUser({ ...u, balance: u.balance + userShare, ads_today: u.ads_today + 1 });
      toast("success", `+$${userShare.toFixed(2)} — verifying with Google…`);
    },
    onClosed: () => {
      const u = userRef.current;
      if (!u) return;
      setSyncing(true);
      setTimeout(() => reconcile(u.ads_today), 3000);
    },
  });

  if (!user) return <View style={styles.root} />;
  const premium = isSubscribed;
  const cap = premium ? CAP_PREMIUM : CAP_FREE;
  const capped = user.ads_today >= cap;
  const isAdmin = user.role === "admin";
  const canSimulate = !realAd.available && isAdmin;
  const adReady = realAd.available ? realAd.loaded : canSimulate;

  // Simulated "Ad Watched Successfully" listener (admin test mode only)
  const onAdWatched = async () => {
    setAdOpen(false);
    const { userShare } = splitRevenue(user.ad_payout);
    const prev = user;
    // optimistic local update, then one combined DB write
    setUser({ ...user, balance: user.balance + userShare, ads_today: user.ads_today + 1 });
    setSyncing(true);
    try {
      const fresh = await api<User>("/ads/reward", { method: "POST" });
      setUser(fresh);
      toast("success", `+$${userShare.toFixed(2)} added to your balance`);
    } catch (e: any) {
      setUser(prev);
      toast("error", e?.message ?? "Could not record the reward");
    } finally {
      setSyncing(false);
    }
  };

  const watchTitle = capped
    ? "Daily Limit Reached"
    : realAd.available
      ? realAd.loaded
        ? "Watch Ad & Earn"
        : "Loading Ad…"
      : canSimulate
        ? "Watch Ad & Earn (Test)"
        : "Ads in Android App Only";

  return (
    <View style={styles.root} testID="dashboard-screen">
      <Header />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + 24 }]}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.card} testID="balance-card">
          <Text style={styles.cardLabel}>AVAILABLE BALANCE</Text>
          <Text testID="balance-amount" style={styles.balance} adjustsFontSizeToFit numberOfLines={1}>
            ${user.balance.toFixed(2)}
          </Text>
          <View style={[styles.pill, premium && styles.pillPremium]}>
            <Text testID="tier-badge" style={[styles.pillText, premium && styles.pillTextPremium]}>
              {premium ? "Premium Member" : "Free Tier"}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.action}>
          <GoldButton
            testID="watch-ad-button"
            title={watchTitle}
            onPress={() => (realAd.available ? realAd.show() : setAdOpen(true))}
            disabled={capped || !adReady}
            loading={syncing}
            large
          />
          <Text testID="ads-today-text" style={styles.micro}>
            Ads Today: {Math.min(user.ads_today, cap)} / {cap}
          </Text>
          {canSimulate ? <Text style={styles.note}>Admin test mode — simulated ad (preview only).</Text> : null}
        </Animated.View>

        {!premium ? (
          <Animated.View entering={FadeInDown.delay(240).duration(500)}>
            <GoldButton
              testID="upgrade-premium-button"
              variant="ghost"
              title="Upgrade to Premium ($5/mo)"
              onPress={() => router.push("/premium")}
            />
            <Text style={styles.note}>75 ads per day · Billed via Google Play</Text>
          </Animated.View>
        ) : (
          <Pressable testID="manage-premium-link" onPress={() => router.push("/premium")} style={styles.link}>
            <Text style={styles.linkText}>Manage Premium</Text>
          </Pressable>
        )}

        <Pressable
          testID="logout-button"
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
          style={styles.link}
        >
          <Text style={styles.mutedLink}>Sign out · {user.email}</Text>
        </Pressable>
      </ScrollView>

      <AdOverlay visible={adOpen} onRewarded={onAdWatched} onClose={() => setAdOpen(false)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 24, paddingTop: 16, gap: 32 },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 20,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  cardLabel: { color: c.muted, fontSize: 11, letterSpacing: 3, fontWeight: "600" },
  balance: { fontFamily: fonts.display, fontSize: 56, fontWeight: "700", color: c.onSurface, marginTop: 16, letterSpacing: 1 },
  pill: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.75,
    borderColor: c.border,
    backgroundColor: c.surfaceTertiary,
  },
  pillPremium: { backgroundColor: c.brandTertiary, borderColor: c.borderStrong },
  pillText: { color: c.onSurfaceTertiary, fontSize: 12, letterSpacing: 1.5, fontWeight: "600" },
  pillTextPremium: { color: c.onBrandTertiary },
  action: { gap: 12 },
  micro: { textAlign: "center", color: c.muted, fontSize: 12, letterSpacing: 1.5 },
  note: { textAlign: "center", color: c.muted, fontSize: 11, marginTop: 8 },
  link: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  linkText: { color: c.goldText, fontSize: 13 },
  mutedLink: { color: c.muted, fontSize: 12 },
}));
