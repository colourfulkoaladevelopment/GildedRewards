// Design tokens (keys match the "color" block of /app/design_guidelines.json).
// Dark: Jet Black / Obsidian / Satin Gold. Light: Soft Ivory / Cream / Satin Gold.
// The in-app toggle uses a tiny client-side store so it works on native and web.

import { useMemo, useSyncExternalStore } from "react";
import { Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#000000",
  onSurface: "#FDFBF7",
  surfaceSecondary: "#121212",
  onSurfaceSecondary: "#FDFBF7",
  surfaceTertiary: "#1C1C1C",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFF0",
  onSurfaceInverse: "#121212",
  muted: "#8A8A8A",
  brand: "#D4AF37",
  onBrand: "#000000",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#000000",
  brandSecondary: "#C9A86A",
  onBrandSecondary: "#000000",
  brandTertiary: "#4A3E14",
  onBrandTertiary: "#FDFBF7",
  goldText: "#D4AF37",
  success: "#2E4E36",
  onSuccess: "#E6F4EA",
  warning: "#8F6B1E",
  onWarning: "#FDFBF7",
  error: "#5C1D1D",
  onError: "#FBEAEB",
  info: "#2B3A4F",
  onInfo: "#E8F0FE",
  border: "#332A0D",
  borderStrong: "#D4AF37",
  divider: "#1A1A1A",
  scrim: "#000000",
  dim: "rgba(0,0,0,0.6)",
};

export type ThemeColors = typeof dark;

const light: ThemeColors = {
  surface: "#FFFFF0",
  onSurface: "#121212",
  surfaceSecondary: "#FDFBF7",
  onSurfaceSecondary: "#1A1A1A",
  surfaceTertiary: "#F3EEDD",
  onSurfaceTertiary: "#2A2A2A",
  surfaceInverse: "#121212",
  onSurfaceInverse: "#FFFFF0",
  muted: "#6E6A5E",
  brand: "#D4AF37",
  onBrand: "#000000",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#000000",
  brandSecondary: "#C9A86A",
  onBrandSecondary: "#000000",
  brandTertiary: "#F1E5BF",
  onBrandTertiary: "#4A3E14",
  goldText: "#8F6E12",
  success: "#DDEFE1",
  onSuccess: "#1F4D2B",
  warning: "#F6E7C1",
  onWarning: "#6A4E10",
  error: "#F6DCDC",
  onError: "#6E1C1C",
  info: "#DFE8F5",
  onInfo: "#22344F",
  border: "#E6D9AE",
  borderStrong: "#D4AF37",
  divider: "#EEE8D6",
  scrim: "#000000",
  dim: "rgba(0,0,0,0.6)",
};

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" }) as string,
  text: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
};

// ---- client-side scheme override store ----
let override: ColorScheme | null = null;
const listeners = new Set<() => void>();
export function setColorScheme(scheme: ColorScheme | null) {
  override = scheme;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getOverride = () => override;

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const ov = useSyncExternalStore(subscribe, getOverride, getOverride);
  const scheme: ColorScheme = ov ?? (system === "light" || system === "dark" ? system : defaultScheme);
  return { scheme, colors: themes[scheme] };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
