import React from "react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "accent";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  warning: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  error:   "bg-red-500/15 text-red-400 ring-red-500/25",
  info:    "bg-cyan-500/15 text-cyan-400 ring-cyan-500/25",
  neutral: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] ring-[var(--color-border)]",
  accent:  "bg-indigo-500/15 text-indigo-400 ring-indigo-500/25",
};

export function Badge({ variant = "neutral", children, dot, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
        ring-1 ring-inset ${variants[variant]} ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full animate-[pulse-dot_2s_ease-in-out_infinite] ${
            variant === "success" ? "bg-emerald-400" :
            variant === "warning" ? "bg-amber-400" :
            variant === "error"   ? "bg-red-400" :
            variant === "info"    ? "bg-cyan-400" :
            variant === "accent"  ? "bg-indigo-400" :
            "bg-[var(--color-text-muted)]"
          }`}
        />
      )}
      {children}
    </span>
  );
}

// Status → badge variant mapping
export function statusBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    won: "success", booked: "success", delivered: "success", accepted: "success",
    replied: "info", sent: "info", contacted: "info",
    proposal: "accent", "in-follow-up": "accent", negotiating: "accent",
    lost: "error", error: "error",
    "ready-to-send": "warning", queued: "warning",
    researched: "neutral", prepared: "neutral", idle: "neutral",
  };
  return map[status] ?? "neutral";
}

export function healthBadge(band: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    critical: "error", weak: "warning", workable: "info", stable: "success",
  };
  return map[band] ?? "neutral";
}
