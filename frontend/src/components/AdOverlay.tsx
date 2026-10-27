import Ionicons from "@react-native-vector-icons/ionicons";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GoldButton } from "@/src/components/GoldButton";
import { Monogram } from "@/src/components/Monogram";
import { AD_DURATION_SECONDS } from "@/src/constants";
import { fonts, makeStyles, useTheme } from "@/src/theme";

// Simulated rewarded video. Swap for AdMob's RewardedAd in a native build:
// its EARNED_REWARD event should call the same `onRewarded` handler.
export function AdOverlay({ visible, onRewarded, onClose }: { visible: boolean; onRewarded: () => void; onClose: () => void }) {
  const [left, setLeft] = useState(AD_DURATION_SECONDS);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  useEffect(() => {
    if (!visible) return;
    setLeft(AD_DURATION_SECONDS);
    const id = setInterval(() => setLeft((s) => (s <= 1 ? (clearInterval(id), 0) : s - 1)), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const done = left === 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => {}}>
      <View testID="ad-overlay" style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.top}>
          <Text style={styles.sponsored}>SPONSORED · SIMULATED AD</Text>
          {!done ? null : (
            <Pressable testID="ad-close-button" onPress={onClose} hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.onSurface} />
            </Pressable>
          )}
        </View>
        <View style={styles.center}>
          <Monogram size={96} color={colors.brand} />
          <Text testID="ad-countdown" style={styles.count}>
            {done ? "✓" : left}
          </Text>
          <Text style={styles.caption}>{done ? "Reward unlocked" : "Reward in progress…"}</Text>
        </View>
        <GoldButton
          testID="ad-claim-reward-button"
          title={done ? "Claim Reward" : `Please wait ${left}s`}
          disabled={!done}
          onPress={onRewarded}
          large
          style={{ marginHorizontal: 24 }}
        />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.scrim },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, minHeight: 44 },
  sponsored: { color: "#8A8A8A", fontSize: 11, letterSpacing: 2 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  count: { color: c.brand, fontFamily: fonts.display, fontSize: 72, fontWeight: "700" },
  caption: { color: "#CFCFCF", fontSize: 14, letterSpacing: 1 },
}));
