import { db } from "@/lib/db";

/**
 * AppConfig: every business number lives in the DB, never hardcoded
 * in flows (spec section 11 / "Semua angka bisnis berasal dari database").
 */

const DEFAULTS: Record<string, string> = {
  fx_spread_bps: "75", // spread applied on top of mid-market rate
  fee_bps: "50", // 0.5% fee on source amount
  quote_lock_seconds: "60",
  velocity_window_minutes: "10",
  velocity_max_transfers: "3",
  new_recipient_minutes: "30",
  new_recipient_large_usd: "100",
  risk_corridors: '["AF","IR","KP","SY","MM"]',
};

export async function getConfig(key: string): Promise<string> {
  const row = await db.appConfig.findUnique({ where: { key } });
  if (row) return row.value;
  return DEFAULTS[key] ?? "";
}

export async function getConfigNumber(key: string): Promise<number> {
  return Number(await getConfig(key)) || 0;
}

export async function getConfigJson<T>(key: string): Promise<T> {
  try {
    return JSON.parse(await getConfig(key)) as T;
  } catch {
    return [] as unknown as T;
  }
}

export async function setConfig(key: string, value: string) {
  await db.appConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const rows = await db.appConfig.findMany();
  const out: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
