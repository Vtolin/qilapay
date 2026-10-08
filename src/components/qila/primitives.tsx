"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Eyebrow: small uppercase label with dot, from boilerplate design. */
export function Eyebrow({
  children,
  tone = "blue",
  className,
}: {
  children: React.ReactNode;
  tone?: "blue" | "sky" | "night";
  className?: string;
}) {
  const tones = {
    blue: "bg-qila-blue-soft text-qila-blue-dark",
    sky: "bg-qila-sky-soft text-qila-sky-deep",
    night: "bg-qila-night-soft text-qila-sky",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Section heading block. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  dark = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? (
        <Eyebrow tone={dark ? "night" : "blue"} className="mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h2
        className={cn(
          "text-3xl font-extrabold tracking-tight sm:text-4xl",
          dark ? "text-white" : "text-qila-ink",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={cn("mt-3 text-lg", dark ? "text-white/70" : "text-qila-muted")}>{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Status pill used across transfers/verifications. */
export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Primary/dark/ghost button unified. */
export function QButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "dark" | "ghost" | "danger" | "outline";
  size?: "md" | "lg" | "sm";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "",
    dark: "bg-qila-night text-white hover:bg-qila-night-soft",
    ghost: "bg-transparent text-qila-ink hover:bg-qila-blue-soft",
    danger: "bg-qila-bad text-white hover:bg-qila-bad/90",
    outline: "border border-qila-line bg-white text-qila-ink hover:bg-qila-blue-soft",
  };
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-11 px-5",
    lg: "h-12 px-7 text-base",
  };
  return (
    <Button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={cn("rounded-full font-bold", variants[variant], sizes[size], className)}
    >
      {children}
    </Button>
  );
}
