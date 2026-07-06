import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Award, Target, Activity, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchMetrics } from "@/services/api";

function MetricBar({ value, max, color = "var(--color-accent)" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.max(2, (value / max) * 100));
  return (
    <div className="w-full bg-[var(--color-surface-3)] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function OpsMetricsPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    staleTime: 60_000,
  });

  const kpis = metrics
    ? [
        { label: "Weighted pipeline",   value: `£${metrics.weightedPipeline.toLocaleString()}`,         icon: TrendingUp,  color: "var(--color-accent)" },
        { label: "Revenue collected",   value: `£${metrics.revenueCollected.toLocaleString()}`,          icon: DollarSign,  color: "#22c55e" },
        { label: "Won deals",           value: String(metrics.wonDeals),                                  icon: Award,       color: "#a78bfa" },
        { label: "Average deal value",  value: `£${metrics.averageDeal.toLocaleString()}`,               icon: Target,      color: "#f59e0b" },
        { label: "Revenue pipeline",    value: `£${metrics.revenuePipeline.toLocaleString()}`,           icon: BarChart3,   color: "#f97316" },
        { label: "Live activity count", value: String(metrics.liveActivityCount),                         icon: Activity,    color: "#06b6d4" },
      ]
    : [];

  const detailRows = metrics
    ? [
        { label: "Booked readiness",   value: `${(metrics.bookedReadiness * 100).toFixed(1)}%`,       bar: metrics.bookedReadiness * 100,   max: 100, color: "var(--color-accent)" },
        { label: "Total prospects",    value: String(metrics.weightedPipeline > 0 ? "—" : "—"),        bar: 0,                               max: 100, color: "#64748b" },
        { label: "Qualified leads",    value: "—",                                                     bar: 0,                               max: 100, color: "#22c55e" },
        { label: "Proposal stage",     value: "—",                                                     bar: 0,                               max: 50,  color: "#f59e0b" },
      ]
    : [];

  return (
    <PageWrapper
      eyebrow="HAMID.OS · OPS"
      title="METRICS"
      description="Live business intelligence — pipeline health, deal velocity, revenue performance"
    >
      <div className="space-y-6">

        {/* KPI grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-28 rounded-[var(--radius-2xl)] animate-pulse bg-[var(--color-surface-2)]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="p-5 space-y-3">
                <span
                  className="inline-flex size-9 items-center justify-center rounded-full"
                  style={{ background: `${color}22`, color }}
                >
                  <Icon size={16} />
                </span>
                <div>
                  <p className="metric-mono text-2xl font-bold" style={{ color }}>
                    {value}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Readiness / progress bars */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Pipeline health</p>
              <h2 className="display-title !text-[var(--text-lg)]">Funnel progress metrics</h2>
            </div>
            <Badge variant={metrics ? "success" : "neutral"}>
              {metrics ? "LIVE" : "LOADING"}
            </Badge>
          </div>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {detailRows.map(({ label, value, bar, max, color }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">{label}</span>
                    <span className="font-mono font-bold" style={{ color }}>
                      {value}
                    </span>
                  </div>
                  <MetricBar value={bar} max={max} color={color} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Raw metrics table */}
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
            <BarChart3 size={14} className="text-[var(--color-accent)]" />
            <p className="section-kicker">Raw metrics</p>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : metrics ? (
            <div className="divide-y divide-[var(--color-border)]">
              {[
                { label: "Weighted pipeline",   value: `£${metrics.weightedPipeline.toLocaleString()}` },
                { label: "Revenue pipeline",     value: `£${metrics.revenuePipeline.toLocaleString()}` },
                { label: "Revenue collected",    value: `£${metrics.revenueCollected.toLocaleString()}` },
                { label: "Won deals",            value: String(metrics.wonDeals) },
                { label: "Average deal value",   value: `£${metrics.averageDeal.toLocaleString()}` },
                { label: "Booked readiness",     value: `${(metrics.bookedReadiness * 100).toFixed(1)}%` },
                { label: "Live activity count",  value: String(metrics.liveActivityCount) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
                  <span className="metric-mono text-sm font-bold text-[var(--color-accent)]">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-[var(--color-text-muted)]">
              No metrics data available.
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
