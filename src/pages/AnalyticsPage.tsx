import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, PieChart, Pie, Cell, FunnelChart, Funnel,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchAccounts, fetchMetrics } from "@/services/api";
import type { AccountSummary, MetricsResponse } from "@/types/frontend";

// ─── design tokens ────────────────────────────────────────────────────────────
const C_ACCENT  = "#6366f1";
const C_EMERALD = "#34d399";
const C_AMBER   = "#fbbf24";
const C_CYAN    = "#22d3ee";
const C_RED     = "#f87171";

const STATUS_ORDER = [
  "prospect", "contacted", "replied", "proposal_sent", "negotiating", "won", "lost",
];
const STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  replied: "Replied",
  proposal_sent: "Proposal",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

const HEALTH_COLORS: Record<string, string> = {
  excellent: C_EMERALD,
  good: C_CYAN,
  fair: C_AMBER,
  poor: C_ACCENT,
  critical: C_RED,
};

// ─── custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-3 shadow-lg text-xs">
      {label && <p className="font-semibold text-[var(--color-text)] mb-2">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-[var(--color-text-muted)]">{p.name}:</span>
          <span className="font-mono text-[var(--color-text)]">
            {p.name?.toLowerCase().includes("value") || p.name?.toLowerCase().includes("pipeline")
              ? `£${Math.round(p.value).toLocaleString()}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── section wrapper ──────────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <p className="mb-5 text-sm font-semibold text-[var(--color-text)]">{title}</p>
      {children}
    </Card>
  );
}

// ─── funnel ───────────────────────────────────────────────────────────────────
function PipelineFunnel({ accounts }: { accounts: AccountSummary[] }) {
  const data = STATUS_ORDER.slice(0, 6).map((s, i) => ({
    name: STATUS_LABEL[s] ?? s,
    value: accounts.filter((a) =>
      STATUS_ORDER.indexOf(a.accountStatus) >= i
    ).length,
    fill: [C_ACCENT, C_CYAN, C_EMERALD, C_AMBER, "#a78bfa", "#f472b6"][i],
  }));

  return (
    <ChartCard title="Pipeline Funnel">
      <ResponsiveContainer width="100%" height={250}>
        <FunnelChart>
          <Tooltip content={<ChartTooltip />} />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList
              position="right"
              content={({ value, name }: any) => (
                <text fill="var(--color-text-muted)" fontSize={11}>
                  {name}: {value}
                </text>
              )}
            />
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── health pie ───────────────────────────────────────────────────────────────
function HealthPie({ accounts }: { accounts: AccountSummary[] }) {
  const data = Object.entries(
    accounts.reduce<Record<string, number>>((acc, a) => {
      const k = a.health || "unknown";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      color: HEALTH_COLORS[k] ?? C_ACCENT,
    }));

  return (
    <ChartCard title="Health Distribution">
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="55%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%" cy="50%"
              innerRadius={55}
              outerRadius={85}
              strokeWidth={2}
              stroke="var(--color-bg)"
            >
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[var(--color-text-muted)]">{d.name}</span>
              <span className="font-mono text-[var(--color-text)] ml-auto pl-3">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ─── score distribution ───────────────────────────────────────────────────────
function ScoreBars({ accounts }: { accounts: AccountSummary[] }) {
  const buckets = [
    { range: "0–20",   min: 0,  max: 20  },
    { range: "21–40",  min: 21, max: 40  },
    { range: "41–60",  min: 41, max: 60  },
    { range: "61–80",  min: 61, max: 80  },
    { range: "81–100", min: 81, max: 100 },
  ];
  const data = buckets.map((b) => ({
    range: b.range,
    count: accounts.filter((a) => a.siteScore >= b.min && a.siteScore <= b.max).length,
  }));

  return (
    <ChartCard title="Score Distribution">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="range" tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Leads" fill={C_ACCENT} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── deal value by status ─────────────────────────────────────────────────────
function ValueByStage({ accounts }: { accounts: AccountSummary[] }) {
  const data = STATUS_ORDER.slice(0, 6)
    .map((s) => ({
      status: STATUS_LABEL[s] ?? s,
      value: accounts
        .filter((a) => a.accountStatus === s)
        .reduce((sum, a) => sum + (a.dealValue ?? 0), 0),
    }))
    .filter((d) => d.value > 0);

  return (
    <ChartCard title="Pipeline Value by Stage">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
          />
          <YAxis
            dataKey="status"
            type="category"
            tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={85}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="Pipeline Value" fill={C_EMERALD} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── top leads table ──────────────────────────────────────────────────────────
function TopLeads({ accounts }: { accounts: AccountSummary[] }) {
  const top = [...accounts]
    .sort((a, b) => b.siteScore - a.siteScore)
    .slice(0, 10);

  return (
    <ChartCard title="Top Leads by Score">
      <div className="space-y-2">
        {top.map((a, i) => (
          <div key={a.clientId} className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--color-text-muted)] w-4 flex-shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--color-text)] truncate">{a.businessName}</div>
              <div className="text-xs text-[var(--color-text-muted)] truncate">{a.businessType} · {a.area}</div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0 text-xs">
              <span className="font-mono text-[var(--color-text-muted)] hidden sm:block">{a.accountStatus}</span>
              {a.dealValue > 0 && (
                <span className="font-mono text-[var(--color-success)]">
                  £{Math.round(a.dealValue).toLocaleString()}
                </span>
              )}
              <span className="font-mono font-bold text-[var(--color-accent)] w-10 text-right">
                {a.siteScore}
              </span>
            </div>
          </div>
        ))}
        {top.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">No scored leads yet.</p>
        )}
      </div>
    </ChartCard>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
  });

  const accounts = accountsData?.accounts ?? [];
  const metrics  = metricsData;
  const isLoading = accountsLoading || metricsLoading;

  const wonAccounts = accounts.filter((a) => a.accountStatus === "won");
  const wonValue    = wonAccounts.reduce((s, a) => s + (a.dealValue ?? 0), 0);
  const avgScore    = useMemo(() => {
    const scored = accounts.filter((a) => a.siteScore > 0);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((s, a) => s + a.siteScore, 0) / scored.length);
  }, [accounts]);

  return (
    <PageWrapper
      eyebrow="Intelligence"
      title="Analytics"
      description={`Pipeline intelligence across ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
    >
      <div className="space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          ) : (
            <>
              <StatCard
                label="Weighted Pipeline"
                value={`£${Math.round(metrics?.weightedPipeline ?? 0).toLocaleString()}`}
                detail="Probability-weighted deal value"
              />
              <StatCard
                label="Won Value"
                value={`£${Math.round(wonValue).toLocaleString()}`}
                detail={wonAccounts.length ? `${wonAccounts.length} deal${wonAccounts.length !== 1 ? "s" : ""} closed` : "No closed deals yet"}
              />
              <StatCard
                label="Won Deals"
                value={String(metrics?.wonDeals ?? wonAccounts.length)}
                detail="Accounts marked as won"
              />
              <StatCard
                label="Avg Site Score"
                value={`${avgScore} / 100`}
                detail="Average audit score across all leads"
              />
            </>
          )}
        </div>

        {/* Charts */}
        {!isLoading && accounts.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PipelineFunnel accounts={accounts} />
              <HealthPie accounts={accounts} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScoreBars accounts={accounts} />
              <ValueByStage accounts={accounts} />
            </div>
            <TopLeads accounts={accounts} />
          </>
        )}

        {!isLoading && accounts.length === 0 && (
          <Card className="p-16 text-center">
            <BarChart3 size={40} className="text-[var(--color-text-muted)] mx-auto mb-3" />
            <p className="text-[var(--color-text-muted)]">
              No data yet — run the pipeline to generate analytics.
            </p>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
