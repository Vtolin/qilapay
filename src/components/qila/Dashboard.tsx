"use client";

import { useState } from "react";
import { Pill, QButton, Eyebrow } from "./primitives";
import {
  api,
  type SessionData,
  type TransferRecord,
} from "@/lib/qila/client";
import {
  formatMoney,
  formatUsdShort,
  shortenAddress,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_TONES,
  timeAgo,
  formatNumber,
  TIER_LABELS,
} from "@/lib/qila/format";

const CCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  IDR: "🇮🇩",
  SGD: "🇸🇬",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
};

export function DashboardView({
  session,
  refresh,
  onGoSend,
  onGoVerify,
  onGoTransfers,
}: {
  session: SessionData;
  refresh: () => Promise<void>;
  onGoSend: () => void;
  onGoVerify: () => void;
  onGoTransfers: () => void;
}) {
  const [toppingUp, setToppingUp] = useState<string | null>(null);
  const user = session.user!;
  const tier = session.tier;
  const usage = session.usage30dUsd || 0;
  const balances = session.balances || [];

  async function topUp(ccy: string) {
    setToppingUp(ccy);
    await api("/api/fund", { body: { currency: ccy } });
    await refresh();
    setToppingUp(null);
  }

  const nextTier = session.tiers?.find((t) => t.tier === user.currentTier + 1);
  const usagePct = tier ? Math.min(100, (usage / tier.rolling30dLimitUsd) * 100) : 0;

  return (
    <div className="qila-container max-w-6xl space-y-6 py-8">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow tone="blue">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Dashboard
          </Eyebrow>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-qila-ink">
            Welcome, {user.fullName.split(" ")[0]}
          </h1>
          <p className="text-sm text-qila-muted">
            Tempo wallet:{" "}
            <code className="rounded bg-qila-blue-soft/70 px-1.5 py-0.5 font-bold text-qila-blue-dark">
              {shortenAddress(user.walletAddress || "")}
            </code>{" "}
            · Tier {user.currentTier} ({TIER_LABELS[user.currentTier] || "?"})
          </p>
        </div>
        <QButton size="lg" onClick={onGoSend}>
          Send money
        </QButton>
      </div>

      {/* balances */}
      <section className="rounded-3xl border border-qila-line bg-white p-6 shadow-[0_4px_14px_rgba(10,20,48,0.06)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-qila-ink">Onchain balances</h2>
          <span className="text-xs font-semibold text-qila-muted">
            TIP-20 on Tempo Moderato, live from RPC
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {balances.map((b) => (
            <div key={b.code} className="rounded-2xl border border-qila-line bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-qila-muted">
                  {CCY_FLAGS[b.code] || ""} {b.code}
                </span>
                {b.code !== "USD" && (
                  <button
                    onClick={() => topUp(b.code)}
                    disabled={toppingUp !== null}
                    className="text-[11px] font-bold text-qila-blue hover:underline disabled:opacity-50"
                  >
                    {toppingUp === b.code ? "..." : "+ top up"}
                  </button>
                )}
                {b.code === "USD" && (
                  <button
                    onClick={() => topUp("USD")}
                    disabled={toppingUp !== null}
                    className="text-[11px] font-bold text-qila-blue hover:underline disabled:opacity-50"
                  >
                    {toppingUp === "USD" ? "..." : "+ faucet"}
                  </button>
                )}
              </div>
              <p className="mt-1 truncate text-xl font-extrabold text-qila-ink">
                {formatNumber(b.amount)}
              </p>
              <p className="text-[11px] text-qila-muted">{b.name}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* recent transfers */}
        <section className="rounded-3xl border border-qila-line bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-qila-ink">Recent transfers</h2>
            <button onClick={onGoTransfers} className="text-sm font-bold text-qila-blue hover:underline">
              View all
            </button>
          </div>
          {(session.recentTransfers || []).length === 0 ? (
            <p className="rounded-2xl bg-background p-6 text-center text-sm text-qila-muted">
              No transfers yet. Try a small send from the Send menu, no KYC screen needed.
            </p>
          ) : (
            <ul className="space-y-2">
              {(session.recentTransfers as TransferRecord[]).map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-qila-line bg-background px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-qila-ink">
                      {t.recipient?.name} · {t.quote?.fromCcy} → {t.quote?.toCcy}
                    </p>
                    <p className="text-xs text-qila-muted">
                      {formatMoney(Number(t.quote?.amountOut || 0) / 1e6, t.quote?.toCcy || "USD")} ·{" "}
                      {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <Pill className={TRANSFER_STATUS_TONES[t.status] || "bg-qila-blue-soft"}>
                    {TRANSFER_STATUS_LABELS[t.status] || t.status}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* tier & limits */}
        <section className="space-y-6">
          <div className="rounded-3xl border border-qila-line bg-white p-6">
            <h2 className="text-lg font-extrabold text-qila-ink">Your tier limits</h2>
            {tier && (
              <>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-bold text-qila-ink">Rolling 30 days</span>
                      <span className="text-qila-muted">
                        {formatUsdShort(usage)} / {formatUsdShort(tier.rolling30dLimitUsd)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-qila-blue-soft/70">
                      <div
                        className="h-full rounded-full bg-qila-blue transition-all"
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-bold text-qila-ink">Per transfer limit</span>
                      <span className="text-qila-muted">{formatUsdShort(tier.perTxLimitUsd)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-qila-blue-soft/70">
                      <div className="h-full w-full rounded-full bg-qila-sky" />
                    </div>
                  </div>
                </div>
                {nextTier ? (
                  <div className="mt-5 rounded-2xl bg-qila-good-soft p-4 text-sm">
                      <p className="font-bold text-qila-good">
                        Tier {nextTier.tier} ({nextTier.name}) unlocks:
                      </p>
                      <p className="text-qila-good/90">
                        {formatUsdShort(nextTier.perTxLimitUsd)} per transfer,{" "}
                        {formatUsdShort(nextTier.rolling30dLimitUsd)} per 30 days
                      </p>
                      <QButton size="sm" className="mt-3" onClick={onGoVerify}>
                        How to move up
                      </QButton>
                    </div>
                  ) : (
                    <p className="mt-5 rounded-2xl bg-qila-good-soft p-4 text-sm font-bold text-qila-good">
                      You are on the highest tier.
                    </p>
                  )}
              </>
            )}
          </div>

          {session.pendingVerifications && session.pendingVerifications.length > 0 && (
            <div className="rounded-3xl border border-qila-warn/30 bg-qila-warn-soft p-6">
                <h2 className="text-lg font-extrabold text-qila-warn">
                  {session.pendingVerifications.length} verification(s) waiting for simulation
                </h2>
                <p className="mt-1 text-sm text-qila-warn/80">
                  Open the verification center to simulate the provider result.
                </p>
                <QButton size="sm" className="mt-3" onClick={onGoVerify}>
                  Open verification
                </QButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
