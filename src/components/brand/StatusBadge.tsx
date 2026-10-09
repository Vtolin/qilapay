type StatusTone = "success" | "pending" | "failed" | "info";

const TONE_STYLES: Record<StatusTone, string> = {
  success: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
  info: "bg-primary-soft text-primary-dark",
};

type StatusBadgeProps = {
  tone: StatusTone;
  children: React.ReactNode;
};

/** Generic pill badge. Transfer and tier badges build on this. */
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "text-xs font-extrabold uppercase tracking-wide",
        TONE_STYLES[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
