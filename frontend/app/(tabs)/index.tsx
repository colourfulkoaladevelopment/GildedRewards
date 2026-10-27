import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, User } from "@/src/api";
import { useApp } from "@/src/app-context";
import { AdOverlay } from "@/src/components/AdOverlay";
import { GoldButton } from "@/src/components/GoldButton";
import { Header } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { splitRevenue } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles } from "@/src/theme";

export default function Dashboard() {
  const { user, setUser, signOut } = useApp();
  const [adOpen, setAdOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  if (!user) return <View style={styles.root} />;
  const premium = user.tier === "premium";
  const capped = user.ads_today >= user.ads_cap;

  // "Ad Watched Successfully" listener
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

  const togglePremium = async () => {
    setUpgrading(true);
    try {
      const fresh = await api<User>("/premium/toggle", { method: "POST" });
      setUser(fresh);
      toast("success", fresh.tier === "premium" ? "Premium active — 75 ads per day unlocked" : "Switched to Free tier");
    } catch (e: any) {
      toast("error", e?.message ?? "Upgrade failed");
    } finally {
      setUpgrading(false);
    }
  };

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
            title={capped ? "Daily Limit Reached" : "Watch Ad & Earn"}
            onPress={() => setAdOpen(true)}
            disabled={capped}
            loading={syncing}
            large
          />
          <Text testID="ads-today-text" style={styles.micro}>
            Ads Today: {user.ads_today} / {user.ads_cap}
          </Text>
        </Animated.View>

        {!premium ? (
          <Animated.View entering={FadeInDown.delay(240).duration(500)}>
            <GoldButton
              testID="upgrade-premium-button"
              variant="ghost"
              title="Upgrade to Premium ($5/mo)"
              onPress={togglePremium}
              loading={upgrading}
            />
            <Text style={styles.note}>Demo mode — no charge. 75 ads per day.</Text>
          </Animated.View>
        ) : (
          <Pressable testID="downgrade-free-button" onPress={togglePremium} style={styles.link}>
            <Text style={styles.linkText}>Switch back to Free (demo)</Text>
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
