import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "glow";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const base = [
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl",
  "transition-all duration-200 ease-out select-none",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  "disabled:opacity-50 disabled:pointer-events-none",
  "active:scale-95",
].join(" ");

const variants: Record<Variant, string> = {
  primary: [
    "bg-[var(--color-accent)] text-white",
    "hover:-translate-y-0.5 hover:shadow-[var(--shadow-accent)]",
    "focus-visible:ring-[var(--color-accent)]",
  ].join(" "),
  secondary: [
    "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border-strong)]",
    "hover:bg-[var(--color-surface-3)] hover:-translate-y-0.5",
    "focus-visible:ring-[var(--color-accent)]",
  ].join(" "),
  ghost: [
    "text-[var(--color-text-muted)]",
    "hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
    "focus-visible:ring-[var(--color-accent)]",
  ].join(" "),
  danger: [
    "bg-[var(--color-error)] text-white",
    "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/25",
    "focus-visible:ring-[var(--color-error)]",
  ].join(" "),
  glow: [
    "bg-[var(--color-accent)] text-white",
    "hover:-translate-y-0.5 hover:shadow-[var(--shadow-accent)]",
    "shadow-[0_0_20px_var(--color-accent-glow)]",
    "focus-visible:ring-[var(--color-accent)]",
  ].join(" "),
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, icon, children, className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : icon}
      {children}
    </button>
  )
);
Button.displayName = "Button";
