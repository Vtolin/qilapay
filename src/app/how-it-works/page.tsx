import type { Metadata } from "next";
import { ROUTES } from "@/lib/site";
import { Button } from "@/components/brand/Button";
import { Card } from "@/components/brand/Card";
import { SectionHeading } from "@/components/brand/SectionHeading";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How QilaPay routes remittances: quote, approve from your wallet, AutoTransfer or one-time, track to confirmed.",
};

/** Expanded steps. Includes non-custodial approval plus AutoTransfer. */
const STEPS = [
  {
    number: 1,
    title: "Enter amount and destination",
    description:
      "Choose how much to send, the source currency, and who receives it. Pick a one-time transfer or a monthly AutoTransfer, for example $500 to family.",
  },
  {
    number: 2,
    title: "Review the real quote",
    description:
      "Network fee, service fee, FX rate, and arrival estimate are shown upfront. The price you see is the price they get.",
  },
  {
    number: 3,
    title: "Approve from your wallet",
    description:
      "Non-custodial by design: funds leave only when you sign. QilaPay never holds your principal.",
  },
  {
    number: 4,
    title: "Verify and track",
    description:
      "Double-check recipient and payout method, then follow each run to confirmed with its own reference. Pause AutoTransfer anytime.",
  },
] as const;

/**
 * Standalone route for direct links plus future SEO.
 * The landing anchor (#how-it-works) stays as the quick preview.
 */
export default function HowItWorksPage() {
  return (
    <section className="py-12" aria-labelledby="how-title">
      <div className="qila-container">
        <SectionHeading
          eyebrow="How it works"
          title="Sending money with QilaPay"
          description="Four transparent steps. The remittance router handles chain selection and quoting behind the scenes."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {STEPS.map((step) => (
            <Card key={step.number}>
              <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-white">
                {step.number}
              </span>
              <h2 className="mb-2 text-lg font-extrabold tracking-tight">
                {step.title}
              </h2>
              <p className="m-0 text-muted">{step.description}</p>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button href={ROUTES.signup} size="lg">
            Get started →
          </Button>
          <Button href={ROUTES.home} variant="secondary" size="lg">
            Back to home
          </Button>
        </div>
      </div>
    </section>
  );
}
