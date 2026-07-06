import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };

export function Card({ children, className = "", glass, hover, padding = "md" }: CardProps) {
  return (
    <div
      className={`
        rounded-2xl border border-[var(--color-border)]
        ${glass
          ? "bg-white/[0.04] backdrop-blur-xl backdrop-saturate-180 shadow-[var(--shadow-lg),inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
        }
        ${hover ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] cursor-pointer" : ""}
        ${paddings[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
  accent?: boolean;
  sub?: string;
}

export function StatCard({ label, value, trend, icon, accent, sub }: StatCardProps) {
  return (
    <Card hover className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
          {label}
        </span>
        {icon && (
          <span className={`p-2 rounded-lg ${accent ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"}`}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <div className="font-mono text-3xl font-semibold text-[var(--color-text)]">
          {value}
        </div>
        {sub && <div className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</div>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs last week
        </div>
      )}
    </Card>
  );
}
