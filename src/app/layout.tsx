import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
    default: "QilaPay — Remittance adaptif di Tempo Testnet",
    template: "%s · QilaPay",
  },
  description:
    "Kirim uang lintas mata uang dengan settlement hitungan detik di Tempo Testnet (Moderato), kurs transparan, dan KYC adaptif yang naik hanya saat dibutuhkan.",
  keywords: ["QilaPay", "Tempo", "stablecoin", "remittance", "TIP-20", "adaptive KYC"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
