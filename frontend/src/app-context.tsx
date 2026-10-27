import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { api, User } from "@/src/api";
import { KEYS } from "@/src/constants";
import { storage } from "@/src/utils/storage";

type Ctx = {
  user: User | null;
  setUser: (u: User | null) => void;
  signIn: (mode: "login" | "register", email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<User | null>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    // local cache so subsequent boots render instantly
    storage.setItem(KEYS.user, u ? JSON.stringify(u) : null);
  }, []);

  const signIn = useCallback(
    async (mode: "login" | "register", email: string, password: string) => {
      const res = await api<{ token: string; user: User }>(`/auth/${mode}`, {
        method: "POST",
        body: { email, password },
      });
      await storage.secureSet(KEYS.token, res.token);
      setUser(res.user);
    },
    [setUser],
  );

  const signOut = useCallback(async () => {
    await storage.secureRemove(KEYS.token);
    setUser(null);
  }, [setUser]);

  // One /me call on boot (no polling). Falls back to cached user if offline.
  const restore = useCallback(async () => {
    const token = await storage.secureGet<string | null>(KEYS.token, null);
    if (!token) return null;
    try {
      const me = await api<User>("/me");
      setUser(me);
      return me;
    } catch (e: any) {
      if (e?.status === 401) {
        await storage.secureRemove(KEYS.token);
        return null;
      }
      const cached = await storage.getItem<string | null>(KEYS.user, null);
      const u = cached ? (JSON.parse(cached) as User) : null;
      setUserState(u);
      return u;
    }
  }, [setUser]);

  const value = useMemo(() => ({ user, setUser, signIn, signOut, restore }), [user, setUser, signIn, signOut, restore]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
