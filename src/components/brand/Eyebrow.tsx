type EyebrowTone = "blue" | "sky" | "dark" | "light";

const TONE_STYLES: Record<EyebrowTone, string> = {
  blue: "bg-primary-soft text-primary-dark",
  sky: "bg-accent text-accent-deep",
  dark: "bg-night text-white",
  light: "bg-white/15 text-white border border-white/25",
};

type EyebrowProps = {
  children: React.ReactNode;
  tone?: EyebrowTone;
};

/**
 * Small uppercase kicker label above section titles.
 */
export function Eyebrow({ children, tone = "blue" }: EyebrowProps) {
  return (
    <span
      className={[
        "mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5",
        "text-xs font-extrabold uppercase tracking-[0.14em]",
        TONE_STYLES[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
