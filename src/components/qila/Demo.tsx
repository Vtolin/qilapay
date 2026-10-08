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
    desc: "Tier 0 Basic. Saldo kecil. Cocok untuk: kirim kecil lolos tanpa KYC, kirim besar kena step-up.",
    emoji: "👩",
  },
  {
    key: "budi",
    name: "Budi",
    tier: 2,
    desc: "Tier 2 Full KYC. Limit besar terbuka. Cocok untuk: transfer lintas mata uang tanpa hambatan.",
    emoji: "👨",
  },
  {
    key: "dewi",
    name: "Dewi",
    tier: 0,
    desc: "Tier 0 dengan riwayat velocity tinggi. Cocok untuk: risk trigger velocity dalam 10 menit.",
    emoji: "👩‍🦱",
  },
  {
    key: "admin",
    name: "Admin",
    tier: 2,
    desc: "Konsol compliance: review antrean, approve/reject transfer hold, edit limit tier & spread.",
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
    label: "Kirim kecil → lolos tanpa KYC",
    persona: "sari",
    desc: "Sari kirim $20 ke Ibu Ratna. Tidak ada layar KYC — langsung compliance check dan on-chain.",
    prefill: { fromCcy: "USD", toCcy: "USD", amount: "20", scenarioLabel: "Kirim kecil lolos ($20)" },
  },
  {
    key: "big-stepup",
    label: "Kirim besar → STEP_UP + verifikasi",
    persona: "sari",
    desc: "Sari kirim $200. Melebihi limit $50 Tier 0 → step-up dengan reason code LIMIT_PER_TX. Pilih metode, simulate approve, transfer lanjut otomatis.",
    prefill: { fromCcy: "USD", toCcy: "USD", amount: "200", scenarioLabel: "Kirim besar kena step-up ($200)" },
  },
  {
    key: "velocity",
    label: "Velocity tinggi → risk trigger",
    persona: "dewi",
    desc: "Dewi sudah punya riwayat transfer beruntun. Transfer berikutnya memicu VELOCITY_HIGH.",
    prefill: { fromCcy: "USD", toCcy: "IDR", amount: "10", scenarioLabel: "Velocity trigger (Dewi)" },
    needsSetup: "velocity",
  },
  {
    key: "screening",
    label: "Penerima screening → HOLD_REVIEW",
    persona: "sari",
    desc: "Sari kirim ke 'Hansi Vijayananth' (daftar dummy). Transfer masuk pending_review; admin approve/reject.",
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
    label: "Kirim IDR → EUR (fallback treasury)",
    persona: "sari",
    desc: "Lintas mata uang: qIDR ke qEUR via treasury fallback karena DEX belum punya pair non-USD.",
    prefill: { fromCcy: "IDR", toCcy: "EUR", amount: "500000", scenarioLabel: "Kirim IDR ke EUR" },
  },
  {
    key: "sanctions-block",
    label: "Sanksi → BLOCK otomatis",
    persona: "sari",
    desc: "Penerima 'Vladimir Skriponov' ada di daftar sanksi dummy → transfer diblokir sebelum eksekusi.",
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
  "0:00 — Buka /demo, jelaskan konsep: remittance on Tempo Testnet, KYC adaptif ala Roblox.",
  "0:20 — Skenario 1 (Sari $20): tunjukkan TIDAK ADA layar KYC, langsung settled ~1-2 detik + tx hash di explorer.",
  "0:50 — Skenario 2 (Sari $200): reason code LIMIT_PER_TX, panel 'Kenapa saya diminta verifikasi?', pilih selfie liveness, Simulate: Approve → transfer lanjot otomatis.",
  "1:30 — Skenario 3 (Dewi velocity): risk trigger VELOCITY_HIGH padahal nominal kecil.",
  "2:00 — Skenario 4 (screening): HOLD_REVIEW → buka konsol Admin di tab sama → Approve & eksekusi → balik, transfer settled.",
  "2:30 — Skenario 5 (IDR→EUR): kurs terkunci + countdown, mode Treasury fallback, settled + explorer.",
  "2:50 — Tutup: semua angka (limit, spread, ambang risiko) dari database; risk decisions tercatat dengan snapshot.",
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
    setNote("Mereset demo — menghapus transfer/quote/verifikasi & menyiapkan ulang persona…");
    await api("/api/demo", { body: { action: "reset" } });
    await load();
    setNote("Demo direset ke kondisi awal (riwayat velocity Dewi ikut dibuat ulang).");
    setBusy(null);
  }

  async function resetWindow() {
    setBusy("window");
    await api("/api/demo", { body: { action: "reset" } });
    setNote("Rolling window & riwayat transfer dibersihkan.");
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
          Demo 3 menit, siap pakai
        </h1>
        <p className="mt-2 max-w-2xl text-qila-muted">
          Pilih persona, jalankan skenario satu klik, dan reset semua data kapan pun. Semua
          eksekusi on-chain sungguhan di Tempo Moderato.
        </p>
      </div>

      {/* personas */}
      <section>
        <h2 className="text-lg font-extrabold text-qila-ink">1. Persona satu klik</h2>
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
                {busy === p.key ? "Masuk…" : "Masuk sebagai " + p.name + " →"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* scenarios */}
      <section>
        <h2 className="text-lg font-extrabold text-qila-ink">2. Skenario siap pakai</h2>
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
                {busy === s.key ? "Menyiapkan…" : "Jalankan skenario →"}
              </QButton>
            </div>
          ))}
        </div>
      </section>

      {/* controls */}
      <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-qila-line bg-white p-6">
        <div className="flex-1">
          <h2 className="text-lg font-extrabold text-qila-ink">3. Kontrol demo</h2>
          <p className="text-sm text-qila-muted">
            Reset mengembalikan persona, limit, screening, dan saldo ke kondisi awal. Alamat
            wallet persona dipertahankan (deterministik) agar history on-chain tetap konsisten.
          </p>
          {note && (
            <p className="mt-2 rounded-xl bg-qila-sky-soft px-3 py-2 text-sm font-semibold text-qila-sky-deep">
              {note}
            </p>
          )}
        </div>
        <QButton variant="dark" onClick={resetDemo} disabled={busy !== null}>
          {busy === "reset" ? "Mereset…" : "Reset semua data demo"}
        </QButton>
        <QButton variant="outline" onClick={resetWindow} disabled={busy !== null}>
          {busy === "window" ? "Mereset…" : "Reset rolling window"}
        </QButton>
      </section>

      {/* script */}
      <section className="rounded-3xl border border-qila-line bg-white p-6">
        <h2 className="text-lg font-extrabold text-qila-ink">4. Script demo 3 menit</h2>
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
        <h2 className="text-lg font-extrabold">5. Ringkasan teknis</h2>
        {status && (
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              <p className="font-bold text-qila-sky">Jaringan</p>
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
              <p className="pt-2 font-bold text-qila-sky">Konfigurasi bisnis (DB)</p>
              <KV k="Spread" v={`${status.config.fx_spread_bps} bps`} />
              <KV k="Fee" v={`${status.config.fee_bps} bps`} />
              <KV k="Velocity trigger" v={`≥${status.config.velocity_max_transfers} tx / ${status.config.velocity_window_minutes} menit`} />
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
              <p className="pt-2 font-bold text-qila-sky">Limit tier</p>
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
