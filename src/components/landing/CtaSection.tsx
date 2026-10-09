import { ROUTES } from "@/lib/site";
import { Button } from "@/components/brand/Button";

/**
 * Bottom call-to-action. Bold blue block with a light blue
 * accent button. Last push before the footer.
 */
export function CtaSection() {
  return (
    <section aria-labelledby="cta-title" className="py-16 sm:py-20">
      <div className="qila-container">
        <div className="relative overflow-hidden rounded-4xl bg-primary px-7 py-12 sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="qila-dots-light absolute right-10 top-8 h-36 w-56 opacity-50" />
            <div className="absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/40 blur-3xl" />
          </div>
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-140">
              <h2
                id="cta-title"
                className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
              >
                Send the first transfer. Keep every key.
              </h2>
              <p className="mt-3 text-lg text-white/75">
                Create an account to preview live quotes, connect a wallet,
                and build your first AutoTransfer schedule.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href={ROUTES.signup} variant="accent" size="lg">
                Get started →
              </Button>
              <Button href={ROUTES.login} variant="ghostLight" size="lg">
                Log in
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
