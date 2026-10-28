import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/src/components/GoldButton";
import { Monogram } from "@/src/components/Monogram";
import { useToast } from "@/src/components/Toast";
import { isTestStore, rcEnabled, useSubscription } from "@/src/revenuecat";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const PERKS = [
  "75 rewarded ads per day (vs 30 on Free)",
  "Reach the $5.00 cashout faster",
  "Premium Member badge",
];

export default function Premium() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const { offerings, isSubscribed, identityReady, purchaseIdentityError, isLoading, purchase, restore, isPurchasing, isRestoring } =
    useSubscription();
  const [confirm, setConfirm] = useState<PurchasesPackage | null>(null);

  const pkg = offerings?.current?.availablePackages?.[0];
  const price = pkg?.product.priceString;

  const doPurchase = async (p: PurchasesPackage) => {
    setConfirm(null);
    try {
      await purchase(p);
      toast("success", "Premium Active! Enjoy 75 high-yield ad streams today.");
      router.back();
    } catch (e: any) {
      if (e?.userCancelled) return;
      toast("error", e?.message === "identity_not_ready" ? "Account not ready for purchase yet. Try again." : e?.message ?? "Purchase failed");
    }
  };

  const doRestore = async () => {
    try {
      const info = await restore();
      const active = info?.entitlements?.active?.pro !== undefined;
      toast(active ? "success" : "info", active ? "Premium restored" : "No active subscription found");
    } catch (e: any) {
      toast("error", e?.message ?? "Restore failed");
    }
  };

  return (
    <View style={styles.root} testID="premium-screen">
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="premium-close-button" onPress={() => router.back()} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Monogram size={64} color={colors.brand} />
        <Text style={styles.title}>LUXE Premium</Text>
        {isTestStore ? (
          <Text testID="premium-simulated-label" style={styles.simLabel}>
            PREVIEW · SIMULATED TEST STORE PURCHASE
          </Text>
        ) : null}
        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p} style={styles.perk}>
              <Ionicons name="diamond-outline" size={16} color={colors.goldText} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        {isSubscribed ? (
          <View style={styles.activeBox} testID="premium-active">
            <Text style={styles.activeText}>Your Premium membership is active.</Text>
            {Platform.OS === "android" ? (
              <GoldButton
                testID="manage-subscription-button"
                variant="ghost"
                title="Manage in Google Play"
                onPress={() => Linking.openURL("https://play.google.com/store/account/subscriptions")}
              />
            ) : null}
          </View>
        ) : !rcEnabled ? (
          <Text style={styles.unavailable}>Subscriptions are available in the mobile app.</Text>
        ) : isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
        ) : !pkg ? (
          <Text testID="premium-unavailable" style={styles.unavailable}>
            Subscription options are unavailable right now. Please try again later.
          </Text>
        ) : (
          <View style={{ gap: 12, alignSelf: "stretch" }}>
            <Text testID="premium-price" style={styles.price}>
              {price} / month
            </Text>
            {purchaseIdentityError || !identityReady ? (
              <Text testID="premium-identity-error" style={styles.unavailable}>
                {purchaseIdentityError ? `Account link failed: ${purchaseIdentityError}` : "Linking your account…"}
              </Text>
            ) : null}
            <GoldButton
              testID="premium-subscribe-button"
              title={`Subscribe · ${price}/mo`}
              large
              loading={isPurchasing}
              disabled={!identityReady}
              onPress={() => (isTestStore ? setConfirm(pkg) : doPurchase(pkg))}
            />
            <Text style={styles.fine}>Auto-renews monthly via Google Play. Cancel anytime in Play Subscriptions.</Text>
          </View>
        )}

        <Pressable testID="premium-restore-button" onPress={doRestore} disabled={isRestoring || !rcEnabled} style={styles.restore}>
          <Text style={styles.restoreText}>{isRestoring ? "Restoring…" : "Restore Purchases"}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={styles.scrim}>
          <View style={styles.sheet} testID="premium-confirm-modal">
            <Text style={styles.sheetTitle}>Confirm test purchase</Text>
            <Text style={styles.sheetBody}>This is a simulated Test Store purchase. No real money will be charged.</Text>
            <GoldButton testID="premium-confirm-button" title="Confirm" onPress={() => confirm && doPurchase(confirm)} />
            <GoldButton testID="premium-cancel-button" variant="ghost" title="Cancel" onPress={() => setConfirm(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  top: { paddingHorizontal: 16, alignItems: "flex-end" },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, alignItems: "center", gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, color: c.onSurface, marginTop: 8 },
  simLabel: { color: c.goldText, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  perks: { alignSelf: "stretch", gap: 12, marginVertical: 16, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceSecondary },
  perk: { flexDirection: "row", gap: 12, alignItems: "center" },
  perkText: { color: c.onSurfaceSecondary, fontSize: 15, flex: 1 },
  price: { fontFamily: fonts.display, fontSize: 28, color: c.onSurface, textAlign: "center" },
  fine: { color: c.muted, fontSize: 11, textAlign: "center" },
  unavailable: { color: c.muted, fontSize: 14, textAlign: "center" },
  activeBox: { alignSelf: "stretch", gap: 12 },
  activeText: { color: c.goldText, fontSize: 16, textAlign: "center" },
  restore: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  restoreText: { color: c.goldText, fontSize: 14 },
  scrim: { flex: 1, backgroundColor: c.dim, justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surfaceSecondary, padding: 24, paddingBottom: 40, gap: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, color: c.onSurface },
  sheetBody: { color: c.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
}));
