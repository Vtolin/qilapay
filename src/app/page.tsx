"use client";

import { useCallback, useEffect, useState } from "react";
import { TestnetBanner, AppNav, AuthView, type View } from "@/components/qila/AppChrome";
import { Landing } from "@/components/qila/Landing";
import { DashboardView } from "@/components/qila/Dashboard";
import { SendView, type SendPrefill } from "@/components/qila/Send";
import { TransfersView } from "@/components/qila/Transfers";
import { VerifyView } from "@/components/qila/Verify";
import { RecipientsView } from "@/components/qila/Recipients";
import { AdminView } from "@/components/qila/Admin";
import { DemoView, SCENARIOS } from "@/components/qila/Demo";
import { api, type SessionData } from "@/lib/qila/client";

/**
 * QilaPay SPA root. All views render from this single route; navigation is
 * state-based. Backend lives under /api/* (custodial wallet + Tempo RPC
 * never touch the browser).
 */
export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("landing");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [sendPrefill, setSendPrefill] = useState<SendPrefill | null>(null);

  const refreshSession = useCallback(async () => {
    const res = await api<SessionData>("/api/session");
    if (res.ok) {
      setSession(res.data);
      return res.data;
    }
    return null;
  }, []);

  useEffect(() => {
    (async () => {
      const s = await refreshSession();
      if (s?.authenticated) setView("dashboard");
      setLoading(false);
    })();
  }, [refreshSession]);

  async function logout() {
    await api("/api/auth", { body: { action: "logout" } });
    setSession(null);
    setView("landing");
  }

  async function loginPersona(persona: string) {
    await api("/api/auth", { body: { action: "persona", persona } });
    const s = await refreshSession();
    if (s?.authenticated) {
      setSendPrefill(null);
      setView(persona === "admin" ? "admin" : "dashboard");
    }
  }

  async function runScenario(scenario: (typeof SCENARIOS)[number]) {
    // login as the scenario persona
    await api("/api/auth", { body: { action: "persona", persona: scenario.persona } });
    // scenario setup (e.g., velocity history for Dewi)
    if (scenario.needsSetup === "velocity") {
      await api("/api/demo", { body: { action: "velocity", persona: scenario.persona } });
    }
    // ensure the screening recipient exists for screening scenarios
    if (scenario.prefill.recipientName) {
      const existing = await api<{ recipients: { id: string; name: string }[] }>("/api/recipients");
      if (existing.ok && !existing.data.recipients.some((r) => r.name === scenario.prefill.recipientName)) {
        await api("/api/recipients", {
          body: { name: scenario.prefill.recipientName, country: "AF" },
        });
      }
    }
    await refreshSession();
    setSendPrefill(scenario.prefill);
    setView("send");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <TestnetBanner />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-qila-muted">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-qila-blue border-t-transparent" />
            Memuat QilaPay…
          </div>
        </div>
      </div>
    );
  }

  const authenticated = session?.authenticated && session.user;

  return (
    <div className="flex min-h-screen flex-col">
      <TestnetBanner />

      {authenticated ? (
        <>
          <AppNav
            view={view}
            setView={(v) => {
              setSendPrefill(null);
              setView(v);
            }}
            session={session}
            onLogout={logout}
            onDemo={() => {
              setSendPrefill(null);
              setView("demo");
            }}
          />
          <main className="flex-1">
            {view === "dashboard" && (
              <DashboardView
                session={session}
                refresh={refreshSession}
                onGoSend={() => {
                  setSendPrefill(null);
                  setView("send");
                }}
                onGoVerify={() => setView("verify")}
                onGoTransfers={() => setView("transfers")}
              />
            )}
            {view === "send" && (
              <SendView
                session={session}
                prefill={sendPrefill}
                clearPrefill={() => setSendPrefill(null)}
                refresh={refreshSession}
              />
            )}
            {view === "transfers" && <TransfersView />}
            {view === "verify" && (
              <VerifyView session={session} refresh={refreshSession} />
            )}
            {view === "recipients" && <RecipientsView />}
            {view === "admin" && <AdminView />}
            {view === "demo" && (
              <DemoView onPersona={loginPersona} onScenario={runScenario} />
            )}
            {view === "landing" && (
              <Landing
                onTryDemo={async () => {
                  await loginPersona("sari");
                }}
                onLogin={() => {
                  setAuthMode("login");
                  setView("auth");
                }}
                onRegister={() => {
                  setAuthMode("register");
                  setView("auth");
                }}
              />
            )}
          </main>
        </>
      ) : (
        <main className="flex-1">
          {view === "auth" ? (
            <AuthView
              mode={authMode}
              onDone={(s) => {
                setSession(s);
                setView(s.user?.role === "admin" ? "admin" : "dashboard");
              }}
              onBack={() => setView("landing")}
            />
          ) : (
            <>
              {/* pre-login header */}
              <header className="sticky top-[36px] z-40 border-b border-qila-line bg-white/90 backdrop-blur">
                <div className="qila-container flex h-16 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-qila-blue text-sm font-black text-white">
                      Q
                    </span>
                    <span className="text-lg font-black tracking-tight text-qila-ink">
                      QilaPay
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setView("auth");
                      }}
                      className="rounded-full px-4 py-2 text-sm font-bold text-qila-ink hover:bg-qila-blue-soft"
                    >
                      Masuk
                    </button>
                    <button
                      onClick={async () => {
                        await loginPersona("sari");
                      }}
                      className="rounded-full bg-qila-blue px-5 py-2 text-sm font-bold text-white hover:bg-qila-blue-dark"
                    >
                      Try demo
                    </button>
                  </div>
                </div>
              </header>
              <Landing
                onTryDemo={async () => {
                  await loginPersona("sari");
                }}
                onLogin={() => {
                  setAuthMode("login");
                  setView("auth");
                }}
                onRegister={() => {
                  setAuthMode("register");
                  setView("auth");
                }}
              />
            </>
          )}
        </main>
      )}

      <footer className="mt-auto border-t border-qila-line bg-white">
        <div className="qila-container flex flex-wrap items-center justify-between gap-2 py-6 text-xs text-qila-muted">
          <p>
            <strong className="text-qila-ink">QilaPay</strong> — demo testnet. Uang tidak nyata,
            KYC disimulasikan.
          </p>
          <p>
            Tempo Moderato · chain 42431 · TIP-20 · viem
          </p>
        </div>
      </footer>
    </div>
  );
}
