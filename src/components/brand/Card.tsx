import type { ReactNode } from "react";

type CardTone = "light" | "dark" | "accent" | "blue";

const TONE_STYLES: Record<CardTone, string> = {
  light: "bg-surface border-line text-ink",
  dark: "bg-night border-white/10 text-white",
  accent: "bg-accent border-transparent text-accent-deep",
  blue: "bg-primary border-transparent text-white",
};

type CardProps = {
  children: ReactNode;
  tone?: CardTone;
  className?: string;
};

/**
 * Surface card with tone variants.
 * Default stays white for trust; `dark` is reserved for the
 * one navy contrast section, `accent`/`blue` for bold stat blocks.
 */
export function Card({ children, tone = "light", className = "" }: CardProps) {
  return (
    <div
      className={[
        "rounded-[28px] border p-6 sm:p-7",
        "shadow-[0_18px_50px_rgba(10,20,48,0.10)]",
        TONE_STYLES[tone],
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
