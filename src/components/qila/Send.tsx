"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pill, QButton, Eyebrow } from "./primitives";
import {
  api,
  type SessionData,
  type QuoteRecord,
  type RecipientRecord,
  type DecisionPayload,
  type ExecutionPayload,
  type TransferRecord,
  type VerificationRecord,
} from "@/lib/qila/client";
import {
  formatMoney,
  formatUsdShort,
  formatNumber,
  shortenHash,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_TONES,
} from "@/lib/qila/format";

const CCYS = ["USD", "IDR", "SGD", "EUR", "GBP"];
const CCY_NAMES: Record<string, string> = {
  USD: "US Dollar",
  IDR: "Rupiah",
  SGD: "Singapore Dollar",
  EUR: "Euro",
  GBP: "Pound Sterling",
};

export type SendPrefill = {
  fromCcy?: string;
  toCcy?: string;
  amount?: string;
  recipientName?: string;
  scenarioLabel?: string;
};

type Step = "quote" | "compliance" | "result";

export function SendView({
  session,
  prefill,
  clearPrefill,
  refresh,
}: {
  session: SessionData;
  prefill: SendPrefill | null;
  clearPrefill: () => void;
  refresh: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("quote");
  const [fromCcy, setFromCcy] = useState(prefill?.fromCcy || "USD");
  const [toCcy, setToCcy] = useState(prefill?.toCcy || "IDR");
  const [amount, setAmount] = useState(prefill?.amount || "");
  const [recipientId, setRecipientId] = useState("");
  const [recipients, setRecipients] = useState<RecipientRecord[]>([]);
  const [newName, setNewName] = useState(prefill?.recipientName || "");
  const [newCountry, setNewCountry] = useState("ID");
  const [newAddress, setNewAddress] = useState("");
  const [addingRecipient, setAddingRecipient] = useState(false);

  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [decision, setDecision] = useState<DecisionPayload | null>(null);
  const [methods, setMethods] = useState<{ key: string; label: string }[]>([]);
  const [transfer, setTransfer] = useState<TransferRecord | null>(null);
  const [execResult, setExecResult] = useState<ExecutionPayload | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationRecord | null>(null);

  const scenarioLabel = prefill?.scenarioLabel;

  const loadRecipients = useCallback(async () => {
    const res = await api<{ recipients: RecipientRecord[] }>("/api/recipients");
    if (res.ok) setRecipients(res.data.recipients);
  }, []);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!quote) return 0;
    return Math.max(0, Math.round((new Date(quote.expiresAt).getTime() - now) / 1000));
  }, [quote, now]);

  async function executeTransfer() {
    if (!transfer) return;
    setError(null);
    setBusy(true);
    const res = await api<{ result: ExecutionPayload }>(`/api/transfer/${transfer.id}`, {
      body: {},
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setExecResult(res.data.result);
    const tRes = await api<{ transfer: TransferRecord }>(`/api/transfer/${transfer.id}`);
    if (tRes.ok) setTransfer(tRes.data.transfer);
    setStep("result");
    refresh();
  }

  // auto-continue when verification gets approved (poll while awaiting)
  useEffect(() => {
    if (step !== "compliance" || !transfer || !verification) return;
    if (transfer.status !== "awaiting_verification") return;
    const t = setInterval(async () => {
      const res = await api<{ verifications: VerificationRecord[] }>("/api/verify");
      if (!res.ok) return;
      const v = res.data.verifications.find((x) => x.id === verification.id);
      if (v && v.status === "approved") {
        clearInterval(t);
        await executeTransfer();
      } else if (v && (v.status === "rejected" || v.status === "needs_more_info")) {
        clearInterval(t);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [step, transfer?.id, verification?.id]);

  // poll pending_review transfer status (admin approval)
  useEffect(() => {
    if (step !== "compliance" || !transfer) return;
    if (transfer.status !== "pending_review") return;
    const t = setInterval(async () => {
      const res = await api<{ transfer: TransferRecord }>(`/api/transfer/${transfer.id}`);
      if (!res.ok) return;
      setTransfer(res.data.transfer);
      if (["settled", "failed", "blocked"].includes(res.data.transfer.status)) {
        clearInterval(t);
        setStep("result");
        refresh();
      } else if (res.data.transfer.status === "submitted") {
        // admin approved; execution running — keep polling until terminal
      }
    }, 2500);
    return () => clearInterval(t);
  }, [step, transfer?.id, transfer?.status]);

  const balance = session.balances?.find((b) => b.code === fromCcy);

  async function addRecipient() {
    if (!newName.trim()) {
      setError("Nama penerima wajib diisi");
      return;
    }
    setBusy(true);
    const res = await api<{ recipient: RecipientRecord }>("/api/recipients", {
      body: { name: newName, country: newCountry, walletAddress: newAddress || undefined },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await loadRecipients();
    setRecipientId(res.data.recipient.id);
    setNewName("");
    setNewAddress("");
    setAddingRecipient(false);
    setError(null);
  }

  async function createQuote() {
    setError(null);
    if (!recipientId) {
      setError("Pilih penerima dulu");
      return;
    }
    setBusy(true);
    const res = await api<{ quote: QuoteRecord }>("/api/quote", {
      body: { fromCcy, toCcy, amount: Number(amount) },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setQuote(res.data.quote);
  }

  async function confirmAndSend() {
    setError(null);
    setBusy(true);
    const res = await api<{
      transferId: string;
      decision: DecisionPayload;
      methods: { key: string; label: string }[];
      executed: ExecutionPayload | null;
    }>("/api/transfer", { body: { quoteId: quote!.id, recipientId } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const tRes = await api<{ transfer: TransferRecord }>(`/api/transfer/${res.data.transferId}`);
    if (tRes.ok) setTransfer(tRes.data.transfer);
    setDecision(res.data.decision);
    setMethods(res.data.methods);
    if (res.data.decision.outcome === "ALLOW") {
      setExecResult(res.data.executed);
      setStep("result");
      refresh();
    } else {
      setStep("compliance");
    }
  }

  async function submitVerification() {
    if (!selectedMethod) return;
    setError(null);
    setBusy(true);
    const res = await api<{ providerRef: string; status: string }>("/api/verify", {
      body: {
        method: selectedMethod,
        targetTier: decision?.targetTier ?? 1,
        transferId: transfer?.id,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const vRes = await api<{ verifications: VerificationRecord[] }>("/api/verify");
    if (vRes.ok) {
      const v = vRes.data.verifications.find((x) => x.id === res.data.providerRef);
      setVerification(v || null);
    }
  }

  async function simulate(result: "approve" | "reject" | "needs_more_info") {
    if (!verification) return;
    setBusy(true);
    await api(`/api/verify/${verification.id}/simulate`, { body: { result } });
    setBusy(false);
    const vRes = await api<{ verifications: VerificationRecord[] }>("/api/verify");
    if (vRes.ok) {
      const v = vRes.data.verifications.find((x) => x.id === verification.id);
      setVerification(v || null);
    }
  }

  function resetWizard() {
    setStep("quote");
    setQuote(null);
    setDecision(null);
    setTransfer(null);
    setExecResult(null);
    setVerification(null);
    setSelectedMethod(null);
    setError(null);
    clearPrefill();
  }

  return (
    <div className="qila-container max-w-3xl space-y-6 py-8">
      <div>
        <Eyebrow tone="blue">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Kirim uang
        </Eyebrow>
        {scenarioLabel && (
          <p className="mt-3 inline-flex rounded-full bg-qila-sky-soft px-3 py-1 text-sm font-bold text-qila-sky-deep">
            Skenario: {scenarioLabel}
          </p>
        )}
      </div>

      {/* stepper */}
      <ol className="flex items-center gap-2 text-xs font-bold">
        {[
          ["quote", "1. Quote"],
          ["compliance", "2. Compliance"],
          ["result", "3. Hasil"],
        ].map(([key, label], i) => {
          const idx = ["quote", "compliance", "result"].indexOf(step);
          const state = i < idx ? "done" : i === idx ? "active" : "todo";
          return (
            <li key={key} className="flex items-center gap-2">
              <span
                className={
                  state === "done"
                    ? "flex h-6 w-6 items-center justify-center rounded-full bg-qila-good text-white"
                    : state === "active"
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-qila-blue text-white"
                      : "flex h-6 w-6 items-center justify-center rounded-full bg-qila-blue-soft text-qila-blue-dark"
                }
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "active" ? "text-qila-ink" : "text-qila-muted"}>{label}</span>
              {i < 2 && <span className="mx-1 h-px w-6 bg-qila-line" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="rounded-2xl bg-qila-bad-soft px-4 py-3 text-sm font-semibold text-qila-bad">
          {error}
        </p>
      )}

      {/* STEP 1: QUOTE */}
      {step === "quote" && (
        <section className="space-y-4 rounded-3xl border border-qila-line bg-white p-6 shadow-[0_4px_14px_rgba(10,20,48,0.06)]">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div>
              <label className="mb-1 block text-sm font-bold text-qila-ink">Dari</label>
              <select
                value={fromCcy}
                onChange={(e) => setFromCcy(e.target.value)}
                className="w-full rounded-xl border border-qila-line bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-qila-blue"
              >
                {CCYS.map((c) => (
                  <option key={c} value={c}>
                    {c} — {CCY_NAMES[c]}
                  </option>
                ))}
              </select>
              {balance && (
                <p className="mt-1 text-xs text-qila-muted">
                  Saldo: {formatNumber(balance.amount)} {fromCcy}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setFromCcy(toCcy);
                setToCcy(fromCcy);
              }}
              className="mt-6 flex h-10 w-10 items-center justify-center self-start rounded-full bg-qila-blue-soft text-qila-blue hover:bg-qila-blue hover:text-white"
              aria-label="Tukar mata uang"
            >
              ⇄
            </button>
            <div>
              <label className="mb-1 block text-sm font-bold text-qila-ink">Ke</label>
              <select
                value={toCcy}
                onChange={(e) => setToCcy(e.target.value)}
                className="w-full rounded-xl border border-qila-line bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-qila-blue"
              >
                {CCYS.map((c) => (
                  <option key={c} value={c}>
                    {c} — {CCY_NAMES[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-qila-ink">Nominal ({fromCcy})</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-qila-line px-3 py-3 text-lg font-extrabold outline-none focus:border-qila-blue"
              placeholder="0"
            />
          </div>

          {/* recipient */}
          <div>
            <label className="mb-1 block text-sm font-bold text-qila-ink">Penerima</label>
            <div className="space-y-2">
              {recipients.map((r) => (
                <label
                  key={r.id}
                  className={
                    "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition " +
                    (recipientId === r.id
                      ? "border-qila-blue bg-qila-blue-soft/60"
                      : "border-qila-line bg-background hover:border-qila-blue/50")
                  }
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="recipient"
                      checked={recipientId === r.id}
                      onChange={() => setRecipientId(r.id)}
                      className="accent-qila-blue"
                    />
                    <span>
                      <span className="font-bold text-qila-ink">{r.name}</span>
                      <span className="ml-2 text-xs text-qila-muted">{r.country}</span>
                      {r.linkedUserId && (
                        <span className="ml-2 rounded-full bg-qila-good-soft px-2 py-0.5 text-[10px] font-bold text-qila-good">
                          user QilaPay
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-xs text-qila-muted">
                    {(r.walletAddress || "").slice(0, 8)}…
                  </span>
                </label>
              ))}
              {addingRecipient ? (
                <div className="space-y-2 rounded-xl border border-qila-line bg-background p-3">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama penerima"
                    className="w-full rounded-lg border border-qila-line px-3 py-2 text-sm outline-none focus:border-qila-blue"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value)}
                      className="rounded-lg border border-qila-line bg-white px-3 py-2 text-sm"
                    >
                      {["ID", "SG", "US", "GB", "DE", "ES", "AF", "IR"].map((c) => (
                        <option key={c} value={c}>
                          Negara: {c}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="Wallet Tempo (opsional)"
                      className="rounded-lg border border-qila-line px-3 py-2 text-sm outline-none focus:border-qila-blue"
                    />
                  </div>
                  <p className="text-xs text-qila-muted">
                    Kosongkan wallet untuk membuat penerima internal (alamat treasury demo).
                  </p>
                  <div className="flex gap-2">
                    <QButton size="sm" onClick={addRecipient} disabled={busy}>
                      Simpan penerima
                    </QButton>
                    <QButton size="sm" variant="ghost" onClick={() => setAddingRecipient(false)}>
                      Batal
                    </QButton>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingRecipient(true)}
                  className="rounded-xl border border-dashed border-qila-blue/40 px-4 py-2.5 text-sm font-bold text-qila-blue hover:bg-qila-blue-soft/50"
                >
                  + Penerima baru
                </button>
              )}
            </div>
          </div>

          {/* quote preview */}
          {quote && (
            <div className="rounded-2xl border border-qila-blue/30 bg-qila-blue-soft/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-qila-ink">Kurs terkunci</span>
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-bold " +
                    (secondsLeft > 10 ? "bg-qila-good-soft text-qila-good" : "bg-qila-bad-soft text-qila-bad")
                  }
                >
                  {secondsLeft}s
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <Row k="Kurs (sudah termasuk spread)" v={`1 ${fromCcy} = ${formatNumber(quote.rate)} ${toCcy}`} />
                <Row k="Kurs mid-market" v={`1 ${fromCcy} = ${formatNumber(quote.midRate || 0)} ${toCcy}`} />
                <Row k="Spread" v={`${quote.spreadBps} bps`} />
                <Row k="Fee" v={`${formatUsdShort(quote.feeUsd)} (${quote.feeUsd})`} />
                <Row
                  k="Kamu kirim"
                  v={`${formatMoney(Number(quote.amountIn) / 1e6, fromCcy)}`}
                />
                <Row
                  k="Penerima dapat"
                  v={`${formatMoney(Number(quote.amountOut) / 1e6, toCcy)}`}
                  strong
                />
                <Row
                  k="Mode eksekusi (estimasi)"
                  v={quote.executionMode === "dex" ? "DEX Tempo" : quote.executionMode === "direct" ? "Transfer langsung" : "Treasury fallback"}
                />
                <Row k="Setara USD" v={formatUsdShort(quote.usdEquivalent)} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!quote ? (
              <QButton size="lg" onClick={createQuote} disabled={busy || !amount || !recipientId}>
                {busy ? "Memproses…" : "Buat quote & kunci kurs"}
              </QButton>
            ) : (
              <>
                <QButton
                  size="lg"
                  onClick={confirmAndSend}
                  disabled={busy || secondsLeft === 0}
                >
                  {busy ? "Mengecek compliance…" : "Konfirmasi & kirim"}
                </QButton>
                <QButton size="lg" variant="ghost" onClick={() => setQuote(null)}>
                  Ubah quote
                </QButton>
              </>
            )}
          </div>
        </section>
      )}

      {/* STEP 2: COMPLIANCE / STEP-UP */}
      {step === "compliance" && decision && (
        <ComplianceStep
          decision={decision}
          methods={methods}
          transfer={transfer}
          verification={verification}
          selectedMethod={selectedMethod}
          setSelectedMethod={setSelectedMethod}
          onSubmitVerification={submitVerification}
          onSimulate={simulate}
          onExecute={executeTransfer}
          busy={busy}
        />
      )}

      {/* STEP 3: RESULT */}
      {step === "result" && (
        <ResultStep
          transfer={transfer}
          execResult={execResult}
          decision={decision}
          onNewTransfer={resetWizard}
          onGoTransfers={() => (window.location.hash = "#transfers")}
        />
      )}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-dashed border-qila-line pb-1.5 last:border-0">
      <span className="text-qila-muted">{k}</span>
      <span className={strong ? "font-extrabold text-qila-blue-dark" : "font-bold text-qila-ink"}>
        {v}
      </span>
    </div>
  );
}

function ComplianceStep({
  decision,
  methods,
  transfer,
  verification,
  selectedMethod,
  setSelectedMethod,
  onSubmitVerification,
  onSimulate,
  onExecute,
  busy,
}: {
  decision: DecisionPayload;
  methods: { key: string; label: string }[];
  transfer: TransferRecord | null;
  verification: VerificationRecord | null;
  selectedMethod: string | null;
  setSelectedMethod: (m: string) => void;
  onSubmitVerification: () => void;
  onSimulate: (r: "approve" | "reject" | "needs_more_info") => void;
  onExecute: () => void;
  busy: boolean;
}) {
  if (decision.outcome === "STEP_UP") {
    return (
      <section className="space-y-4 rounded-3xl border border-qila-warn/30 bg-qila-warn-soft/60 p-6">
        <div className="flex items-center gap-2">
          <Pill className="bg-qila-warn text-white">STEP_UP</Pill>
          <span className="text-sm font-bold text-qila-warn">
            Verifikasi tambahan diperlukan untuk transfer ini
          </span>
        </div>

        {/* "Kenapa saya diminta verifikasi?" panel (spec 5.3) */}
        <div className="rounded-2xl bg-white p-5">
          <h3 className="text-lg font-extrabold text-qila-ink">Kenapa saya diminta verifikasi?</h3>
          <ul className="mt-3 space-y-2">
            {decision.labels.map((l) => (
              <li key={l.code} className="rounded-xl border border-qila-line p-3 text-sm">
                <code className="rounded bg-qila-blue-soft px-1.5 py-0.5 text-xs font-black text-qila-blue-dark">
                  {l.code}
                </code>
                <span className="ml-2 font-semibold text-qila-ink">{l.label}</span>
                <p className="mt-1 text-qila-muted">{l.hint}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-qila-muted">
            Target tier minimum: <strong>Tier {decision.targetTier}</strong> — setelah verifikasi
            lolos, transfer lanjut otomatis.
          </p>
        </div>

        {/* method choice */}
        {!verification && (
          <div className="rounded-2xl bg-white p-5">
            <h3 className="font-extrabold text-qila-ink">Pilih metode verifikasi</h3>
            <p className="mt-1 text-sm text-qila-muted">
              Semua metode di bawah memenuhi syarat Tier {decision.targetTier}.
            </p>
            <div className="mt-3 space-y-2">
              {methods.map((m) => (
                  <label
                    key={m.key}
                    className={
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition " +
                      (selectedMethod === m.key
                        ? "border-qila-blue bg-qila-blue-soft/60 font-bold"
                        : "border-qila-line bg-background")
                    }
                  >
                    <input
                      type="radio"
                      name="method"
                      checked={selectedMethod === m.key}
                      onChange={() => setSelectedMethod(m.key)}
                      className="accent-qila-blue"
                    />
                    {m.label}
                  </label>
                ))}
            </div>
            <QButton className="mt-4" onClick={onSubmitVerification} disabled={busy || !selectedMethod}>
              {busy ? "Mengirim…" : "Kirim verifikasi"}
            </QButton>
          </div>
        )}

        {/* provider simulation (DEMO_MODE) */}
        {verification && (
          <div className="rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-qila-ink">Status provider (MockKycProvider)</h3>
              <Pill
                className={
                  verification.status === "approved"
                    ? "bg-qila-good-soft text-qila-good"
                    : verification.status === "pending"
                      ? "bg-qila-warn-soft text-qila-warn"
                      : "bg-qila-bad-soft text-qila-bad"
                }
              >
                {verification.status}
              </Pill>
            </div>
            <p className="mt-1 text-sm text-qila-muted">
              Metode: <strong>{verification.method}</strong> · provider ref{" "}
              <code>{verification.providerRef}</code>
            </p>
            {verification.status === "pending" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <QButton size="sm" onClick={() => onSimulate("approve")}>
                  Simulate: Approve
                </QButton>
                <QButton size="sm" variant="outline" onClick={() => onSimulate("reject")}>
                  Simulate: Reject
                </QButton>
                <QButton size="sm" variant="outline" onClick={() => onSimulate("needs_more_info")}>
                  Simulate: Needs more info
                </QButton>
              </div>
            )}
            {verification.status === "approved" && (
              <p className="mt-3 rounded-xl bg-qila-good-soft p-3 text-sm font-bold text-qila-good">
                Verifikasi lolos — transfer otomatis dilanjutkan…
              </p>
            )}
            {(verification.status === "rejected" || verification.status === "needs_more_info") && (
              <p className="mt-3 rounded-xl bg-qila-bad-soft p-3 text-sm font-bold text-qila-bad">
                Verifikasi {verification.status === "rejected" ? "ditolak" : "butuh info tambahan"} —
                coba metode lain.
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  if (decision.outcome === "HOLD_REVIEW") {
    return (
      <section className="space-y-4 rounded-3xl border border-qila-warn/30 bg-qila-warn-soft/60 p-6">
        <div className="flex items-center gap-2">
          <Pill className="bg-qila-warn text-white">HOLD_REVIEW</Pill>
          <span className="text-sm font-bold text-qila-warn">
            Transfer masuk antrean review admin
          </span>
        </div>
        <div className="rounded-2xl bg-white p-5">
          <h3 className="text-lg font-extrabold text-qila-ink">Kenapa transfer saya di-hold?</h3>
          <ul className="mt-3 space-y-2">
            {decision.labels.map((l) => (
              <li key={l.code} className="rounded-xl border border-qila-line p-3 text-sm">
                <code className="rounded bg-qila-blue-soft px-1.5 py-0.5 text-xs font-black text-qila-blue-dark">
                  {l.code}
                </code>
                <span className="ml-2 font-semibold text-qila-ink">{l.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-qila-muted">
            Tim compliance akan mereview. Login sebagai <strong>admin</strong> (persona admin) untuk
            menyetujui atau menolak transfer ini di konsol Admin.
          </p>
        </div>
      </section>
    );
  }

  // BLOCK
  return (
    <section className="space-y-4 rounded-3xl border border-qila-bad/30 bg-qila-bad-soft/60 p-6">
      <div className="flex items-center gap-2">
        <Pill className="bg-qila-bad text-white">BLOCK</Pill>
        <span className="text-sm font-bold text-qila-bad">Transfer diblokir</span>
      </div>
      <div className="rounded-2xl bg-white p-5">
        <ul className="space-y-2">
          {decision.labels.map((l) => (
            <li key={l.code} className="rounded-xl border border-qila-line p-3 text-sm">
              <code className="rounded bg-qila-bad-soft px-1.5 py-0.5 text-xs font-black text-qila-bad">
                {l.code}
              </code>
              <span className="ml-2 font-semibold text-qila-ink">{l.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ResultStep({
  transfer,
  execResult,
  decision,
  onNewTransfer,
  onGoTransfers,
}: {
  transfer: TransferRecord | null;
  execResult: ExecutionPayload | null;
  decision: DecisionPayload | null;
  onNewTransfer: () => void;
  onGoTransfers: () => void;
}) {
  const status = transfer?.status || execResult?.status || "submitted";
  const settled = status === "settled";
  const explorerBase = "https://explore.testnet.tempo.xyz";
  const hashes = [
    execResult?.txHash && { label: "Tx transfer", hash: execResult.txHash },
    execResult?.submitTxHash && { label: "Tx debit pengirim", hash: execResult.submitTxHash },
    execResult?.swapTxHash && { label: "Tx swap", hash: execResult.swapTxHash },
    execResult?.outTxHash && { label: "Tx kredit penerima", hash: execResult.outTxHash },
    transfer?.txHash && !execResult && { label: "Tx transfer", hash: transfer.txHash },
    transfer?.submitTxHash && !execResult && { label: "Tx debit", hash: transfer.submitTxHash },
    transfer?.outTxHash && !execResult && { label: "Tx kredit", hash: transfer.outTxHash },
  ]
    .filter((h): h is { label: string; hash: string } => Boolean(h))
    .filter((h, i, arr) => arr.findIndex((x) => x.hash === h.hash) === i);

  return (
    <section className="space-y-4 rounded-3xl border border-qila-line bg-white p-6 shadow-[0_4px_14px_rgba(10,20,48,0.06)]">
      <div className="flex items-center gap-3">
        <span
          className={
            "flex h-12 w-12 items-center justify-center rounded-full text-2xl " +
            (settled ? "bg-qila-good-soft" : "bg-qila-warn-soft")
          }
        >
          {settled ? "✅" : "⏳"}
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-qila-ink">
            {settled
              ? "Transfer settled!"
              : TRANSFER_STATUS_LABELS[status] || "Transfer dalam proses"}
          </h2>
          {settled && execResult?.settlementSeconds != null && (
            <p className="text-sm font-bold text-qila-good">
              Settled in {execResult.settlementSeconds.toFixed(2)} detik
            </p>
          )}
        </div>
        <Pill className={TRANSFER_STATUS_TONES[status] || "bg-qila-blue-soft"}>
          {TRANSFER_STATUS_LABELS[status] || status}
        </Pill>
      </div>

      {transfer?.quote && (
        <div className="grid gap-2 rounded-2xl bg-background p-4 text-sm sm:grid-cols-2">
          <Row
            k="Jumlah"
            v={`${formatMoney(Number(transfer.quote.amountIn) / 1e6, transfer.quote.fromCcy)} → ${formatMoney(Number(transfer.quote.amountOut) / 1e6, transfer.quote.toCcy)}`}
          />
          <Row
            k="Mode eksekusi"
            v={
              (execResult?.executionMode || transfer.executionMode) === "dex"
                ? "DEX Tempo"
                : (execResult?.executionMode || transfer.executionMode) === "treasury"
                  ? "Treasury fallback"
                  : (execResult?.executionMode || transfer.executionMode) === "direct"
                    ? "Transfer langsung"
                    : "—"
            }
          />
          <Row k="Memo on-chain" v={transfer.memo || "—"} />
          <Row k="Transfer ID" v={transfer.id.slice(0, 12) + "…"} />
        </div>
      )}

      {hashes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-qila-ink">Transaksi on-chain:</p>
          {hashes.map((h) => (
            <a
              key={h.hash}
              href={`${explorerBase}/tx/${h.hash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-qila-line bg-background px-4 py-2.5 text-sm font-bold text-qila-blue hover:bg-qila-blue-soft/60"
            >
              <span>{h.label}</span>
              <span className="font-mono text-xs">{shortenHash(h.hash)} ↗</span>
            </a>
          ))}
        </div>
      )}

      {status === "pending_review" && (
        <p className="rounded-2xl bg-qila-warn-soft p-4 text-sm font-semibold text-qila-warn">
          Transfer menunggu persetujuan admin. Cek konsol Admin untuk approve/reject.
        </p>
      )}

      <div className="flex gap-3">
        <QButton onClick={onNewTransfer}>Kirim lagi</QButton>
        <QButton variant="ghost" onClick={onGoTransfers}>
          Lihat riwayat transfer
        </QButton>
      </div>
    </section>
  );
}
