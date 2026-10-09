import { AppGuard } from "@/components/app/AppGuard";

/**
 * Signed-in shell. Route group, so URLs stay clean (/dashboard, /send...).
 * Navigation lives in the floating header capsule (session-aware), so this
 * layout only adds page spacing plus a client-side login redirect.
 * APIs enforce auth server-side; the guard is UX only.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="qila-container py-8 sm:py-10">
      <AppGuard />
      {children}
    </div>
  );
}
