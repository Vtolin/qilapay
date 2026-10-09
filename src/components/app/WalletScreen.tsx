"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth/useSession";
import { api } from "@/lib/qila/client";
import { Card } from "@/components/brand/Card";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { LoadingScreen, SignedOutCard } from "@/components/app/ScreenGuard";
import { formatNumber, shortenAddress } from "@/lib/qila/format";

const CCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  IDR: "🇮🇩",
  SGD: "🇸🇬",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
};

/** /wallet. Live onchain balances plus faucet and treasury top up. */
export function WalletScreen() {
  const { session, refresh } = useSession();
  const [toppingUp, setToppingUp] = useState<string | null>(null);

  if (session === undefined) return <LoadingScreen />;
  if (session === null) return <SignedOutCard body="Please sign in to see your wallet." />;

  const balances = session.balances || [];
  const address = session.user?.walletAddress || "";

  async function topUp(ccy: string) {
    setToppingUp(ccy);
    try {
      await api("/api/fund", { body: { currency: ccy } });
      await refresh();
    } finally {
      setToppingUp(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Eyebrow tone="blue">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Wallet
        </Eyebrow>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Your testnet wallet
        </h1>
        <p className="mt-2 text-muted">
          Custodial Tempo wallet, funded from the faucet. Keys stay encrypted on the server.
        </p>
      </div>

      <Card>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
          Deposit address
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-background px-3 py-2 font-mono text-sm font-bold">
            {address ? shortenAddress(address) : "No wallet yet"}
          </code>
          {address ? (
            <button
              type="button"
              onClick={copy}
              className="rounded-full bg-primary-soft px-4 py-2 text-sm font-bold text-primary-dark hover:bg-primary hover:text-white"
            >
              Copy
            </button>
          ) : null}
        </div>
        {address ? (
          <p className="mt-2 break-all font-mono text-xs text-muted">{address}</p>
        ) : null}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Onchain balances</h2>
          <span className="text-xs font-semibold text-muted">
            TIP-20 on Tempo Moderato, live from RPC
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {balances.map((b) => (
            <div key={b.code} className="rounded-2xl border border-line bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-muted">
                  {CCY_FLAGS[b.code] || ""} {b.code}
                </span>
                <button
                  onClick={() => topUp(b.code)}
                  disabled={toppingUp !== null}
                  className="text-[11px] font-bold text-primary hover:underline disabled:opacity-50"
                >
                  {toppingUp === b.code ? "Working..." : b.code === "USD" ? "+ faucet" : "+ top up"}
                </button>
              </div>
              <p className="mt-1 truncate text-xl font-extrabold">{formatNumber(b.amount)}</p>
              <p className="text-[11px] text-muted">{b.name}</p>
            </div>
          ))}
          {balances.length === 0 ? (
            <p className="text-sm text-muted">No balances yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
