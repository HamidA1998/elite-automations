import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "glow";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-[color-mix(in_oklab,var(--color-accent)_48%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_78%,black)] text-white shadow-[0_0_18px_var(--color-accent-glow)] hover:bg-[var(--color-accent)]",
  secondary:
    "border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
  ghost:
    "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
  danger:
    "bg-[var(--color-error)]/15 text-[var(--color-error)] hover:bg-[var(--color-error)]/22",
  glow: "bg-[var(--color-accent)] text-white shadow-[var(--shadow-accent)] hover:scale-[1.02]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 py-2 text-[var(--text-sm)] font-medium transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-px active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:pointer-events-none disabled:opacity-45",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
});
