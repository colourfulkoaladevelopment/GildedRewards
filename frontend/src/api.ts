import { storage } from "@/src/utils/storage";
import { KEYS } from "@/src/constants";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type User = {
  id: string;
  email: string;
  role: string;
  balance: number;
  paypal_email: string | null;
  ads_today: number;
  ads_max: number;
  min_cashout: number;
  ad_payout: number;
};

export type Tx = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  paypal_email: string;
  status: "success" | "failed";
  error?: string | null;
  created_at: string;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await storage.secureGet<string | null>(KEYS.token, null);
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    let msg = "Something went wrong";
    if (typeof data?.detail === "string") msg = data.detail;
    else if (Array.isArray(data?.detail)) msg = data.detail[0]?.msg ?? msg;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}
