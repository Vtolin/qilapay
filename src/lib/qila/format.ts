/** Client-safe formatting helpers (no server imports). */

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
}

export function formatUsdShort(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function shortenAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortenHash(hash: string): string {
  if (!hash) return "";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  quoted: "Quoted",
  compliance_check: "Compliance check",
  awaiting_verification: "Awaiting verification",
  pending_review: "Admin review",
  submitted: "Submitted onchain",
  settled: "Settled",
  failed: "Failed",
  blocked: "Blocked",
};

export const TRANSFER_STATUS_TONES: Record<string, string> = {
  quoted: "bg-qila-sky-soft text-qila-sky-deep",
  compliance_check: "bg-qila-sky-soft text-qila-sky-deep",
  awaiting_verification: "bg-qila-warn-soft text-qila-warn",
  pending_review: "bg-qila-warn-soft text-qila-warn",
  submitted: "bg-qila-blue-soft text-qila-blue-dark",
  settled: "bg-qila-good-soft text-qila-good",
  failed: "bg-qila-bad-soft text-qila-bad",
  blocked: "bg-qila-bad-soft text-qila-bad",
};

export const TIER_LABELS = ["Basic", "Verified", "Full KYC", "Enhanced"];

export function timeAgo(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
