import { db } from "@/lib/db";

/**
 * FX rates via Frankfurter (ECB data, free, no API key) with DB caching.
 * All currencies are quoted through USD as the pivot.
 */

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,SGD,EUR,GBP";
const CACHE_TTL_MS = 5 * 60 * 1000;

export const SUPPORTED_CCY = ["USD", "IDR", "SGD", "EUR", "GBP"] as const;

export type FxSnapshot = Record<string, number>; // "USD" -> 1, "IDR" -> 17841, ...

let memCache: { at: number; rates: FxSnapshot } | null = null;

export async function refreshFxRates(): Promise<FxSnapshot> {
  const res = await fetch(FRANKFURTER_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Frankfurter error ${res.status}`);
  const json = (await res.json()) as { rates: Record<string, number> };
  const rates: FxSnapshot = { USD: 1, ...json.rates };
  const now = new Date();
  for (const [base, val] of Object.entries(rates)) {
    await db.fxRate.upsert({
      where: { base_quote: { base: "USD", quote: base } },
      create: { base: "USD", quote: base, rate: val, source: "frankfurter", fetchedAt: now },
      update: { rate: val, source: "frankfurter", fetchedAt: now },
    });
    // inverse pair
    await db.fxRate.upsert({
      where: { base_quote: { base, quote: "USD" } },
      create: { base, quote: "USD", rate: 1 / val, source: "frankfurter", fetchedAt: now },
      update: { rate: 1 / val, source: "frankfurter", fetchedAt: now },
    });
  }
  memCache = { at: Date.now(), rates };
  return rates;
}

/** Cross rates via USD. Falls back to DB then seeds, then static last-resort. */
export async function getFxSnapshot(): Promise<FxSnapshot> {
  if (memCache && Date.now() - memCache.at < CACHE_TTL_MS) return memCache.rates;
  try {
    return await refreshFxRates();
  } catch {
    const rows = await db.fxRate.findMany({ where: { base: "USD" } });
    if (rows.length > 0) {
      const rates: FxSnapshot = { USD: 1 };
      for (const r of rows) rates[r.quote] = r.rate;
      memCache = { at: Date.now(), rates };
      return rates;
    }
    // last-resort static snapshot so the demo never dies offline
    return { USD: 1, IDR: 16250, SGD: 1.34, EUR: 0.92, GBP: 0.79 };
  }
}

/** Convert an amount (in major units) from one currency to another via USD. */
export function convert(amount: number, from: string, to: string, rates: FxSnapshot): number {
  const usd = amount / (rates[from] || 1);
  return usd * (rates[to] || 1);
}

export function toUsd(amount: number, ccy: string, rates: FxSnapshot): number {
  return amount / (rates[ccy] || 1);
}
