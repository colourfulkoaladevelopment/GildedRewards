import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/app-context";
import { GoldButton } from "@/src/components/GoldButton";
import { GoldRingLoader } from "@/src/components/GoldRingLoader";
import { KEYS, VPN_MESSAGE } from "@/src/constants";
import { fonts, makeStyles, setColorScheme, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { isAnonymousNetwork } from "@/src/vpn";

const MIN_SPLASH_MS = 1600;

// Boot sequence: theme + legal flag + session restore + VPN check, all masked by the gold ring.
export default function Boot() {
  const router = useRouter();
  const { restore } = useApp();
  const [blocked, setBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let alive = true;
    (async () => {
      setBlocked(false);
      const started = Date.now();
      const theme = await storage.getItem<string | null>(KEYS.theme, null);
      if (theme === "light" || theme === "dark") setColorScheme(theme);
      const vpn = await isAnonymousNetwork();
      if (vpn) {
        // Halt: no ad init, no DB sync
        if (alive) setBlocked(true);
        return;
      }
      const [legal, user] = await Promise.all([storage.getItem<boolean>(KEYS.legal, false), restore()]);
      const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started));
      setTimeout(() => {
        if (!alive) return;
        if (!legal) router.replace("/legal");
        else if (!user) router.replace("/login");
        else router.replace("/(tabs)");
      }, wait);
    })();
    return () => {
      alive = false;
    };
  }, [attempt, restore, router]);

  if (blocked) {
    return (
      <View testID="vpn-block-screen" style={[styles.block, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.blockBody}>
          <Ionicons name="shield-half-outline" size={56} color={colors.goldText} />
          <Text style={styles.blockTitle}>Access Restricted</Text>
          <Text testID="vpn-block-message" style={styles.blockText}>
            {VPN_MESSAGE}
          </Text>
        </View>
        <GoldButton testID="vpn-retry-button" title="Retry Connection" onPress={() => setAttempt((a) => a + 1)} />
      </View>
    );
  }

  return <GoldRingLoader label="SECURING CONNECTION" />;
}

const useStyles = makeStyles((c) => ({
  block: { flex: 1, backgroundColor: c.surface, paddingHorizontal: 24 },
  blockBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  blockTitle: { fontFamily: fonts.display, fontSize: 24, color: c.onSurface },
  blockText: { fontSize: 16, lineHeight: 24, color: c.onSurfaceSecondary, textAlign: "center" },
}));
