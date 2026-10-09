import { Card } from "@/components/brand/Card";
import { SectionHeading } from "@/components/brand/SectionHeading";

/**
 * Bento feature grid. Varied card sizes and tones keep the page
 * from reading as identical boxes. Edit FEATURES only.
 */
const FEATURES = [
  {
    title: "Lower fees, shown upfront",
    description:
      "Blockchain routing skips correspondent-bank markups. The quote breaks down network + service fee before you commit.",
    tone: "blue" as const,
    span: "md:col-span-2",
    icon: "◈",
  },
  {
    title: "Non-custodial by default",
    description:
      "Your funds stay in your wallet until the moment of transfer. QilaPay can't freeze or lend them.",
    tone: "dark" as const,
    span: "",
    icon: "⬢",
  },
  {
    title: "AutoTransfer schedules",
    description:
      "Set a recurring transfer once, for example $500 a month to family. QilaPay sends each cycle. Pause or cancel anytime.",
    tone: "accent" as const,
    span: "",
    icon: "↻",
  },
  {
    title: "Transparent tracking",
    description:
      "Fees, FX rate, and status from quote to confirmed. One reference per transfer.",
    tone: "light" as const,
    span: "",
    icon: "◎",
  },
  {
    title: "Built for regular users",
    description:
      "No seed-phrase popups mid-flow. Just send, verify, and track. Crypto stays under the hood.",
    tone: "light" as const,
    span: "md:col-span-2",
    icon: "✦",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-title" className="py-16 sm:py-20">
      <div className="qila-container">
        <SectionHeading
          eyebrow="Why QilaPay"
          title="Serious rails. Simple enough for family."
          description="Everything a first-time sender needs: lower cost, honest quotes, plus two things banks rarely offer, self-custody and AutoTransfer."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} tone={feature.tone} className={feature.span}>
              <span
                aria-hidden
                className={[
                  "mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-xl font-bold",
                  feature.tone === "light"
                    ? "bg-primary-soft text-primary-dark"
                    : "bg-white/15",
                ].join(" ")}
              >
                {feature.icon}
              </span>
              <h3 className="mb-2 text-xl font-extrabold tracking-tight">
                {feature.title}
              </h3>
              <p
                className={`m-0 leading-relaxed ${
                  feature.tone === "light"
                    ? "text-muted"
                    : feature.tone === "accent"
                      ? "text-accent-deep/80 font-medium"
                      : "text-white/75"
                }`}
              >
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
