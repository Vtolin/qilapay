import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ControlSection } from "@/components/landing/ControlSection";
import { AutomationSection } from "@/components/landing/AutomationSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingGuard } from "@/components/app/LandingGuard";

export const metadata: Metadata = {
  title: `${SITE.name} — International Remittance`,
  description: SITE.description,
};

/**
 * Pre-login landing page ("/").
 * Order tells the story: hook, why, control, AutoTransfer, steps, CTA.
 * Each section is isolated so the team can edit copy and layout independently.
 */
export default function LandingPage() {
  return (
    <>
      <LandingGuard />
      <HeroSection />
      <FeaturesSection />
      <ControlSection />
      <AutomationSection />
      <HowItWorksSection />
      <CtaSection />
    </>
  );
}
