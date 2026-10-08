"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill, QButton, Eyebrow } from "./primitives";
import { api, type TransferRecord } from "@/lib/qila/client";
import {
  formatMoney,
  formatDateTime,
  shortenHash,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_TONES,
} from "@/lib/qila/format";

const EXPLORER = "https://explore.testnet.tempo.xyz";

const EVENT_LABELS: Record<string, string> = {
  quoted: "Quote dibuat",
  compliance_check: "Decision engine menilai transfer",
  awaiting_verification: "Menunggu verifikasi step-up",
  pending_review: "Masuk antrean review admin",
  submitted: "Dikirim ke Tempo (on-chain)",
  settled: "Settled — dana sampai di penerima",
  failed: "Eksekusi gagal",
  blocked: "Diblokir",
};

export function TransfersView({ openId }: { openId?: string | null }) {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [selected, setSelected] = useState<TransferRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await api<{ transfers: TransferRecord[] }>("/api/transfer");
    if (res.ok) {
      setTransfers(res.data.transfers);
      if (openId) {
        const found = res.data.transfers.find((t) => t.id === openId);
        if (found) setSelected(found);
      }
    }
    setLoading(false);
  }, [openId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // polling "realtime"
    return () => clearInterval(t);
  }, [load]);

  async function openDetail(id: string) {
    const res = await api<{ transfer: TransferRecord }>(`/api/transfer/${id}`);
    if (res.ok) setSelected(res.data.transfer);
  }

  if (selected) {
    const t = selected;
    return (
      <div className="qila-container max-w-3xl space-y-6 py-8">
        <button
          onClick={() => setSelected(null)}
          className="text-sm font-bold text-qila-blue hover:underline"
        >
          ← Kembali ke daftar
        </button>
        <div className="rounded-3xl border border-qila-line bg-white p-6 shadow-[0_4px_14px_rgba(10,20,48,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Eyebrow tone="blue">Detail transfer</Eyebrow>
              <h1 className="mt-2 text-2xl font-extrabold text-qila-ink">
                {formatMoney(Number(t.quote?.amountIn || 0) / 1e6, t.quote?.fromCcy || "USD")} →{" "}
                {formatMoney(Number(t.quote?.amountOut || 0) / 1e6, t.quote?.toCcy || "USD")}
              </h1>
              <p className="text-sm text-qila-muted">
                Ke {t.recipient?.name} · {t.recipient?.country}
              </p>
            </div>
            <Pill className={TRANSFER_STATUS_TONES[t.status] || "bg-qila-blue-soft"}>
              {TRANSFER_STATUS_LABELS[t.status] || t.status}
            </Pill>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl bg-background p-4 text-sm sm:grid-cols-2">
            <Detail k="Transfer ID" v={t.id} />
            <Detail k="Memo on-chain" v={t.memo || "—"} />
            <Detail
              k="Mode eksekusi"
              v={
                t.executionMode === "dex"
                  ? "DEX Tempo"
                  : t.executionMode === "treasury"
                    ? "Treasury fallback"
                    : t.quote?.fromCcy === t.quote?.toCcy
                      ? "Transfer langsung"
                      : "—"
              }
            />
            <Detail
              k="Settlement"
              v={
                t.submittedAt && t.settledAt
                  ? `${((new Date(t.settledAt).getTime() - new Date(t.submittedAt).getTime()) / 1000).toFixed(2)} detik`
                  : "—"
              }
            />
            <Detail k="Kurs terkunci" v={t.quote ? `1 ${t.quote.fromCcy} = ${t.quote.rate} ${t.quote.toCcy}` : "—"} />
            <Detail k="Spread" v={t.quote ? `${t.quote.spreadBps} bps` : "—"} />
            <Detail k="Dibuat" v={formatDateTime(t.createdAt)} />
            <Detail
              k="Settled pada"
              v={t.settledAt ? formatDateTime(t.settledAt) : "—"}
            />
          </div>

          {[
            t.txHash && "Tx utama",
            t.submitTxHash && "Tx debit pengirim",
            t.swapTxHash && "Tx swap DEX",
            t.outTxHash && "Tx kredit penerima",
          ]
            .filter(Boolean)
            .map((label, i) => {
              const hash = [t.txHash, t.submitTxHash, t.swapTxHash, t.outTxHash].filter(Boolean)[i];
              return (
                <a
                  key={i}
                  href={`${EXPLORER}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex items-center justify-between rounded-xl border border-qila-line bg-background px-4 py-2.5 text-sm font-bold text-qila-blue hover:bg-qila-blue-soft/60"
                >
                  <span>{label}</span>
                  <span className="font-mono text-xs">{shortenHash(hash!)} ↗</span>
                </a>
              );
            })}

          {/* timeline */}
          <h3 className="mt-6 font-extrabold text-qila-ink">Timeline</h3>
          <ol className="mt-3 space-y-0">
            {(t.events || []).map((e, i) => (
              <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                <div className="flex flex-col items-center">
                  <span
                    className={
                      "mt-1 flex h-3 w-3 rounded-full " +
                      (["settled"].includes(e.status)
                        ? "bg-qila-good"
                        : ["failed", "blocked"].includes(e.status)
                          ? "bg-qila-bad"
                          : "bg-qila-blue")
                    }
                  />
                  {i < (t.events?.length || 0) - 1 && (
                    <span className="w-px flex-1 bg-qila-line" />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-sm font-bold text-qila-ink">
                    {EVENT_LABELS[e.status] || e.status}
                  </p>
                  <p className="text-xs text-qila-muted">{formatDateTime(e.createdAt)}</p>
                  {e.status === "settled" && e.detail && (
                    <p className="mt-1 text-xs font-bold text-qila-good">
                      Settlement:{" "}
                      {(() => {
                        try {
                          const d = JSON.parse(e.detail) as { settlementSeconds?: number };
                          return d.settlementSeconds != null
                            ? `${d.settlementSeconds.toFixed(2)} detik`
                            : "";
                        } catch {
                          return "";
                        }
                      })()}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="qila-container max-w-4xl space-y-6 py-8">
      <Eyebrow tone="blue">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Riwayat transfer
      </Eyebrow>
      <h1 className="text-3xl font-extrabold tracking-tight text-qila-ink">Semua transfer</h1>
      {loading ? (
        <p className="text-sm text-qila-muted">Memuat…</p>
      ) : transfers.length === 0 ? (
        <div className="rounded-3xl border border-qila-line bg-white p-10 text-center">
          <p className="text-qila-muted">Belum ada transfer.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-qila-line bg-white">
          <ul className="divide-y divide-qila-line">
            {transfers.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => openDetail(t.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-qila-blue-soft/40"
                >
                  <div>
                    <p className="font-bold text-qila-ink">
                      {formatMoney(Number(t.quote?.amountIn || 0) / 1e6, t.quote?.fromCcy || "USD")}{" "}
                      → {formatMoney(Number(t.quote?.amountOut || 0) / 1e6, t.quote?.toCcy || "USD")}
                    </p>
                    <p className="text-xs text-qila-muted">
                      {t.recipient?.name} · {formatDateTime(t.createdAt)}
                      {t.executionMode ? ` · ${t.executionMode === "dex" ? "DEX" : "Treasury"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.txHash && (
                      <span className="hidden font-mono text-xs text-qila-muted sm:inline">
                        {shortenHash(t.txHash)}
                      </span>
                    )}
                    <Pill className={TRANSFER_STATUS_TONES[t.status] || "bg-qila-blue-soft"}>
                      {TRANSFER_STATUS_LABELS[t.status] || t.status}
                    </Pill>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-dashed border-qila-line pb-1.5 last:border-0">
      <span className="text-qila-muted">{k}</span>
      <span className="text-right font-bold text-qila-ink">{v}</span>
    </div>
  );
}
