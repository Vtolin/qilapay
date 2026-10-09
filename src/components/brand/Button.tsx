import Link from "next/link";
import type { ReactNode } from "react";

/* Single place to evolve the button language. */

type ButtonVariant = "primary" | "secondary" | "accent" | "dark" | "ghostLight";
type ButtonSize = "md" | "lg" | "sm";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dark border-transparent shadow-[0_10px_24px_rgba(36,71,255,0.35)]",
  secondary: "bg-surface text-ink hover:bg-background border-line",
  accent:
    "bg-accent text-accent-deep hover:brightness-95 border-transparent font-extrabold",
  dark: "bg-night text-white hover:bg-night-soft border-transparent",
  ghostLight:
    "bg-white/10 text-white hover:bg-white/20 border-white/25 backdrop-blur",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  md: "min-h-11 px-[18px] text-[15px]",
  lg: "min-h-[52px] px-7 text-base",
  sm: "min-h-9 px-4 text-sm",
};

type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * QilaPay button. Renders a Next.js <Link> when `href` is given,
 * otherwise a native <button>. Pill shape is the brand language.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  className = "",
  type = "button",
  onClick,
  disabled = false,
}: ButtonProps) {
  const styles = [
    "inline-flex items-center justify-center rounded-full border font-bold transition-all duration-150 active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    className,
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}
