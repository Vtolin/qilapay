"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill, QButton, Eyebrow } from "./primitives";
import { api } from "@/lib/qila/client";
import {
  formatMoney,
  formatDateTime,
  shortenHash,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_TONES,
} from "@/lib/qila/format";

type AdminData = {
  pendingVerifications: {
    id: string;
    method: string;
    targetTier: number;
    status: string;
    createdAt: string;
    user: { fullName: string; email: string; currentTier: number };
  }[];
  pendingReviewTransfers: {
    id: string;
    createdAt: string;
    user: { fullName: string; email: string };
    recipient: { name: string; country: string };
    quote: { fromCcy: string; toCcy: string; amountIn: string; amountOut: string; usdEquivalent: number };
    riskDecisions: { outcome: string; reasonCodes: string }[];
  }[];
  transfers: {
    id: string;
    status: string;
    createdAt: string;
    settledAt: string | null;
    txHash: string | null;
    executionMode: string | null;
    user: { fullName: string };
    recipient: { name: string };
    quote: { fromCcy: string; toCcy: string; amountIn: string; amountOut: string };
  }[];
  riskDecisions: {
    id: string;
    outcome: string;
    reasonCodes: string;
    inputSnapshot: string;
    createdAt: string;
    transferId: string | null;
    user: { fullName: string };
  }[];
  tiers: {
    tier: number;
    name: string;
    perTxLimitUsd: number;
    rolling30dLimitUsd: number;
  }[];
  screening: { id: string; name: string; reason: string; action: string }[];
  config: Record<string, string>;
  rates: Record<string, number>;
};

const OUTCOME_TONES: Record<string, string> = {
  ALLOW: "bg-qila-good-soft text-qila-good",
  STEP_UP: "bg-qila-warn-soft text-qila-warn",
  HOLD_REVIEW: "bg-qila-warn-soft text-qila-warn",
  BLOCK: "bg-qila-bad-soft text-qila-bad",
};

export function AdminView() {
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"queue" | "monitor" | "risk" | "config">("queue");

  const load = useCallback(async () => {
    const res = await api<AdminData>("/api/admin");
    if (res.ok) setData(res.data);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function act(type: "verification" | "transfer", id: string, action: string) {
    setBusy(true);
    await api("/api/admin/review", { body: { type, id, action } });
    await load();
    setBusy(false);
  }

  async function saveConfig(patch: Record<string, string>) {
    setBusy(true);
    await api("/api/admin/config", { body: { action: "config", config: patch } });
    await load();
    setBusy(false);
  }

  async function saveTier(tier: number, perTx: number, rolling: number) {
    setBusy(true);
    await api("/api/admin/config", {
      body: { action: "tiers", tiers: [{ tier, perTxLimitUsd: perTx, rolling30dLimitUsd: rolling }] },
    });
    await load();
    setBusy(false);
  }

  if (!data) {
    return <div className="qila-container py-10 text-qila-muted">Loading admin console...</div>;
  }

  const totalPending =
    data.pendingVerifications.length + data.pendingReviewTransfers.length;

  return (
    <div className="qila-container max-w-6xl space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow tone="dark">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Admin console
          </Eyebrow>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-qila-ink">
            Compliance and operations
          </h1>
        </div>
        <Pill className={totalPending > 0 ? "bg-qila-warn text-white" : "bg-qila-good-soft text-qila-good"}>
          {totalPending > 0 ? `${totalPending} items need review` : "Queue is clear"}
        </Pill>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-full bg-qila-blue-soft/70 p-1 sm:w-fit">
        {(
          [
            ["queue", `Queue (${totalPending})`],
            ["monitor", "Transfer monitor"],
            ["risk", "Risk decisions"],
            ["config", "Limits and risk"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition " +
              (tab === key ? "bg-white text-qila-ink shadow-sm" : "text-qila-muted")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* QUEUE */}
      {tab === "queue" && (
        <div className="space-y-6">
          {/* pending review transfers */}
          <section className="rounded-3xl border border-qila-line bg-white p-6">
            <h2 className="text-lg font-extrabold text-qila-ink">Transfers waiting for review</h2>
            {data.pendingReviewTransfers.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-background p-6 text-center text-sm text-qila-muted">
                No transfers in the queue.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.pendingReviewTransfers.map((t) => (
                  <li key={t.id} className="rounded-2xl border border-qila-warn/30 bg-qila-warn-soft/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-qila-ink">
                          {formatMoney(Number(t.quote.amountIn) / 1e6, t.quote.fromCcy)} →{" "}
                          {formatMoney(Number(t.quote.amountOut) / 1e6, t.quote.toCcy)}
                        </p>
                        <p className="text-xs text-qila-muted">
                          {t.user.fullName} to {t.recipient.name} ({t.recipient.country}),{" "}
                          {formatDateTime(t.createdAt)}, about{" "}
                          {t.quote.usdEquivalent.toFixed(2)} USD
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <QButton size="sm" onClick={() => act("transfer", t.id, "approve")} disabled={busy}>
                          Approve and execute
                        </QButton>
                        <QButton size="sm" variant="danger" onClick={() => act("transfer", t.id, "reject")} disabled={busy}>
                          Reject
                        </QButton>
                      </div>
                    </div>
                    {t.riskDecisions[0] && (
                      <p className="mt-2 text-xs font-bold text-qila-warn">
                        Reason codes: {JSON.parse(t.riskDecisions[0].reasonCodes).join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* pending verifications */}
          <section className="rounded-3xl border border-qila-line bg-white p-6">
            <h2 className="text-lg font-extrabold text-qila-ink">KYC verifications waiting</h2>
            {data.pendingVerifications.length === 0 ? (
              <p className="mt-3 rounded-2xl bg-background p-6 text-center text-sm text-qila-muted">
                No verifications in the queue.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.pendingVerifications.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-qila-line bg-background px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-qila-ink">
                        {v.user.fullName} ({v.user.email}), {v.method} to Tier {v.targetTier}
                      </p>
                      <p className="text-xs text-qila-muted">
                        Current tier {v.user.currentTier} {formatDateTime(v.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <QButton size="sm" onClick={() => act("verification", v.id, "approve")} disabled={busy}>
                        Approve
                      </QButton>
                      <QButton size="sm" variant="outline" onClick={() => act("verification", v.id, "needs_more_info")} disabled={busy}>
                        More info
                      </QButton>
                      <QButton size="sm" variant="danger" onClick={() => act("verification", v.id, "reject")} disabled={busy}>
                        Reject
                      </QButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* MONITOR */}
      {tab === "monitor" && (
        <section className="overflow-x-auto rounded-3xl border border-qila-line bg-white p-6">
          <h2 className="text-lg font-extrabold text-qila-ink">Live transfers (latest 30)</h2>
          <table className="mt-3 w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-qila-line text-left text-xs uppercase tracking-wider text-qila-muted">
                <th className="py-2">Time</th>
                <th>Sender to recipient</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {data.transfers.map((t) => (
                <tr key={t.id} className="border-b border-dashed border-qila-line last:border-0">
                  <td className="py-2.5 text-xs text-qila-muted">{formatDateTime(t.createdAt)}</td>
                  <td className="font-bold text-qila-ink">
                    {t.user.fullName} → {t.recipient.name}
                  </td>
                  <td>
                    {formatMoney(Number(t.quote.amountIn) / 1e6, t.quote.fromCcy)} →{" "}
                    {formatMoney(Number(t.quote.amountOut) / 1e6, t.quote.toCcy)}
                  </td>
                  <td className="text-xs">
                    {t.executionMode === "dex" ? "DEX" : t.executionMode === "treasury" ? "Treasury" : "-"}
                  </td>
                  <td>
                    <Pill className={TRANSFER_STATUS_TONES[t.status] || "bg-qila-blue-soft"}>
                      {TRANSFER_STATUS_LABELS[t.status] || t.status}
                    </Pill>
                  </td>
                  <td>
                    {t.txHash ? (
                      <a
                        href={`https://explore.testnet.tempo.xyz/tx/${t.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs font-bold text-qila-blue"
                      >
                        {shortenHash(t.txHash)} ↗
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* RISK */}
      {tab === "risk" && (
        <section className="overflow-x-auto rounded-3xl border border-qila-line bg-white p-6">
          <h2 className="text-lg font-extrabold text-qila-ink">Risk decisions (latest 30)</h2>
          <table className="mt-3 w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-qila-line text-left text-xs uppercase tracking-wider text-qila-muted">
                <th className="py-2">Time</th>
                <th>User</th>
                <th>Outcome</th>
                <th>Reason codes</th>
                <th>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {data.riskDecisions.map((d) => (
                <tr key={d.id} className="border-b border-dashed border-qila-line align-top last:border-0">
                  <td className="py-2.5 text-xs text-qila-muted">{formatDateTime(d.createdAt)}</td>
                  <td className="font-bold text-qila-ink">{d.user.fullName}</td>
                  <td>
                    <Pill className={OUTCOME_TONES[d.outcome] || "bg-qila-blue-soft"}>
                      {d.outcome}
                    </Pill>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(JSON.parse(d.reasonCodes || "[]") as string[]).map((c) => (
                        <code
                          key={c}
                          className="rounded bg-qila-blue-soft px-1.5 py-0.5 text-[11px] font-bold text-qila-blue-dark"
                        >
                          {c}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td className="max-w-[260px] text-xs text-qila-muted">
                    {(() => {
                      try {
                        const s = JSON.parse(d.inputSnapshot) as Record<string, unknown>;
                        return `amount $${Number(s.amountUsd || 0).toFixed(2)}, usage $${Number(s.rollingUsage30dUsd || 0).toFixed(0)}, velocity ${s.velocityLast10m}, tier ${s.userTier} to ${s.targetTier}`;
                      } catch {
                        return "-";
                      }
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* CONFIG */}
      {tab === "config" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-qila-line bg-white p-6">
            <h2 className="text-lg font-extrabold text-qila-ink">Tier limits</h2>
            <div className="mt-3 space-y-3">
              {data.tiers.map((t) => (
                <TierEditor key={t.tier} tier={t} onSave={saveTier} busy={busy} />
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-qila-line bg-white p-6">
              <h2 className="text-lg font-extrabold text-qila-ink">FX spread and fee</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ConfigInput
                  label="Spread (bps)"
                  value={data.config.fx_spread_bps}
                  onSave={(v) => saveConfig({ fx_spread_bps: v })}
                  busy={busy}
                />
                <ConfigInput
                  label="Fee (bps)"
                  value={data.config.fee_bps}
                  onSave={(v) => saveConfig({ fee_bps: v })}
                  busy={busy}
                />
              </div>
              <p className="mt-2 text-xs text-qila-muted">
                Latest Frankfurter rates:{" "}
                {Object.entries(data.rates)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
              </p>
            </section>

            <section className="rounded-3xl border border-qila-line bg-white p-6">
              <h2 className="text-lg font-extrabold text-qila-ink">Risk thresholds</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ConfigInput
                  label="Velocity max per 10 min"
                  value={data.config.velocity_max_transfers}
                  onSave={(v) => saveConfig({ velocity_max_transfers: v })}
                  busy={busy}
                />
                <ConfigInput
                  label="New recipient at or above USD"
                  value={data.config.new_recipient_large_usd}
                  onSave={(v) => saveConfig({ new_recipient_large_usd: v })}
                  busy={busy}
                />
              </div>
              <ConfigInput
                label="Risk corridors (JSON country array)"
                value={data.config.risk_corridors}
                onSave={(v) => saveConfig({ risk_corridors: v })}
                busy={busy}
              />
            </section>

            <section className="rounded-3xl border border-qila-line bg-white p-6">
              <h2 className="text-lg font-extrabold text-qila-ink">Screening list (dummy)</h2>
              <ul className="mt-3 space-y-2">
                {data.screening.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm">
                    <span className="font-bold text-qila-ink">{s.name}</span>
                    <Pill className={s.action === "BLOCK" ? "bg-qila-bad-soft text-qila-bad" : "bg-qila-warn-soft text-qila-warn"}>
                      {s.action}
                    </Pill>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function TierEditor({
  tier,
  onSave,
  busy,
}: {
  tier: { tier: number; name: string; perTxLimitUsd: number; rolling30dLimitUsd: number };
  onSave: (tier: number, perTx: number, rolling: number) => void;
  busy: boolean;
}) {
  const [perTx, setPerTx] = useState(String(tier.perTxLimitUsd));
  const [rolling, setRolling] = useState(String(tier.rolling30dLimitUsd));
  return (
    <div className="rounded-2xl border border-qila-line bg-background p-4">
      <p className="text-sm font-bold text-qila-ink">
        Tier {tier.tier}, {tier.name}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          value={perTx}
          onChange={(e) => setPerTx(e.target.value)}
          className="rounded-lg border border-qila-line px-2 py-1.5 text-sm"
          placeholder="Per tx USD"
        />
        <input
          value={rolling}
          onChange={(e) => setRolling(e.target.value)}
          className="rounded-lg border border-qila-line px-2 py-1.5 text-sm"
          placeholder="Rolling 30d USD"
        />
      </div>
      <QButton
        size="sm"
        className="mt-2"
        onClick={() => onSave(tier.tier, Number(perTx), Number(rolling))}
        disabled={busy}
      >
        Save
      </QButton>
    </div>
  );
}

function ConfigInput({
  label,
  value,
  onSave,
  busy,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  busy: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-qila-muted">{label}</label>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="w-full rounded-lg border border-qila-line px-2 py-1.5 text-sm"
        />
        <QButton size="sm" onClick={() => onSave(v)} disabled={busy || v === value}>
          Set
        </QButton>
      </div>
    </div>
  );
}
