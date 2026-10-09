"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill, QButton, Eyebrow } from "./primitives";
import { api } from "@/lib/qila/client";
import type { SendPrefill } from "./Send";

type DemoStatus = {
  network: {
    name: string;
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    faucetUrl: string;
  };
  tokens: { code: string; name: string; address: string }[];
  tiers: { tier: number; name: string; perTxLimitUsd: number; rolling30dLimitUsd: number }[];
  config: Record<string, string>;
  treasury: { address: string; explorer: string };
};

const PERSONAS = [
  {
    key: "sari",
    name: "Sari",
    tier: 0,
    desc: "Tier 0 Basic. Small balance. Best for: small sends that pass with no KYC, large sends that trigger step up.",
    emoji: "👩",
  },
  {
    key: "budi",
    name: "Budi",
    tier: 2,
    desc: "Tier 2 Full KYC. High limits open. Best for: cross currency transfers with no friction.",
    emoji: "👨",
  },
  {
    key: "dewi",
    name: "Dewi",
    tier: 0,
    desc: "Tier 0 with high velocity history. Best for: velocity risk triggers inside 10 minutes.",
    emoji: "👩‍🦱",
  },
  {
    key: "admin",
    name: "Admin",
    tier: 2,
    desc: "Compliance console: review queues, approve or reject held transfers, edit tier limits and spreads.",
    emoji: "🧑‍💼",
  },
];

const SCENARIOS: {
  key: string;
  label: string;
  persona: string;
  desc: string;
  prefill: SendPrefill;
  needsSetup?: string;
}[] = [
  {
    key: "small-ok",
    label: "Small send, passes with no KYC",
    persona: "sari",
    desc: "Sari sends $20 to Ibu Ratna. No KYC screen, straight to compliance check and onchain.",
    prefill: { fromCcy: "USD", toCcy: "USD", amount: "20", scenarioLabel: "Small send that passes ($20)" },
  },
  {
    key: "big-stepup",
    label: "Large send, STEP UP plus verification",
    persona: "sari",
    desc: "Sari sends $200. Above the $50 Tier 0 limit, so step up with reason code LIMIT_PER_TX. Pick a method, simulate approval, the transfer continues automatically.",
    prefill: { fromCcy: "USD", toCcy: "USD", amount: "200", scenarioLabel: "Large send with step up ($200)" },
  },
  {
    key: "velocity",
    label: "High velocity, risk trigger",
    persona: "dewi",
    desc: "Dewi already has back to back transfer history. The next transfer triggers VELOCITY_HIGH.",
    prefill: { fromCcy: "USD", toCcy: "IDR", amount: "10", scenarioLabel: "Velocity trigger (Dewi)" },
    needsSetup: "velocity",
  },
  {
    key: "screening",
    label: "Screened recipient, HOLD REVIEW",
    persona: "sari",
    desc: "Sari sends to 'Hansi Vijayananth' (dummy list entry). The transfer goes to pending review, where an admin approves or rejects it.",
    prefill: {
      fromCcy: "USD",
      toCcy: "USD",
      amount: "25",
      recipientName: "Hansi Vijayananth",
      scenarioLabel: "Screening hold (HOLD_REVIEW)",
    },
  },
  {
    key: "fx-idr-eur",
    label: "IDR to EUR (treasury fallback)",
    persona: "sari",
    desc: "Cross currency: qIDR to qEUR through the treasury fallback, since the DEX has no non USD pair.",
    prefill: { fromCcy: "IDR", toCcy: "EUR", amount: "500000", scenarioLabel: "IDR to EUR send" },
  },
  {
    key: "sanctions-block",
    label: "Sanctions, automatic BLOCK",
    persona: "sari",
    desc: "Recipient 'Vladimir Skriponov' is on the dummy sanctions list, so the transfer is blocked before execution.",
    prefill: {
      fromCcy: "USD",
      toCcy: "USD",
      amount: "15",
      recipientName: "Vladimir Skriponov",
      scenarioLabel: "Sanctions block (BLOCK)",
    },
  },
];

const SCRIPT = [
  "0:00, open the Demo view and explain the idea: remittance on Tempo Testnet with adaptive KYC.",
  "0:20, scenario 1 (Sari $20): show there is NO KYC screen, straight to settled in about 1 to 2 seconds plus a tx hash in the explorer.",
  "0:50, scenario 2 (Sari $200): reason code LIMIT_PER_TX, the 'Why am I asked to verify?' panel, pick selfie liveness, Simulate: Approve, the transfer continues automatically.",
  "1:30, scenario 3 (Dewi velocity): risk trigger VELOCITY_HIGH even though the amount is small.",
  "2:00, scenario 4 (screening): HOLD_REVIEW, then open the Admin console in the same tab, Approve and execute, back again, transfer settled.",
  "2:30, scenario 5 (IDR to EUR): locked rate plus countdown, Treasury fallback mode, settled plus explorer.",
  "2:50, close: every number (limits, spreads, risk thresholds) comes from the database, and risk decisions are stored with snapshots.",
];

export function DemoView({
  onPersona,
  onScenario,
}: {
  onPersona: (persona: string) => Promise<void>;
  onScenario: (scenario: (typeof SCENARIOS)[number]) => Promise<void>;
}) {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api<DemoStatus>("/api/demo", { body: { action: "status" } });
    if (res.ok) setStatus(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resetDemo() {
    setBusy("reset");
    setNote("Resetting the demo. Clearing transfers, quotes, and verifications, then reseeding personas...");
    const res = await api("/api/demo", { body: { action: "reset" } });
    await load();
    if (res.ok) {
      setNote("Demo reset to its initial state (Dewi velocity history is reseeded too).");
    } else {
      setNote(`Reset failed: ${res.error}. Sign in as admin to reset.`);
    }
    setBusy(null);
  }

  async function resetWindow() {
    setBusy("window");
    const res = await api("/api/demo", { body: { action: "reset" } });
    setNote(
      res.ok
        ? "Rolling window and transfer history cleared."
        : `Reset failed: ${res.error}. Sign in as admin to reset.`,
    );
    setBusy(null);
  }

  return (
    <div className="qila-container max-w-6xl space-y-8 py-8">
      <div>
        <Eyebrow tone="blue">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Demo center
        </Eyebrow>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-qila-ink sm:text-4xl">
          A 3 minute demo, ready to run
        </h1>
        <p className="mt-2 max-w-2xl text-qila-muted">
          Pick a persona, run one click scenarios, and reset all data any time. Every
          execution is genuinely onchain on Tempo Moderato.
        </p>
      </div>

      {/* personas */}
      <section>
        <h2 className="text-lg font-extrabold text-qila-ink">1. One click personas</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              onClick={async () => {
                setBusy(p.key);
                await onPersona(p.key);
                setBusy(null);
              }}
              className="group rounded-3xl border border-qila-line bg-white p-5 text-left transition hover:-translate-y-1 hover:border-qila-blue hover:shadow-[0_18px_50px_rgba(10,20,48,0.12)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{p.emoji}</span>
                <Pill className="bg-qila-blue-soft text-qila-blue-dark">Tier {p.tier}</Pill>
              </div>
              <p className="mt-3 text-lg font-extrabold text-qila-ink">{p.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-qila-muted">{p.desc}</p>
              <span className="mt-3 inline-block text-sm font-bold text-qila-blue group-hover:underline">
                {busy === p.key ? "Signing in..." : "Sign in as " + p.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* scenarios */}
      <section>
        <h2 className="text-lg font-extrabold text-qila-ink">2. Ready made scenarios</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SCENARIOS.map((s) => (
            <div
              key={s.key}
              className="flex flex-col justify-between rounded-3xl border border-qila-line bg-white p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-qila-night px-2.5 py-1 text-xs font-bold text-qila-sky">
                    {s.persona}
                  </span>
                  {s.needsSetup && (
                    <Pill className="bg-qila-sky-soft text-qila-sky-deep">auto-setup</Pill>
                  )}
                </div>
                <p className="mt-2 font-extrabold text-qila-ink">{s.label}</p>
                <p className="mt-1 text-sm text-qila-muted">{s.desc}</p>
              </div>
              <QButton
                className="mt-4 w-fit"
                size="sm"
                onClick={async () => {
                  setBusy(s.key);
                  await onScenario(s);
                  setBusy(null);
                }}
                disabled={busy !== null}
              >
                {busy === s.key ? "Setting up..." : "Run scenario"}
              </QButton>
            </div>
          ))}
        </div>
      </section>

      {/* controls */}
      <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-qila-line bg-white p-6">
        <div className="flex-1">
          <h2 className="text-lg font-extrabold text-qila-ink">3. Demo controls</h2>
          <p className="text-sm text-qila-muted">
            Reset restores personas, limits, screening, and balances to the initial state. Persona
            wallet addresses are kept (deterministic) so onchain history stays consistent.
          </p>
          {note && (
            <p className="mt-2 rounded-xl bg-qila-sky-soft px-3 py-2 text-sm font-semibold text-qila-sky-deep">
              {note}
            </p>
          )}
        </div>
        <QButton variant="dark" onClick={resetDemo} disabled={busy !== null}>
          {busy === "reset" ? "Resetting..." : "Reset all demo data"}
        </QButton>
        <QButton variant="outline" onClick={resetWindow} disabled={busy !== null}>
          {busy === "window" ? "Resetting..." : "Reset rolling window"}
        </QButton>
      </section>

      {/* script */}
      <section className="rounded-3xl border border-qila-line bg-white p-6">
        <h2 className="text-lg font-extrabold text-qila-ink">4. Three minute demo script</h2>
        <ol className="mt-3 space-y-2">
          {SCRIPT.map((line, i) => (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-qila-line bg-background p-3 text-sm transition hover:border-qila-blue/40">
                <input
                  type="checkbox"
                  checked={checked.includes(i)}
                  onChange={() =>
                    setChecked((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))
                  }
                  className="mt-1 accent-qila-blue"
                />
                <span className={checked.includes(i) ? "text-qila-muted line-through" : "text-qila-ink"}>
                  {line}
                </span>
              </label>
            </li>
          ))}
        </ol>
      </section>

      {/* tech summary */}
      <section className="rounded-3xl bg-qila-night p-6 text-white">
        <h2 className="text-lg font-extrabold">5. Technical summary</h2>
        {status && (
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              <p className="font-bold text-qila-sky">Network</p>
              <KV k="Network" v={status.network.name} />
              <KV k="Chain ID" v={String(status.network.chainId)} />
              <KV k="RPC" v={status.network.rpcUrl} />
              <a
                href={status.network.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="block font-mono text-xs text-qila-sky underline"
              >
                {status.network.explorerUrl} ↗
              </a>
              <p className="pt-2 font-bold text-qila-sky">Treasury</p>
              <a
                href={status.treasury.explorer}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-mono text-xs text-qila-sky underline"
              >
                {status.treasury.address} ↗
              </a>
              <p className="pt-2 font-bold text-qila-sky">Business config (DB)</p>
              <KV k="Spread" v={`${status.config.fx_spread_bps} bps`} />
              <KV k="Fee" v={`${status.config.fee_bps} bps`} />
              <KV k="Velocity trigger" v={`${status.config.velocity_max_transfers} tx per ${status.config.velocity_window_minutes} min`} />
            </div>
            <div className="space-y-2">
              <p className="font-bold text-qila-sky">TIP-20 tokens</p>
              {status.tokens.map((t) => (
                <a
                  key={t.code}
                  href={`${status.network.explorerUrl}/address/${t.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg bg-qila-night-soft px-3 py-2"
                >
                  <span className="font-bold">{t.code}</span>
                  <span className="font-mono text-xs text-white/60">{t.address.slice(0, 18)}… ↗</span>
                </a>
              ))}
              <p className="pt-2 font-bold text-qila-sky">Tier limits</p>
              {status.tiers.map((t) => (
                <KV
                  key={t.tier}
                  k={`Tier ${t.tier} ${t.name}`}
                  v={`$${t.perTxLimitUsd.toLocaleString()} / $${t.rolling30dLimitUsd.toLocaleString()}`}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-qila-night-soft px-3 py-2">
      <span className="text-white/60">{k}</span>
      <span className="text-right font-bold">{v}</span>
    </div>
  );
}

export { SCENARIOS };
export type { DemoStatus };
