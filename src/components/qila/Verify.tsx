"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill, QButton, Eyebrow } from "./primitives";
import { api, type SessionData, type VerificationRecord } from "@/lib/qila/client";
import { formatDateTime, TIER_LABELS } from "@/lib/qila/format";

const METHOD_LIST = [
  { key: "selfie_liveness", label: "Selfie liveness", desc: "Deteksi hidup via kamera (simulasi)" },
  { key: "age_estimation", label: "Estimasi usia", desc: "Estimasi usia dari selfie (simulasi)" },
  { key: "id_face_match", label: "Dokumen identitas + face match", desc: "KTP/Paspor + selfie cocok (simulasi)" },
  { key: "bank_micro_deposit", label: "Micro-deposit rekening bank", desc: "Verifikasi kepemilikan rekening (simulasi)" },
  { key: "proof_of_address", label: "Bukti alamat", desc: "Tagihan/retret resmi (simulasi)" },
  { key: "source_of_funds", label: "Surat sumber dana", desc: "Dokumen sumber dana (simulasi)" },
  { key: "video_call", label: "Video call reviewer", desc: "Sesi verifikasi live (simulasi, review admin)" },
];

const STATUS_TONES: Record<string, string> = {
  pending: "bg-qila-warn-soft text-qila-warn",
  approved: "bg-qila-good-soft text-qila-good",
  rejected: "bg-qila-bad-soft text-qila-bad",
  needs_more_info: "bg-qila-sky-soft text-qila-sky-deep",
};

export function VerifyView({
  session,
  refresh,
}: {
  session: SessionData;
  refresh: () => Promise<void>;
}) {
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tiers = session.tiers || [];
  const userTier = session.user?.currentTier ?? 0;
  const nextTier = tiers.find((t) => t.tier === userTier + 1);

  const load = useCallback(async () => {
    const res = await api<{ verifications: VerificationRecord[] }>("/api/verify");
    if (res.ok) setVerifications(res.data.verifications);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(method: string) {
    setBusy(true);
    const targetTier = nextTier?.tier ?? userTier + 1;
    await api("/api/verify", { body: { method, targetTier } });
    await load();
    await refresh();
    setBusy(false);
  }

  async function simulate(id: string, result: "approve" | "reject" | "needs_more_info") {
    setBusy(true);
    await api(`/api/verify/${id}/simulate`, { body: { result } });
    await load();
    await refresh();
    setBusy(false);
  }

  return (
    <div className="qila-container max-w-4xl space-y-6 py-8">
      <div>
        <Eyebrow tone="blue">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Pusat verifikasi
        </Eyebrow>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-qila-ink">
          Naikkan limit dengan verifikasi
        </h1>
        <p className="mt-2 max-w-2xl text-qila-muted">
          Kamu ada di <strong>Tier {userTier} ({TIER_LABELS[userTier]})</strong>. Pilih jalur
          verifikasi untuk naik tier — semua provider disimulasikan di mode demo.
        </p>
      </div>

      {/* tier ladder */}
      <div className="grid gap-3 sm:grid-cols-4">
        {tiers.map((t) => (
          <div
            key={t.tier}
            className={
              "rounded-2xl border p-4 " +
              (t.tier === userTier
                ? "border-qila-blue bg-qila-blue-soft/50"
                : t.tier < userTier
                  ? "border-qila-good/30 bg-qila-good-soft/40"
                  : "border-qila-line bg-white")
            }
          >
            <p className="text-xs font-black uppercase tracking-widest text-qila-muted">
              Tier {t.tier}
            </p>
            <p className="text-lg font-extrabold text-qila-ink">{t.name}</p>
            <p className="mt-1 text-sm font-bold text-qila-blue-dark">
              ${t.perTxLimitUsd.toLocaleString()} / tx
            </p>
            <p className="text-xs text-qila-muted">
              ${t.rolling30dLimitUsd.toLocaleString()} per 30 hari
            </p>
            <p className="mt-2 text-xs text-qila-muted">{t.description}</p>
          </div>
        ))}
      </div>

      {/* methods */}
      {nextTier && (
        <section className="rounded-3xl border border-qila-line bg-white p-6">
          <h2 className="text-lg font-extrabold text-qila-ink">
            Metode untuk Tier {nextTier.tier} ({nextTier.name})
          </h2>
          <p className="mt-1 text-sm text-qila-muted">
            {nextTier.description} — pilih salah satu metode di bawah.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(() => {
              let methods: string[] = [];
              try {
                methods = JSON.parse(nextTier.requiredMethods || "[]");
              } catch {}
              return METHOD_LIST.filter((m) => methods.includes(m.key)).map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-qila-line bg-background p-4"
                >
                  <div>
                    <p className="font-bold text-qila-ink">{m.label}</p>
                    <p className="text-xs text-qila-muted">{m.desc}</p>
                  </div>
                  <QButton size="sm" onClick={() => submit(m.key)} disabled={busy}>
                    Mulai
                  </QButton>
                </div>
              ));
            })()}
          </div>
        </section>
      )}

      {/* history */}
      <section className="rounded-3xl border border-qila-line bg-white p-6">
        <h2 className="text-lg font-extrabold text-qila-ink">Riwayat verifikasi</h2>
        {verifications.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-background p-6 text-center text-sm text-qila-muted">
            Belum ada verifikasi. Transfer kecil tidak butuh verifikasi apa pun — inilah inti KYC
            adaptif.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {verifications.map((v) => {
              const method = METHOD_LIST.find((m) => m.key === v.method);
              return (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-qila-line bg-background px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-bold text-qila-ink">
                      {method?.label || v.method} → Tier {v.targetTier}
                    </p>
                    <p className="text-xs text-qila-muted">
                      {formatDateTime(v.createdAt)}
                      {v.reviewedBy ? ` · oleh ${v.reviewedBy}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill className={STATUS_TONES[v.status] || "bg-qila-blue-soft"}>
                      {v.status}
                    </Pill>
                    {v.status === "pending" && (
                      <div className="flex gap-1">
                        <QButton size="sm" onClick={() => simulate(v.id, "approve")} disabled={busy}>
                          ✓ Approve
                        </QButton>
                        <QButton size="sm" variant="outline" onClick={() => simulate(v.id, "reject")} disabled={busy}>
                          ✕
                        </QButton>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
