import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "QilaPay, International Remittance",
    template: "%s · QilaPay",
  },
  description:
    "Send money across currencies with settlement in seconds on Tempo Testnet, transparent rates, and adaptive KYC that steps up only when needed.",
  keywords: ["QilaPay", "Tempo", "stablecoin", "remittance", "TIP-20", "adaptive KYC"],
};

/**
 * Root layout. The capsule header is fixed and floating (see SiteHeader).
 * Main carries top padding for the fixed header. Header and footer are
 * session-aware and render on every route, including /login and /register.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1 pt-[92px] sm:pt-[104px]">{children}</main>
          <SiteFooter />
        </div>
        <Toaster />
      </body>
    </html>
  );
}
