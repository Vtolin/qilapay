/** Client-safe formatting helpers (no server imports). */

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("id-ID", {
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
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(amount);
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
  quoted: "Quote dibuat",
  compliance_check: "Cek compliance",
  awaiting_verification: "Menunggu verifikasi",
  pending_review: "Review admin",
  submitted: "Terkirim on-chain",
  settled: "Settled",
  failed: "Gagal",
  blocked: "Diblokir",
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
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
