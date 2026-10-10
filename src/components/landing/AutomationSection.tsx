import { ROUTES } from "@/lib/site";
import { Button } from "@/components/brand/Button";
import { SectionHeading } from "@/components/brand/SectionHeading";
import { Eyebrow } from "@/components/brand/Eyebrow";

/** Example schedule. Amounts below are one example. Any amount works. */
const SCHEDULE = [
  { month: "Aug", detail: "$500 to Amara for tuition", state: "sent" },
  { month: "Sep", detail: "$500 to Amara for tuition", state: "sent" },
  { month: "Oct", detail: "$500 to Amara for tuition", state: "sent" },
  { month: "Nov", detail: "$500 to Amara, scheduled", state: "next" },
] as const;

/**
 * AutoTransfer section (id="automation").
 * Sells recurring transfers with one concrete story plus a CSS schedule card.
 * Later: "Create schedule" opens POST /api/schedules (amount, cadence, recipient).
 */
export function AutomationSection() {
  return (
    <section
      id="automation"
      aria-labelledby="automation-title"
      className="relative overflow-hidden py-16 sm:py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-0 h-70 w-180 -translate-x-1/2 rounded-full bg-accent-soft blur-3xl" />
      </div>

      <div className="qila-container grid items-center gap-12 lg:grid-cols-2">
        {/* Schedule card first on mobile for story impact */}
        <div className="relative order-1 mx-auto w-full max-w-110 lg:order-0">
          <div className="rounded-[28px] border border-line bg-surface p-6 shadow-[0_18px_50px_rgba(10,20,48,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                  AutoTransfer schedule
                </p>
                <h3 className="mt-1 text-xl font-extrabold tracking-tight">
                  $500/mo to Amara
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-muted">
                  Example amount. You can set any amount.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-night px-3.5 py-1.5 text-xs font-extrabold text-white">
                <span className="h-2 w-2 rounded-full bg-accent" />
                ON
              </span>
            </div>

            <div className="mt-5 grid gap-0">
              {SCHEDULE.map((run, i) => (
                <div key={run.month} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold",
                        run.state === "next"
                          ? "bg-accent text-accent-deep"
                          : "bg-emerald-100 text-emerald-700",
                      ].join(" ")}
                    >
                      {run.state === "next" ? "→" : "✓"}
                    </span>
                    {i < SCHEDULE.length - 1 ? (
                      <span className="w-0.5 flex-1 bg-line" aria-hidden />
                    ) : null}
                  </div>
                  <div className="pb-5">
                    <p className="font-extrabold">
                      {run.month}{" "}
                      <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-xs font-bold text-muted">
                        {run.state === "next" ? "SCHEDULED" : "SENT"}
                      </span>
                    </p>
                    <p className="text-sm text-muted">{run.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-muted">
              <span>Pause or cancel anytime</span>
              <span className="font-extrabold text-ink">You approve each run</span>
            </div>
          </div>

          <div className="absolute left-2 top-8 -rotate-6 rounded-2xl bg-primary px-4 py-2.5 text-sm font-extrabold text-white shadow-xl sm:-left-4">
            Set once, sent monthly
          </div>
        </div>

        <div className="order-2 lg:order-0">
          <Eyebrow tone="blue">AutoTransfer: set and forget</Eyebrow>
          <SectionHeading
            title="College support, on AutoTransfer."
            description="Your daughter's college is far away, so your support should not depend on remembering. Set an AutoTransfer once, for example $500 every month, and QilaPay routes each transfer with a fresh transparent quote."
          />
          <ol className="mt-8 grid gap-4">
            {[
              {
                n: "1",
                t: "Set recipient, amount, date",
                d: "Amara, your amount, the 1st of every month. Pick bank, cash, or mobile payout.",
              },
              {
                n: "2",
                t: "Each run gets its own quote",
                d: "Fees and FX are locked per transfer, so she always gets the shown amount.",
              },
              {
                n: "3",
                t: "Track every cycle",
                d: "Sent, confirmed, received, per month, with its own reference. Skip or stop in one tap.",
              },
            ].map((step) => (
              <li
                key={step.n}
                className="flex gap-4 rounded-2xl border border-line bg-surface p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-white">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-extrabold">{step.t}</h3>
                  <p className="mt-0.5 text-muted">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href={ROUTES.signup} size="lg">
              Create a schedule →
            </Button>
            <Button href={ROUTES.howItWorks} variant="secondary" size="lg">
              How quotes work
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
