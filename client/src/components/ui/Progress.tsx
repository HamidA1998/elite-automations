import React from "react";

interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showPct?: boolean;
  variant?: "accent" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
}

const variants = {
  accent:  "bg-[var(--color-accent)]",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error:   "bg-red-500",
};

const heights = { sm: "h-1", md: "h-2", lg: "h-3" };

export function Progress({ value, max = 100, label, showPct, variant = "accent", size = "md" }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full">
      {(label || showPct) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-[var(--color-text-muted)]">{label}</span>}
          {showPct && <span className="text-xs font-mono text-[var(--color-text-muted)]">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={`w-full ${heights[size]} rounded-full bg-[var(--color-surface-2)] overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${variants[variant]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
