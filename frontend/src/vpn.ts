// Client-side anti-fraud check against a public IP metadata utility.
// Zero server credits: the device queries the utility directly on launch.
export async function isAnonymousNetwork(): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch("https://api.ipapi.is/", { signal: ctrl.signal });
    if (!res.ok) return false;
    const d = await res.json();
    return Boolean(d?.is_vpn || d?.is_proxy || d?.is_tor);
  } catch {
    // Utility unreachable: don't lock out legitimate users
    return false;
  } finally {
    clearTimeout(t);
  }
}
