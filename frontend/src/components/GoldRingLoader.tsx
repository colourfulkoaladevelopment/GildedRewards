import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { Monogram } from "@/src/components/Monogram";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 180;
const R = 84;
const C = 2 * Math.PI * R;

// Pure client-side loop: a thin gold ring traces and pulses around the monogram.
export function GoldRingLoader({ label }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const trace = useSharedValue(0);
  const spin = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    trace.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }), -1, true);
    spin.value = withRepeat(withTiming(360, { duration: 2400, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false,
    );
  }, [trace, spin, pulse]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - (0.15 + trace.value * 0.8)) }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 0.25 + (pulse.value - 1) * 8 }));

  return (
    <View style={styles.root} testID="splash-loader">
      <View style={styles.stage}>
        <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.brand} strokeWidth={0.75} fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
          <Svg width={SIZE} height={SIZE}>
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={colors.brand}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={`${C} ${C}`}
              strokeLinecap="round"
              animatedProps={ringProps}
            />
          </Svg>
        </Animated.View>
        <Monogram size={72} color={colors.brand} />
      </View>
      <Text style={styles.brand}>LUXE</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  stage: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  brand: { marginTop: 32, color: c.goldText, fontFamily: fonts.display, fontSize: 20, letterSpacing: 10 },
  label: { marginTop: 8, color: c.muted, fontSize: 12, letterSpacing: 2 },
}));
