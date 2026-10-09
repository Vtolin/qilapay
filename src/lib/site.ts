/**
 * Single source of truth for routes. Ported from qpfrontendold, extended
 * with backend pages (recipients, admin, demo).
 * Frontend rule: never hardcode href strings in components. Import ROUTES.
 */
export const ROUTES = {
  home: "/",
  features: "/#features",
  control: "/#control",
  automation: "/#automation",
  howItWorks: "/#how-it-works",
  howItWorksPage: "/how-it-works",
  login: "/login",
  signup: "/login?mode=signup",
  register: "/register",
  dashboard: "/dashboard",
  send: "/send",
  transactions: "/transactions",
  wallet: "/wallet",
  verification: "/verification",
  recipients: "/recipients",
  admin: "/admin",
  demo: "/demo",
} as const;

export type RouteKey = keyof typeof ROUTES;

/** Header navigation (pre-login). Intentionally empty: the pre-login navbar
 * shows only the brand plus Log in / Get started, no marketing links. */
export const HEADER_NAV: ReadonlyArray<{ label: string; href: string }> = [];

/**
 * App navigation (signed-in shell). Labels double as the page titles.
 * Recipients and Demo are backend pages added to the original five.
 * Admin is appended by the header only for admin roles.
 */
export const APP_NAV = [
  { label: "Dashboard", href: ROUTES.dashboard },
  { label: "Send", href: ROUTES.send },
  { label: "Transactions", href: ROUTES.transactions },
  { label: "Wallet", href: ROUTES.wallet },
  { label: "Verification", href: ROUTES.verification },
  { label: "Recipients", href: ROUTES.recipients },
  { label: "Demo", href: ROUTES.demo },
] as const;

export const ADMIN_NAV = { label: "Admin", href: ROUTES.admin } as const;

export const SITE = {
  name: "QilaPay",
  tagline: "Send money home. Keep control of it.",
  description:
    "QilaPay is the non-custodial remittance router with lower fees, transparent quotes, AutoTransfer schedules, and funds only you control.",
  year: 2026,
  supportEmail: "support@qilapay.example",
} as const;
