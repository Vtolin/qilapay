import { ROUTES, SITE } from "@/lib/site";
import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { TryDemoButton } from "@/components/auth/TryDemoButton";
import { TransferPreviewCard } from "./TransferPreviewCard";

/** Trust stats shown under the hero CTAs. Keep labels short. */
const TRUST_POINTS = [
  { value: "$9.20", label: "fee on a $1,000 transfer" },
  { value: "5–15 min", label: "typical arrival time" },
  { value: "0", label: "custody: you hold funds" },
] as const;

/**
 * First screen visitors see (pre-login).
 * Bold headline + CSS-only visual. No images needed for the demo.
 * Try demo signs in as the Sari persona and lands on the dashboard.
 */
export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden pb-14 pt-14 sm:pt-20"
      aria-labelledby="hero-title"
    >
      {/* Backdrop: soft blobs + dot grid, no images */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -top-32 right-[-10%] h-105 w-105 rounded-full bg-primary-soft blur-3xl" />
        <div className="absolute left-[-8%] top-40 h-75 w-75 rounded-full bg-accent-soft blur-3xl" />
        <div className="qila-dots absolute right-[8%] top-10 hidden h-40 w-64 opacity-70 lg:block" />
      </div>

      <div className="qila-container grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Eyebrow tone="sky">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Non-custodial remittance router
          </Eyebrow>
          <h1
            id="hero-title"
            className="max-w-155 text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-7xl"
          >
            Send money home.{" "}
            <span className="relative inline-block">
              <span className="relative z-10">Keep control</span>
              <span
                aria-hidden
                className="absolute -inset-x-1 bottom-1 top-[55%] z-0 rounded-md bg-accent"
              />
            </span>{" "}
            of it.
          </h1>
          <p className="mt-5 max-w-135 text-lg text-muted sm:text-xl">
            {SITE.description} Set an AutoTransfer for family (for example,
            $500 a month), and QilaPay routes it while you keep full custody
            of your money.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button href={ROUTES.signup} size="lg">
              Get started →
            </Button>
            <TryDemoButton size="lg" />
            <Button href={ROUTES.automation} variant="dark" size="lg">
              See AutoTransfer
            </Button>
          </div>

          <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6">
            {TRUST_POINTS.map((point) => (
              <div key={point.label}>
                <dt className="sr-only">{point.label}</dt>
                <dd className="text-[1.7rem] font-extrabold tracking-tight">
                  {point.value}
                </dd>
                <dd className="max-w-35 text-sm font-semibold text-muted">
                  {point.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <TransferPreviewCard />
      </div>
    </section>
  );
}
