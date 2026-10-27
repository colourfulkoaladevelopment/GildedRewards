import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/app-context";
import { GoldButton } from "@/src/components/GoldButton";
import { Monogram } from "@/src/components/Monogram";
import { KEYS, PRIVACY_POLICY, TERMS_OF_SERVICE } from "@/src/constants";
import { fonts, makeStyles, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Legal() {
  const [tab, setTab] = useState<"privacy" | "terms">("privacy");
  const [checked, setChecked] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const styles = useStyles();
  const { colors } = useTheme();

  const accept = async () => {
    await storage.setItem(KEYS.legal, true);
    router.replace(user ? "/(tabs)" : "/login");
  };

  return (
    <View testID="legal-modal" style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <View style={styles.head}>
        <Monogram size={40} color={colors.brand} />
        <Text style={styles.title}>Before you begin</Text>
        <Text style={styles.sub}>Please review and accept our policies.</Text>
      </View>

      <View style={styles.tabs}>
        {(["privacy", "terms"] as const).map((t) => (
          <Pressable
            key={t}
            testID={`legal-tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "privacy" ? "Privacy Policy" : "Terms of Service"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} testID="legal-content">
        {tab === "privacy" ? (
          <>
            <Text style={styles.sectionTitle}>PRIVACY POLICY SUMMARY</Text>
            <Text style={styles.body}>{PRIVACY_POLICY}</Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>TERMS OF SERVICE SUMMARY</Text>
            {TERMS_OF_SERVICE.map((p) => (
              <Text key={p} style={[styles.body, { marginBottom: 12 }]}>
                {p}
              </Text>
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          testID="legal-accept-checkbox"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((v) => !v)}
          style={styles.checkRow}
        >
          <View style={[styles.box, checked && styles.boxOn]}>
            {checked ? <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} /> : null}
          </View>
          <Text style={styles.checkText}>I have read and agree to the Privacy Policy and Terms of Service.</Text>
        </Pressable>
        <GoldButton testID="legal-continue-button" title="Accept & Continue" disabled={!checked} onPress={accept} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  head: { paddingHorizontal: 24, gap: 8, marginBottom: 16 },
  title: { fontFamily: fonts.display, fontSize: 28, color: c.onSurface, marginTop: 8 },
  sub: { color: c.muted, fontSize: 14 },
  tabs: { flexDirection: "row", marginHorizontal: 24, borderBottomWidth: 0.75, borderColor: c.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderColor: "transparent" },
  tabActive: { borderColor: c.brand },
  tabText: { color: c.muted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: c.goldText },
  scroll: { flex: 1 },
  scrollContent: { padding: 24 },
  sectionTitle: { color: c.goldText, fontSize: 12, letterSpacing: 2, marginBottom: 12, fontWeight: "700" },
  body: { color: c.onSurfaceSecondary, fontSize: 15, lineHeight: 24 },
  footer: { paddingHorizontal: 24, paddingTop: 16, gap: 16, borderTopWidth: 0.75, borderColor: c.border, backgroundColor: c.surfaceSecondary },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: c.brandPrimary },
  checkText: { flex: 1, color: c.onSurface, fontSize: 14, lineHeight: 20 },
}));
