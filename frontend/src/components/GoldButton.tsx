import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleProp, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { fonts, makeStyles, useTheme } from "@/src/theme";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "solid" | "ghost";
  testID: string;
  style?: StyleProp<ViewStyle>;
  large?: boolean;
};

export function GoldButton({ title, onPress, disabled, loading, variant = "solid", testID, style, large }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ghost = variant === "ghost";

  return (
    <Animated.View style={[aStyle, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || loading}
        onPressIn={() => (scale.value = withSpring(0.97))}
        onPressOut={() => (scale.value = withSpring(1))}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        style={[styles.base, large && styles.large, ghost ? styles.ghost : styles.solid, disabled && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={ghost ? colors.goldText : colors.onBrandPrimary} />
        ) : (
          <Text style={[styles.text, large && styles.textLarge, ghost ? styles.ghostText : styles.solidText]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  base: { minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  large: { minHeight: 64 },
  solid: {
    backgroundColor: c.brandPrimary,
    shadowColor: c.brand,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ghost: { borderWidth: 1, borderColor: c.borderStrong, backgroundColor: "transparent" },
  disabled: { opacity: 0.35 },
  text: { fontSize: 15, fontWeight: "700", letterSpacing: 1.2, fontFamily: fonts.text },
  textLarge: { fontSize: 17 },
  solidText: { color: c.onBrandPrimary },
  ghostText: { color: c.goldText },
}));
