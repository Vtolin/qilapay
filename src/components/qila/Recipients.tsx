"use client";

import { useCallback, useEffect, useState } from "react";
import { QButton, Eyebrow } from "./primitives";
import { api, type RecipientRecord } from "@/lib/qila/client";
import { formatDateTime, shortenAddress } from "@/lib/qila/format";

export function RecipientsView() {
  const [recipients, setRecipients] = useState<RecipientRecord[]>([]);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("ID");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"linked" | "external">("linked");

  const load = useCallback(async () => {
    const res = await api<{ recipients: RecipientRecord[] }>("/api/recipients");
    if (res.ok) setRecipients(res.data.recipients);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await api("/api/recipients", {
      body:
        mode === "linked"
          ? { name, country, linkedEmail: email }
          : { name, country, walletAddress: address },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName("");
    setEmail("");
    setAddress("");
    load();
  }

  return (
    <div className="qila-container max-w-4xl space-y-6 py-8">
      <div>
        <Eyebrow tone="blue">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Penerima
        </Eyebrow>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-qila-ink">
          Daftar penerima
        </h1>
        <p className="mt-2 text-qila-muted">
          Penerima bisa berupa user QilaPay lain (cari lewat email) atau wallet eksternal Tempo.
        </p>
      </div>

      <section className="rounded-3xl border border-qila-line bg-white p-6">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-qila-blue-soft/70 p-1 sm:max-w-sm">
          {(["linked", "external"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                "rounded-full py-2 text-sm font-bold transition " +
                (mode === m ? "bg-white text-qila-ink shadow-sm" : "text-qila-muted")
              }
            >
              {m === "linked" ? "User QilaPay" : "Wallet eksternal"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama penerima"
            className="rounded-xl border border-qila-line px-3 py-2.5 text-sm outline-none focus:border-qila-blue"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-xl border border-qila-line bg-white px-3 py-2.5 text-sm outline-none focus:border-qila-blue"
          >
            {["ID", "SG", "US", "GB", "DE", "ES", "AF", "IR", "MM", "SY"].map((c) => (
              <option key={c} value={c}>
                Negara: {c}
              </option>
            ))}
          </select>
          {mode === "linked" ? (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email user QilaPay (mis. budi@qilapay.demo)"
              className="rounded-xl border border-qila-line px-3 py-2.5 text-sm outline-none focus:border-qila-blue sm:col-span-2"
            />
          ) : (
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… alamat wallet Tempo"
              className="rounded-xl border border-qila-line px-3 py-2.5 font-mono text-sm outline-none focus:border-qila-blue sm:col-span-2"
            />
          )}
        </div>
        {error && (
          <p className="mt-3 rounded-xl bg-qila-bad-soft px-3 py-2 text-sm font-semibold text-qila-bad">
            {error}
          </p>
        )}
        <QButton className="mt-4" onClick={add} disabled={busy || !name}>
          {busy ? "Menyimpan…" : "Tambah penerima"}
        </QButton>
      </section>

      <section className="overflow-hidden rounded-3xl border border-qila-line bg-white">
        <ul className="divide-y divide-qila-line">
          {recipients.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div>
                <p className="font-bold text-qila-ink">{r.name}</p>
                <p className="text-xs text-qila-muted">
                  {r.country} · {shortenAddress(r.walletAddress || "")} · ditambahkan{" "}
                  {formatDateTime(r.createdAt)}
                </p>
              </div>
              {r.linkedUserId && (
                <span className="rounded-full bg-qila-good-soft px-2.5 py-1 text-xs font-bold text-qila-good">
                  user QilaPay
                </span>
              )}
            </li>
          ))}
          {recipients.length === 0 && (
            <li className="p-10 text-center text-sm text-qila-muted">Belum ada penerima.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
