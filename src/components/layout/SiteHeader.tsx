"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV, APP_NAV, HEADER_NAV, ROUTES, SITE } from "@/lib/site";
import { Button } from "@/components/brand/Button";
import { api } from "@/lib/qila/client";
import { useSession } from "@/lib/auth/useSession";

/**
 * Session-aware floating capsule nav (dynamic-island style).
 * Always rendered, on every route including /login and /register.
 * Signed out: marketing links plus login CTA.
 * Signed in: app tabs (Dashboard, Send, Transactions, Wallet, Verification,
 * Recipients, Demo, plus Admin for admin roles) plus logout, so app pages
 * never show marketing links.
 * Slides away on scroll down, returns on scroll up.
 *
 * NOTE: top offset sits below the sticky TestnetBanner (see RootLayout).
 */
export function SiteHeader() {
  const { session, refresh } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [condensed, setCondensed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setCondensed(y > 24);
      if (y > 160 && y > lastY.current + 4) {
        setHidden(true);
      } else if (y < lastY.current - 4 || y <= 160) {
        setHidden(false);
      }
      lastY.current = y;
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleLogout() {
    await api("/api/auth", { body: { action: "logout" } });
    await refresh();
    router.push(ROUTES.home);
  }

  const signedIn = session !== undefined && session !== null;
  const isAdmin = signedIn && session.user?.role === "admin";

  return (
    <header
      className={[
        "fixed inset-x-0 top-[45px] z-30 flex justify-center px-3",
        "transition-transform duration-300",
        hidden ? "translate-y-[-140%]" : "translate-y-0",
      ].join(" ")}
    >
      <div
        className={[
          "flex w-full max-w-290 items-center gap-2 rounded-full",
          "border border-line bg-surface/85 shadow-[0_12px_40px_rgba(10,20,48,0.14)]",
          "backdrop-blur-xl transition-all duration-300",
          condensed ? "px-3 py-1.5" : "px-4 py-2.5",
        ].join(" ")}
      >
        <Link
          href={signedIn ? ROUTES.dashboard : ROUTES.home}
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight"
          aria-label={signedIn ? "QilaPay dashboard" : `${SITE.name} home`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white">
            Q
          </span>
          <span className="hidden sm:inline">{SITE.name}</span>
        </Link>

        {signedIn ? (
          <>
            <nav
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
              aria-label="App"
            >
              {APP_NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                      active
                        ? "bg-night text-white"
                        : "text-muted hover:bg-background hover:text-ink",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isAdmin ? (
                <Link
                  href={ADMIN_NAV.href}
                  aria-current={pathname === ADMIN_NAV.href ? "page" : undefined}
                  className={[
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                    pathname === ADMIN_NAV.href
                      ? "bg-night text-white"
                      : "text-muted hover:bg-background hover:text-ink",
                  ].join(" ")}
                >
                  {ADMIN_NAV.label}
                </Link>
              ) : null}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-muted transition-colors hover:bg-background hover:text-ink"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            {HEADER_NAV.length > 0 ? (
              <nav
                className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex"
                aria-label="Primary"
              >
                {HEADER_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap text-sm font-semibold text-muted transition-colors hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button href={ROUTES.login} variant="secondary">
                Log in
              </Button>
              <Button
                href={ROUTES.signup}
                variant="primary"
                className="hidden sm:inline-flex"
              >
                Get started
              </Button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
