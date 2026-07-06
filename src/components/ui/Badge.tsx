import type { ReactNode } from "react";
import clsx from "clsx";

export interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}

const badgeClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success:
    "border border-[color-mix(in_oklab,var(--color-success)_40%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-[var(--color-success)]",
  warning:
    "border border-[color-mix(in_oklab,var(--color-warning)_40%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]",
  error:
    "border border-[color-mix(in_oklab,var(--color-error)_44%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-error)_14%,transparent)] text-[var(--color-error)]",
  info:
    "border border-[color-mix(in_oklab,var(--color-accent)_40%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]",
  neutral: "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]",
};

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2 py-[2px] text-[10px] tracking-[0.08em]",
  md: "px-2.5 py-[3px] text-[10.5px] tracking-[0.08em]",
};

export function Badge({ variant = "neutral", size = "sm", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full font-semibold uppercase leading-none",
        sizeClasses[size],
        badgeClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
