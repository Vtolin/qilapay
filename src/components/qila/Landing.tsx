"use client";

import { Eyebrow, QButton, SectionHeading } from "./primitives";

/** Trust stats shown under the hero CTAs. */
const HERO_POINTS = [
  { value: "~1,5 detik", label: "settlement on-chain (Tempo)" },
  { value: "5 mata uang", label: "USD · IDR · SGD · EUR · GBP" },
  { value: "Adaptif", label: "KYC naik hanya saat dibutuhkan" },
] as const;

const FEATURES = [
  {
    title: "Kurs transparan & terkunci",
    body: "Kurs mid-market dari data ECB + spread yang jujur. Kurs dikunci 60 detik dengan countdown — yang kamu lihat adalah yang kamu dapat.",
    tag: "Quote",
  },
  {
    title: "Settlement hitungan detik",
    body: "Dana diselesaikan di Tempo Testnet dengan TIP-20 stablecoin, memo on-chain untuk rekonsiliasi, dan link explorer untuk setiap transfer.",
    tag: "On-chain",
  },
  {
    title: "Verifikasi adaptif",
    body: "Transfer kecil langsung jalan tanpa layar KYC. Limit besar atau sinyal risiko memicu step-up verification — pendekatan ala Roblox, hanya saat dibutuhkan.",
    tag: "Adaptive KYC",
  },
  {
    title: "Banyak jalur verifikasi",
    body: "Selfie liveness, dokumen + face match, micro-deposit bank, bukti alamat, sumber dana, atau video call. Kamu pilih yang paling nyaman.",
    tag: "Choice",
  },
  {
    title: "Kustodial dengan prinsip aman",
    body: "Wallet dibuat otomatis saat sign-up. Kunci dienkripsi AES-256-GCM dan hanya diakses server — tidak pernah dikirim ke browser.",
    tag: "Custody",
  },
  {
    title: "Decision engine yang bisa dijelaskan",
    body: "Setiap keputusan punya reason code dalam bahasa manusia: kenapa diminta verifikasi, dan apa yang terbuka jika naik tier.",
    tag: "Explainable",
  },
] as const;

const HOW_STEPS = [
  {
    n: "01",
    title: "Quote",
    body: "Pilih mata uang asal & tujuan, nominal, dan penerima. Kurs, spread, fee, dan jumlah diterima tampil transparan.",
  },
  {
    n: "02",
    title: "Compliance adaptif",
    body: "Decision engine menilai limit tier, velocity, koridor, dan screening. Kebanyakan transfer kecil lolos tanpa friksi.",
  },
  {
    n: "03",
    title: "Eksekusi on-chain",
    body: "Debit wallet pengirim, swap via DEX atau treasury, lalu kirim ke penerima dengan memo QILA-<id>. Atomik dan tercatat.",
  },
  {
    n: "04",
    title: "Settled & terlihat",
    body: "Waktu settlement ditampilkan akurat, lengkap dengan tx hash yang bisa dibuka di explorer Tempo.",
  },
] as const;

/**
 * Landing page (pre-login). Ported from the qilapay boilerplate design
 * language, adapted to SPA navigation.
 */
export function Landing({
  onTryDemo,
  onLogin,
  onRegister,
}: {
  onTryDemo: () => void;
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden pb-14 pt-10 sm:pt-16" aria-labelledby="hero-title">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-qila-blue-soft blur-3xl" />
          <div className="absolute left-[-8%] top-40 h-[300px] w-[300px] rounded-full bg-qila-sky-soft blur-3xl" />
          <div className="qila-dots absolute right-[8%] top-10 hidden h-40 w-64 opacity-70 lg:block" />
        </div>

        <div className="qila-container grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Eyebrow tone="sky">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Remittance di Tempo Testnet · Demo
            </Eyebrow>
            <h1
              id="hero-title"
              className="mt-5 max-w-[640px] text-[2.7rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-qila-ink sm:text-6xl"
            >
              Kirim uang ke rumah.{" "}
              <span className="relative inline-block">
                <span className="relative z-10">Sesuai aturan,</span>
                <span
                  aria-hidden
                  className="absolute inset-x-[-4px] bottom-1 top-[55%] -z-0 rounded-md bg-qila-sky"
                />
              </span>{" "}
              tanpa drama.
            </h1>
            <p className="mt-5 max-w-[540px] text-lg text-qila-muted sm:text-xl">
              QilaPay menyelesaikan transfer lintas mata uang di Tempo Testnet dalam hitungan
              detik — dengan kurs yang transparan dan verifikasi identitas yang{" "}
              <strong className="font-semibold text-qila-ink">adaptif</strong>: naik hanya saat
              dibutuhkan.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <QButton size="lg" onClick={onTryDemo}>
                Try demo →
              </QButton>
              <QButton size="lg" variant="dark" onClick={onRegister}>
                Daftar akun
              </QButton>
              <QButton size="lg" variant="ghost" onClick={onLogin}>
                Masuk
              </QButton>
            </div>
            <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4 border-t border-qila-line pt-6">
              {HERO_POINTS.map((point) => (
                <div key={point.label}>
                  <dd className="text-[1.6rem] font-extrabold tracking-tight text-qila-ink">
                    {point.value}
                  </dd>
                  <dd className="max-w-[170px] text-sm font-semibold text-qila-muted">
                    {point.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* CSS-only preview card */}
          <div className="relative">
            <div className="qila-dots absolute -inset-6 -z-10 rounded-[36px] opacity-60" />
            <div className="rounded-[28px] border border-qila-line bg-white p-6 shadow-[0_18px_50px_rgba(10,20,48,0.12)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-qila-muted">
                  Transfer preview
                </span>
                <span className="rounded-full bg-qila-good-soft px-2.5 py-1 text-xs font-bold text-qila-good">
                  Settled 1,38s
                </span>
              </div>
              <div className="mt-4 rounded-2xl bg-qila-blue-soft/60 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-qila-ink">$ 200,00</span>
                  <span className="text-sm font-bold text-qila-muted">USD</span>
                </div>
                <div className="mt-1 flex items-center justify-center text-qila-blue">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-qila-ink">Rp 3.215.800</span>
                  <span className="text-sm font-bold text-qila-muted">IDR</span>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ["Kurs terkunci", "16.079,00"],
                  ["Spread", "0,75%"],
                  ["Fee", "$1,00"],
                  ["Memo", "QILA-8F3K2M"],
                  ["Mode eksekusi", "Treasury fallback"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-dashed border-qila-line pb-2 last:border-0">
                    <dt className="text-qila-muted">{k}</dt>
                    <dd className="font-bold text-qila-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16">
        <div className="qila-container">
          <SectionHeading
            eyebrow="Kenapa QilaPay"
            title="Semua yang diperlukan remittance modern"
            subtitle="Dari quote sampai settlement, semuanya terlihat, terukur, dan bisa dijelaskan — cocok untuk demo 3 menit maupun review teknis."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-qila-line bg-white p-6 shadow-[0_4px_14px_rgba(10,20,48,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(10,20,48,0.12)]"
              >
                <span className="inline-flex rounded-full bg-qila-blue-soft px-2.5 py-1 text-xs font-bold text-qila-blue-dark">
                  {f.tag}
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-qila-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-qila-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Adaptive KYC explainer (deep navy contrast section) */}
      <section className="bg-qila-night py-16 text-white">
        <div className="qila-container grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              dark
              eyebrow="Fitur pembeda"
              title="KYC adaptif: friksi hanya saat dibutuhkan"
              subtitle="Transfer kecil lolos begitu saja. Ketika limit atau sinyal risiko meminta perhatian, QilaPay menaikkan verifikasi seperlunya — dan selalu menjelaskan alasannya."
            />
            <div className="mt-8 space-y-4">
              {[
                ["Tier 0 — Basic", "Email + OTP. Kirim sampai $50 per transaksi, $150 per 30 hari."],
                ["Tier 1 — Verified", "+ selfie liveness. Sampai $500 per transaksi."],
                ["Tier 2 — Full KYC", "+ dokumen & face match. Sampai $5.000 per transaksi."],
                ["Tier 3 — Enhanced", "+ bukti alamat & sumber dana dengan review admin. Sampai $50.000."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl bg-qila-night-soft p-4">
                  <p className="font-extrabold">{t}</p>
                  <p className="text-sm text-white/70">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] bg-white p-6 text-qila-ink shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-qila-warn-soft px-2.5 py-1 text-xs font-bold text-qila-warn">
                STEP_UP
              </span>
              <span className="text-xs font-bold text-qila-muted">reason codes</span>
            </div>
            <p className="mt-4 text-lg font-extrabold">Kenapa saya diminta verifikasi?</p>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="rounded-xl border border-qila-line p-3">
                <strong className="font-bold text-qila-blue-dark">LIMIT_PER_TX</strong>
                <span className="text-qila-muted"> — jumlah transfer melebihi limit per transaksi tier kamu.</span>
              </li>
              <li className="rounded-xl border border-qila-line p-3">
                <strong className="font-bold text-qila-blue-dark">NEW_RECIPIENT_LARGE</strong>
                <span className="text-qila-muted"> — penerima baru dengan nominal yang relatif besar.</span>
              </li>
            </ul>
            <div className="mt-4 rounded-xl bg-qila-blue-soft/60 p-3 text-sm">
              Pilih salah satu jalur verifikasi: selfie liveness, micro-deposit bank, atau dokumen
              + face match. Setelah lolos, transfer lanjut otomatis.
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16">
        <div className="qila-container">
          <SectionHeading
            align="center"
            eyebrow="Alur transfer"
            title="Empat langkah, semuanya on-chain"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border border-qila-line bg-white p-6">
                <span className="text-3xl font-extrabold text-qila-sky">{s.n}</span>
                <h3 className="mt-3 font-extrabold text-qila-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-qila-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 pt-4">
        <div className="qila-container">
          <div className="qila-dots-light relative overflow-hidden rounded-[32px] bg-qila-blue p-10 text-center text-white sm:p-14">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Lihat sendiri dalam 3 menit</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">
              Persona siap pakai, skenario satu klik, reset data satu tombol. Testnet saja — uang
              tidak nyata, tapi semuanya on-chain sungguhan.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <QButton size="lg" onClick={onTryDemo} className="bg-white text-qila-blue hover:bg-white/90">
                Mulai demo sebagai Sari →
              </QButton>
              <QButton size="lg" variant="dark" onClick={onLogin}>
                Masuk dengan akun sendiri
              </QButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
