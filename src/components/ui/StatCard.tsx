import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  trend?: number;
}

export function StatCard({ label, value, detail, trend }: StatCardProps) {
  const positive = typeof trend === "number" ? trend >= 0 : undefined;
  return (
    <Card className="min-h-[11rem] space-y-4">
      <p className="section-kicker">{label}</p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="metric-mono metric-value-hero font-semibold tracking-[-0.05em]">{value}</p>
          <p className="mt-2 max-w-[24ch] text-sm text-[var(--color-text-muted)]">{detail}</p>
        </div>
        {typeof trend === "number" ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              positive
                ? "bg-[var(--color-success)]/12 text-[var(--color-success)]"
                : "bg-[var(--color-error)]/12 text-[var(--color-error)]"
            }`}
          >
            {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </span>
        ) : null}
      </div>
    </Card>
  );
}
