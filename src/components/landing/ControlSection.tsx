import { SectionHeading } from "@/components/brand/SectionHeading";
import { Eyebrow } from "@/components/brand/Eyebrow";

/** Checklist copy. Backend truth lives in docs, this is the promise. */
const GUARANTEES = [
  {
    title: "You hold the keys",
    description: "Connect your wallet. Funds leave only when you approve.",
  },
  {
    title: "QilaPay never sits on principal",
    description: "The router quotes and routes. It does not custody balances.",
  },
  {
    title: "Verifiable on-chain",
    description: "Every run has a transaction reference you can check independently.",
  },
] as const;

/**
 * Non-custodial section (id="control").
 * The single dark contrast block on the page for a premium/security feel.
 * Visual is CSS-only: wallet card plus key rows plus shield badge.
 */
export function ControlSection() {
  return (
    <section
      id="control"
      aria-labelledby="control-title"
      className="relative overflow-hidden bg-night py-16 sm:py-24"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="qila-dots-light absolute left-[6%] top-10 h-44 w-72 opacity-40" />
        <div className="absolute -bottom-40 -right-24 h-95 w-95 rounded-full bg-primary opacity-40 blur-3xl" />
      </div>

      <div className="qila-container relative grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow tone="sky">User-controlled funds</Eyebrow>
          <SectionHeading
            dark
            title="Your money, not ours."
            description="Most remittance apps take custody the moment you deposit. QilaPay inverts that. The money stays yours until the second it moves."
          />
          <ul className="mt-8 grid gap-4">
            {GUARANTEES.map((item, i) => (
              <li
                key={item.title}
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-deep">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-extrabold text-white">{item.title}</h3>
                  <p className="mt-0.5 text-white/65">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* CSS wallet visual */}
        <div className="relative mx-auto w-full max-w-105">
          <div className="rounded-[28px] border border-white/15 bg-white/[0.07] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/55">
                Your wallet
              </p>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-accent-deep">
                ● SELF-CUSTODY
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">
              $2,450.00
            </p>
            <p className="text-sm font-semibold text-white/55">
              0x7f…9Q2a · connected
            </p>

            <div className="mt-5 grid gap-2.5">
              {[
                { label: "Keys", value: "You hold them" },
                { label: "QilaPay balance", value: "$0.00 by design" },
                { label: "Next AutoTransfer run", value: "$500 to Amara, Nov 1" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-night-soft px-4 py-3 text-sm"
                >
                  <span className="min-w-0 font-semibold text-white/55">{row.label}</span>
                  <strong className="shrink-0 text-right text-white">{row.value}</strong>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg">
                ◈
              </span>
              <div className="text-sm">
                <p className="font-extrabold text-white">Approve per transfer</p>
                <p className="text-white/70">
                  Nothing moves without your signature.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute -top-6 right-2 rotate-6 rounded-2xl bg-surface px-4 py-2.5 text-sm font-extrabold text-ink shadow-xl sm:-right-4">
            🛡 Qila can&apos;t freeze this
          </div>
        </div>
      </div>
    </section>
  );
}
