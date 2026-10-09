import { Card } from "@/components/brand/Card";
import { SectionHeading } from "@/components/brand/SectionHeading";

/** Steps double as the anchor target for "See how it works". */
const STEPS = [
  {
    number: 1,
    title: "Enter amount",
    description: "Choose how much to send, one-time or monthly AutoTransfer.",
  },
  {
    number: 2,
    title: "See the real quote",
    description: "Fees, FX rate, and arrival time, locked before you approve.",
  },
  {
    number: 3,
    title: "Approve from your wallet",
    description: "Non-custodial: nothing moves without your signature.",
  },
  {
    number: 4,
    title: "Verify and track",
    description: "Recipient confirmed, each run tracked with its own reference.",
  },
] as const;

/**
 * How-it-works preview on the landing page.
 * Four steps now (AutoTransfer added). The full route
 * (/how-it-works) can reuse STEPS.
 */
export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="bg-[#eef3fb] py-16 sm:py-20"
    >
      <div className="qila-container">
        <SectionHeading
          eyebrow="How it works"
          title="Three minutes to set up. Zero remembering."
          description="Designed for non-crypto users. The router handles chain selection and quoting behind the scenes."
        />
        <div className="relative mt-10 grid gap-4 md:grid-cols-4">
          <div
            aria-hidden
            className="absolute left-[12%] right-[12%] top-12 hidden h-0.5 bg-primary/20 md:block"
          />
          {STEPS.map((step) => (
            <Card key={step.number} className="relative">
              <span className="relative z-10 mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-white shadow-[0_10px_24px_rgba(36,71,255,0.35)]">
                {step.number}
              </span>
              <h3 className="mb-2 text-lg font-extrabold tracking-tight">
                {step.title}
              </h3>
              <p className="m-0 text-muted">{step.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
