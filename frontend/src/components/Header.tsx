import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KEYS } from "@/src/constants";
import { fonts, makeStyles, setColorScheme, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export function Header({ title = "LUXE" }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { scheme, colors } = useTheme();

  const toggle = () => {
    const next = scheme === "dark" ? "light" : "dark";
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setColorScheme(next);
    storage.setItem(KEYS.theme, next);
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text testID="header-logo" style={styles.logo}>
        {title}
      </Text>
      <Pressable testID="theme-toggle-button" onPress={toggle} hitSlop={8} style={styles.toggle}>
        <Ionicons name={scheme === "dark" ? "sunny-outline" : "moon-outline"} size={18} color={colors.goldText} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: c.surface,
  },
  logo: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 8, color: c.goldText },
  toggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.75,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
}));
