import type { Metadata } from "next";
import { DemoScreen } from "@/components/app/DemoScreen";

export const metadata: Metadata = {
  title: "Demo",
  description: "One click personas, scripted scenarios, and the 3 minute demo script.",
};

export default function DemoPage() {
  return <DemoScreen />;
}
