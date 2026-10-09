"use client";

/**
 * Domain view primitives. Canonical design system lives in
 * `@/components/brand` (ported from qpfrontendold "Trustful Blue").
 * This module keeps existing `qila/*` import paths working and maps
 * legacy tone names to brand tokens. New code should import from
 * `@/components/brand` directly.
 */

import { Button as BrandButton } from "@/components/brand/Button";
import { Eyebrow as BrandEyebrow } from "@/components/brand/Eyebrow";
import { SectionHeading as BrandHeading } from "@/components/brand/SectionHeading";
import { cn } from "@/lib/utils";

export const Eyebrow = BrandEyebrow;
export const SectionHeading = BrandHeading;

export { Card } from "@/components/brand/Card";
export { StatusBadge } from "@/components/brand/StatusBadge";
export { FormField, inputStyles } from "@/components/brand/FormField";
export { Button as BrandButton } from "@/components/brand/Button";

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

/** Primary/dark/ghost button unified (maps legacy variants to brand). */
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
  if (variant === "danger") {
    return (
      <BrandButton
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={cn("border-transparent bg-red-600 text-white hover:bg-red-700", className)}
        size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"}
      >
        {children}
      </BrandButton>
    );
  }
  if (variant === "ghost") {
    return (
      <BrandButton
        type={type}
        onClick={onClick}
        disabled={disabled}
        variant="secondary"
        className={className}
        size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"}
      >
        {children}
      </BrandButton>
    );
  }
  if (variant === "outline") {
    return (
      <BrandButton
        type={type}
        onClick={onClick}
        disabled={disabled}
        variant="secondary"
        className={cn("border-line", className)}
        size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"}
      >
        {children}
      </BrandButton>
    );
  }
  return (
    <BrandButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      variant={variant === "dark" ? "dark" : "primary"}
      className={className}
      size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"}
    >
      {children}
    </BrandButton>
  );
}
