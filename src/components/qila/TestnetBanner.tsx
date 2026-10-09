"use client";

/** Fixed testnet banner, shown on every screen. */
export function TestnetBanner() {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-night px-4 py-2 text-center text-xs font-bold text-accent sm:text-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      TESTNET DEMO, Tempo Moderato (chain 42431). No real money. KYC is simulated.
    </div>
  );
}
