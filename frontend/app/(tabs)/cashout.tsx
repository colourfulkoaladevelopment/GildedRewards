import Ionicons from "@react-native-vector-icons/ionicons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Tx, User } from "@/src/api";
import { useApp } from "@/src/app-context";
import { GoldButton } from "@/src/components/GoldButton";
import { Header } from "@/src/components/Header";
import { Monogram } from "@/src/components/Monogram";
import { useToast } from "@/src/components/Toast";
import { MIN_CASHOUT } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, useTheme } from "@/src/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Cashout() {
  const { user, setUser } = useApp();
  const [email, setEmail] = useState(user?.paypal_email ?? "");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Tx[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  useEffect(() => {
    if (user?.paypal_email && !email) setEmail(user.paypal_email);
  }, [user?.paypal_email, email]);

  // History is fetched only while this tab is actively selected.
  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await api<{ items: Tx[]; has_more: boolean }>(`/transactions?page=${p}`);
      setItems(res.items);
      setHasMore(res.has_more);
      setPage(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load]),
  );

  if (!user) return <View style={styles.root} />;
  const eligible = user.balance >= MIN_CASHOUT;
  const validEmail = EMAIL_RE.test(email.trim());

  const requestPayout = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await api<{ success: boolean; message: string; user: User }>("/cashout", {
        method: "POST",
        body: { paypal_email: email.trim() },
      });
      setUser(res.user);
      setResult({ ok: res.success, msg: res.message });
      toast(res.success ? "success" : "error", res.message);
      load(1);
    } catch (e: any) {
      const msg = e?.message ?? "Payout failed. Your balance was kept.";
      setResult({ ok: false, msg });
      toast("error", msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root} testID="cashout-screen">
      <Header />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottomChrome + 24 }]}
      >
        <View style={styles.balanceRow}>
          <Text style={styles.label}>CURRENT BALANCE</Text>
          <Text testID="cashout-balance-amount" style={styles.balance}>
            ${user.balance.toFixed(2)}
          </Text>
          <Text style={styles.hint}>
            {eligible ? `You can cash out $${MIN_CASHOUT.toFixed(2)} now.` : `Minimum payout is $${MIN_CASHOUT.toFixed(2)}.`}
          </Text>
        </View>

        <View>
          <Text style={styles.label}>PAYPAL EMAIL ADDRESS</Text>
          <TextInput
            testID="paypal-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="name@paypal.com"
            placeholderTextColor={colors.muted}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, focused && styles.inputFocus]}
          />
        </View>

        <GoldButton
          testID="request-payout-button"
          title={`Request Payout · $${MIN_CASHOUT.toFixed(2)}`}
          disabled={!eligible || !validEmail}
          loading={sending}
          onPress={requestPayout}
          large
        />

        {result ? (
          <View testID="payout-result" style={[styles.result, { backgroundColor: result.ok ? colors.success : colors.error }]}>
            <Ionicons
              name={result.ok ? "checkmark-circle" : "alert-circle"}
              size={20}
              color={result.ok ? colors.onSuccess : colors.onError}
            />
            <Text testID="payout-result-message" style={[styles.resultText, { color: result.ok ? colors.onSuccess : colors.onError }]}>
              {result.msg}
            </Text>
          </View>
        ) : null}

        <View style={styles.history}>
          <View style={styles.historyHead}>
            <Text style={styles.historyTitle}>History</Text>
            <Text style={styles.hint}>Page {page}</Text>
          </View>

          {loading ? (
            <ActivityIndicator testID="history-loading" color={colors.brand} style={{ paddingVertical: 32 }} />
          ) : error ? (
            <Pressable testID="history-retry-button" onPress={() => load(page)} style={styles.empty}>
              <Text style={styles.hint}>{error} · Tap to retry</Text>
            </Pressable>
          ) : items.length === 0 ? (
            <View testID="history-empty" style={styles.empty}>
              <Monogram size={40} color={colors.border} />
              <Text style={styles.hint}>No payouts yet</Text>
            </View>
          ) : (
            items.map((t) => (
              <View key={t.id} testID={`history-row-${t.id}`} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {t.paypal_email}
                  </Text>
                  <Text style={styles.rowSub}>
                    {new Date(t.created_at).toLocaleString()} · {t.status === "success" ? "Sent" : "Failed"}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, t.status !== "success" && styles.rowFailed]}>
                  {t.status === "success" ? "-" : ""}${t.amount.toFixed(2)}
                </Text>
              </View>
            ))
          )}

          <View style={styles.pager}>
            <Pressable
              testID="history-prev-button"
              disabled={page <= 1 || loading}
              onPress={() => load(page - 1)}
              style={[styles.pagerBtn, (page <= 1 || loading) && styles.pagerOff]}
            >
              <Ionicons name="chevron-back" size={16} color={colors.goldText} />
              <Text style={styles.pagerText}>Prev</Text>
            </Pressable>
            <Pressable
              testID="history-next-button"
              disabled={!hasMore || loading}
              onPress={() => load(page + 1)}
              style={[styles.pagerBtn, (!hasMore || loading) && styles.pagerOff]}
            >
              <Text style={styles.pagerText}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.goldText} />
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 24, paddingTop: 16, gap: 24 },
  balanceRow: { gap: 4 },
  label: { color: c.goldText, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  balance: { fontFamily: fonts.display, fontSize: 44, fontWeight: "700", color: c.onSurface },
  hint: { color: c.muted, fontSize: 12 },
  input: { height: 52, borderBottomWidth: 1, borderColor: c.border, color: c.onSurface, fontSize: 16 },
  inputFocus: { borderColor: c.brand, borderBottomWidth: 1.5 },
  result: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 12, alignItems: "center" },
  resultText: { flex: 1, fontSize: 14, lineHeight: 20 },
  history: { backgroundColor: c.surfaceSecondary, borderRadius: 20, borderWidth: 0.75, borderColor: c.border, padding: 16 },
  historyHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  historyTitle: { fontFamily: fonts.display, fontSize: 20, color: c.onSurface },
  empty: { alignItems: "center", paddingVertical: 32, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.75, borderColor: c.divider, gap: 12 },
  rowTitle: { color: c.onSurface, fontSize: 14 },
  rowSub: { color: c.muted, fontSize: 11, marginTop: 2 },
  rowAmount: { color: c.goldText, fontSize: 15, fontWeight: "700" },
  rowFailed: { color: c.muted, textDecorationLine: "line-through" },
  pager: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  pagerBtn: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 8 },
  pagerOff: { opacity: 0.3 },
  pagerText: { color: c.goldText, fontSize: 13, fontWeight: "600" },
}));
