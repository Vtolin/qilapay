"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { QButton, Eyebrow } from "./primitives";
import { api, type SessionData } from "@/lib/qila/client";
import { TIER_LABELS } from "@/lib/qila/format";

export type View =
  | "landing"
  | "auth"
  | "dashboard"
  | "send"
  | "transfers"
  | "verify"
  | "recipients"
  | "admin"
  | "demo";

/** Fixed testnet banner — shown on every screen (spec: banner Testnet Demo). */
export function TestnetBanner() {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-qila-night px-4 py-2 text-center text-xs font-bold text-qila-sky sm:text-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-qila-sky opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-qila-sky" />
      </span>
      TESTNET DEMO — Tempo Moderato (chain 42431) · Uang tidak nyata · KYC disimulasikan
    </div>
  );
}

const NAV_ITEMS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "send", label: "Kirim" },
  { key: "transfers", label: "Transfers" },
  { key: "verify", label: "Verifikasi" },
  { key: "recipients", label: "Penerima" },
];

/** Auth view: login / register + demo persona shortcuts. */
export function AuthView({
  mode,
  onDone,
  onBack,
}: {
  mode: "login" | "register";
  onDone: (session: SessionData) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"login" | "register">(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("ID");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api("/api/auth", {
      body: { action: tab, email, password, fullName, country },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const session = await api<SessionData>("/api/session");
    if (session.ok) onDone(session.data);
  }

  return (
    <div className="qila-container grid max-w-5xl gap-8 py-12 lg:grid-cols-[1fr_380px]">
      <div className="hidden lg:block">
        <Eyebrow tone="blue">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Akun QilaPay
        </Eyebrow>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-qila-ink">
          {tab === "login" ? "Selamat datang kembali" : "Buat akun baru"}
        </h1>
        <p className="mt-3 max-w-md text-lg text-qila-muted">
          Akun baru otomatis mendapat wallet kustodial di Tempo Testnet yang didanai faucet —
          langsung bisa dicoba tanpa setup.
        </p>
        <div className="mt-8 rounded-3xl border border-qila-line bg-white p-6">
          <p className="text-sm font-bold uppercase tracking-widest text-qila-muted">Atau cepat:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["sari", "budi", "dewi", "admin"].map((p) => (
              <QButton
                key={p}
                variant="outline"
                size="sm"
                onClick={async () => {
                  setBusy(true);
                  const res = await api("/api/auth", { body: { action: "persona", persona: p } });
                  setBusy(false);
                  if (res.ok) {
                    const session = await api<SessionData>("/api/session");
                    if (session.ok) onDone(session.data);
                  } else setError(res.error);
                }}
              >
                Masuk sebagai {p}
              </QButton>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-qila-line bg-white p-6 shadow-[0_4px_14px_rgba(10,20,48,0.06)]">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-qila-blue-soft/70 p-1">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full py-2 text-sm font-bold transition",
                tab === t ? "bg-white text-qila-ink shadow-sm" : "text-qila-muted",
              )}
            >
              {t === "login" ? "Masuk" : "Daftar"}
            </button>
          ))}
        </div>
        {tab === "register" && (
          <>
            <label className="mb-1 block text-sm font-bold text-qila-ink">Nama lengkap</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mb-3 w-full rounded-xl border border-qila-line px-3 py-2.5 text-sm outline-none focus:border-qila-blue"
              placeholder="Nama kamu"
            />
            <label className="mb-1 block text-sm font-bold text-qila-ink">Negara</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mb-3 w-full rounded-xl border border-qila-line bg-white px-3 py-2.5 text-sm outline-none focus:border-qila-blue"
            >
              <option value="ID">Indonesia</option>
              <option value="SG">Singapore</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="DE">Germany</option>
            </select>
          </>
        )}
        <label className="mb-1 block text-sm font-bold text-qila-ink">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-xl border border-qila-line px-3 py-2.5 text-sm outline-none focus:border-qila-blue"
          placeholder="kamu@email.com"
        />
        <label className="mb-1 block text-sm font-bold text-qila-ink">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-xl border border-qila-line px-3 py-2.5 text-sm outline-none focus:border-qila-blue"
          placeholder={tab === "register" ? "Minimal 8 karakter" : "••••••••"}
        />
        {error && (
          <p className="mb-3 rounded-xl bg-qila-bad-soft px-3 py-2 text-sm font-semibold text-qila-bad">
            {error}
          </p>
        )}
        <QButton className="w-full" onClick={submit} disabled={busy}>
          {busy ? "Memproses…" : tab === "login" ? "Masuk" : "Daftar & buat wallet"}
        </QButton>
        <p className="mt-3 text-center text-xs text-qila-muted">
          Demo persona: sari / budi / dewi / admin — password apa pun tidak berlaku untuk persona.
        </p>
      </div>
    </div>
  );
}

/** Top navigation for signed-in users + view switch. */
export function AppNav({
  view,
  setView,
  session,
  onLogout,
  onDemo,
}: {
  view: View;
  setView: (v: View) => void;
  session: SessionData;
  onLogout: () => void;
  onDemo: () => void;
}) {
  const isAdmin = session.user?.role === "admin";
  return (
    <header className="sticky top-[36px] z-40 border-b border-qila-line bg-white/90 backdrop-blur">
      <div className="qila-container flex h-14 items-center justify-between gap-3">
        <button onClick={() => setView("dashboard")} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-qila-blue text-sm font-black text-white">
            Q
          </span>
          <span className="text-lg font-black tracking-tight text-qila-ink">QilaPay</span>
          {session.user && (
            <span className="ml-1 hidden rounded-full bg-qila-blue-soft px-2 py-0.5 text-[11px] font-bold text-qila-blue-dark sm:inline">
              Tier {session.user.currentTier} · {TIER_LABELS[session.user.currentTier] || "?"}
            </span>
          )}
        </button>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-bold transition",
                view === item.key
                  ? "bg-qila-blue-soft text-qila-blue-dark"
                  : "text-qila-muted hover:bg-qila-blue-soft/60 hover:text-qila-ink",
              )}
            >
              {item.label}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setView("admin")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-bold transition",
                view === "admin"
                  ? "bg-qila-night text-white"
                  : "text-qila-night hover:bg-qila-night-soft hover:text-white",
              )}
            >
              Admin
            </button>
          )}
          <button
            onClick={onDemo}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-bold transition",
              view === "demo"
                ? "bg-qila-blue text-white"
                : "bg-qila-blue-soft text-qila-blue-dark hover:bg-qila-blue hover:text-white",
            )}
          >
            Demo
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[160px] truncate text-sm font-bold text-qila-muted lg:block">
            {session.user?.fullName}
          </span>
          <QButton variant="ghost" size="sm" onClick={onLogout}>
            Keluar
          </QButton>
        </div>
      </div>
      {/* mobile nav */}
      <div className="qila-scroll flex gap-1 overflow-x-auto border-t border-qila-line px-4 py-2 md:hidden">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold",
              view === item.key ? "bg-qila-blue-soft text-qila-blue-dark" : "text-qila-muted",
            )}
          >
            {item.label}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => setView("admin")}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold text-qila-night"
          >
            Admin
          </button>
        )}
        <button
          onClick={onDemo}
          className="whitespace-nowrap rounded-full bg-qila-blue-soft px-3 py-1.5 text-xs font-bold text-qila-blue-dark"
        >
          Demo
        </button>
      </div>
    </header>
  );
}
