import { Card } from "@/components/brand/Card";

/** One row inside the transfer preview (label left, value right). */
type PreviewRowProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

function PreviewRow({ label, value, highlight = false }: PreviewRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-[15px] last:border-b-0">
      <span className="text-muted">{label}</span>
      <strong
        className={
          highlight
            ? "rounded-full bg-accent-soft px-2.5 py-0.5 text-accent-deep"
            : "text-right"
        }
      >
        {value}
      </strong>
    </div>
  );
}

/**
 * Hero transfer visual. CSS-only app card.
 * Later: replace hardcoded rows with GET /api/quotes/preview.
 */
export function TransferPreviewCard() {
  return (
    <div className="relative">
      {/* Floating chips. Pure CSS, no images */}
      <div className="absolute -left-4 -top-5 z-10 animate-float rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm font-bold shadow-[0_10px_30px_rgba(10,20,48,0.14)] sm:-left-8">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
        You hold the keys
      </div>
      <div
        className="absolute -bottom-5 -right-3 z-10 animate-float rounded-2xl bg-night px-3.5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(10,20,48,0.3)] sm:-right-6"
        style={{ animationDelay: "1.4s" }}
      >
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent align-middle" />
        AutoTransfer · available
      </div>

      <Card className="relative overflow-hidden">
        <div className="qila-dots pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold uppercase tracking-[0.12em] text-muted">
              Sample transfer
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              LIVE QUOTE
            </span>
          </div>

          {/* Route visual: sender -> receiver */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-background p-4">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                You send
              </p>
              <p className="text-2xl font-extrabold tracking-tight">
                $1,000.00
              </p>
              <p className="text-sm font-bold text-muted">USD · USA</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                →
              </span>
              <span className="text-xs font-bold text-primary-dark">
                5–15 min
              </span>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                She receives
              </p>
              <p className="text-2xl font-extrabold tracking-tight">
                Rp17.8M
              </p>
              <p className="text-sm font-bold text-muted">IDR · Indonesia</p>
            </div>
          </div>

          <div className="mt-3">
            <PreviewRow label="Network + service fee" value="$9.20" highlight />
            <PreviewRow label="Exchange rate" value="1 USD = 18,000 IDR" />
            <PreviewRow label="Custody" value="You (non-custodial)" />
          </div>

          <p className="mt-4 rounded-2xl bg-primary-soft px-3.5 py-2.5 text-sm font-semibold text-primary-ink">
            The price you see is the price she gets. No hidden spread.
          </p>
        </div>
      </Card>
    </div>
  );
}
