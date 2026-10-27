import Ionicons from "@react-native-vector-icons/ionicons";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "@/src/theme";

type Kind = "success" | "error" | "info";
type ToastState = { id: number; kind: Kind; message: string } | null;
const ToastCtx = createContext<(kind: Kind, message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback((kind: Kind, message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), kind, message });
    timer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  const bg = toast?.kind === "success" ? colors.success : toast?.kind === "error" ? colors.error : colors.surfaceInverse;
  const fg = toast?.kind === "success" ? colors.onSuccess : toast?.kind === "error" ? colors.onError : colors.onSurfaceInverse;

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp}
          exiting={FadeOutUp}
          style={[styles.wrap, { top: insets.top + 64, pointerEvents: "none" }]}
        >
          <View testID={`toast-${toast.kind}`} style={[styles.toast, { backgroundColor: bg }]}>
            <Ionicons
              name={toast.kind === "success" ? "checkmark-circle" : toast.kind === "error" ? "alert-circle" : "information-circle"}
              size={20}
              color={fg}
            />
            <Text testID="toast-message" style={[styles.text, { color: fg }]}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 1000 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
}));
