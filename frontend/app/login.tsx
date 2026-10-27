import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/src/app-context";
import { GoldButton } from "@/src/components/GoldButton";
import { Monogram } from "@/src/components/Monogram";
import { fonts, makeStyles, useTheme } from "@/src/theme";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focus, setFocus] = useState<"email" | "password" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const submit = async () => {
    setError("");
    if (!email.trim() || password.length < 6) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signIn(mode, email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
      >
        <Monogram size={56} color={colors.brand} />
        <Text style={styles.title}>{mode === "login" ? "Welcome back" : "Create account"}</Text>
        <Text style={styles.sub}>Watch. Earn. Cash out — elegantly.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            onFocus={() => setFocus("email")}
            onBlur={() => setFocus(null)}
            style={[styles.input, focus === "email" && styles.inputFocus]}
            returnKeyType="next"
          />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            onFocus={() => setFocus("password")}
            onBlur={() => setFocus(null)}
            style={[styles.input, focus === "password" && styles.inputFocus]}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? (
            <Text testID="login-error-text" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <GoldButton
            testID="login-submit-button"
            title={mode === "login" ? "Sign In" : "Create Account"}
            onPress={submit}
            loading={loading}
            style={{ marginTop: 24 }}
          />
          <Pressable
            testID="login-mode-toggle"
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={styles.switch}
          >
            <Text style={styles.switchText}>
              {mode === "login" ? "New here? Create an account" : "Already a member? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  title: { fontFamily: fonts.display, fontSize: 32, color: c.onSurface, marginTop: 24 },
  sub: { color: c.muted, fontSize: 14, marginTop: 8 },
  form: { marginTop: 48 },
  label: { color: c.goldText, fontSize: 11, letterSpacing: 2, marginTop: 16, fontWeight: "700" },
  input: { height: 48, borderBottomWidth: 1, borderColor: c.border, color: c.onSurface, fontSize: 16 },
  inputFocus: { borderColor: c.brand },
  error: { color: c.onError, backgroundColor: c.error, padding: 12, borderRadius: 6, marginTop: 16, fontSize: 13 },
  switch: { alignItems: "center", paddingVertical: 16, minHeight: 44 },
  switchText: { color: c.goldText, fontSize: 14 },
}));
