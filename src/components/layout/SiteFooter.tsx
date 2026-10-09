"use client";

import Link from "next/link";
import { ROUTES, SITE } from "@/lib/site";
import { useSession } from "@/lib/auth/useSession";

/** Footer columns. Add legal and product links as routes appear. */
const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Why QilaPay", href: ROUTES.features },
      { label: "You hold it", href: ROUTES.control },
      { label: "AutoTransfer", href: ROUTES.automation },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How it works", href: ROUTES.howItWorksPage },
      { label: "Log in", href: ROUTES.login },
      { label: "Get started", href: ROUTES.signup },
    ],
  },
] as const;

/**
 * Pre-login footer. Hidden for signed-in users: inside the app the footer
 * is noise, and its links duplicate the navbar tabs.
 */
export function SiteFooter() {
  const { session } = useSession();

  if (session !== null) return null;

  return (
    <footer className="border-t border-line bg-surface pt-12 text-muted">
      <div className="qila-container grid gap-10 pb-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-extrabold text-white">
              Q
            </span>
            {SITE.name}
          </p>
          <p className="mt-3 max-w-[320px] text-[15px]">
            Non-custodial remittance router. Lower fees, AutoTransfer
            schedules, funds only you control.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-ink">
                {col.title}
              </h3>
              <ul className="grid gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-ink">
              Contact
            </h3>
            <p className="text-[15px]">{SITE.supportEmail}</p>
            <p className="mt-2 text-sm">© {SITE.year} {SITE.name}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        Illustrative quotes shown. Live rates appear after login.
      </div>
    </footer>
  );
}
