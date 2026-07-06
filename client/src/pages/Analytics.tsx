import { useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/Card";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  TrendingUp, Users, MessageSquare, PoundSterling,
  BarChart3, PieChart as PieIcon, Activity,
} from "lucide-react";
import type { ClientRecord, AccountStatus } from "@/types";

// ─── colour palette pulled from CSS vars ───────────────────────────────────
const ACCENT   = "#6366f1";
const EMERALD  = "#34d399";
const AMBER    = "#fbbf24";
const CYAN     = "#22d3ee";
const RED      = "#f87171";

const STATUS_ORDER: AccountStatus[] = [
  "prospect", "contacted", "replied", "proposal_sent", "negotiating", "won", "lost",
];
const STATUS_LABELS: Record<AccountStatus, string> = {
  prospect: "Prospect", contacted: "Contacted", replied: "Replied",
  proposal_sent: "Proposal Sent", negotiating: "Negotiating", won: "Won", lost: "Lost",
};

// ─── Tooltip ───────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-3 shadow-xl text-xs">
      {label && <div className="font-semibold text-[var(--color-text)] mb-2">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--color-text-muted)]">{p.name}:</span>
          <span className="font-mono text-[var(--color-text)]">
            {typeof p.value === "number" && p.name?.toLowerCase().includes("value")
              ? `£${Math.round(p.value).toLocaleString()}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section container ─────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[var(--color-accent)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Funnel data ───────────────────────────────────────────────────────────
function PipelineFunnel({ accounts }: { accounts: ClientRecord[] }) {
  const data = STATUS_ORDER.slice(0, 6).map((s, i) => ({
    name: STATUS_LABELS[s],
    value: accounts.filter((a) => a.status === s || STATUS_ORDER.indexOf(a.status) >= i).length,
    fill: [ACCENT, CYAN, EMERALD, AMBER, "#a78bfa", "#f472b6"][i],
  }));

  return (
    <Section title="Pipeline Funnel" icon={<BarChart3 size={15} />}>
      <ResponsiveContainer width="100%" height={240}>
        <FunnelChart>
          <Tooltip content={<ChartTooltip />} />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList
              position="right"
              content={({ value, name }: any) => (
                <text className="text-xs" fill="var(--color-text-muted)" fontSize={11}>
                  {name}: {value}
                </text>
              )}
            />
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Health distribution ───────────────────────────────────────────────────
function HealthPie({ accounts }: { accounts: ClientRecord[] }) {
  const bands = ["excellent", "good", "fair", "poor", "critical"] as const;
  const colors = [EMERALD, CYAN, AMBER, ACCENT, RED];

  const data = bands.map((b, i) => ({
    name: b.charAt(0).toUpperCase() + b.slice(1),
    value: accounts.filter((a) => a.healthBand === b).length,
    color: colors[i],
  })).filter((d) => d.value > 0);

  return (
    <Section title="Health Distribution" icon={<PieIcon size={15} />}>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="60%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
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
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
              <span className="text-[var(--color-text-muted)]">{d.name}</span>
              <span className="font-mono text-[var(--color-text)] ml-auto pl-4">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Score distribution bar chart ─────────────────────────────────────────
function ScoreDistribution({ accounts }: { accounts: ClientRecord[] }) {
  const buckets = [
    { label: "0–20", min: 0, max: 20 },
    { label: "21–40", min: 21, max: 40 },
    { label: "41–60", min: 41, max: 60 },
    { label: "61–80", min: 61, max: 80 },
    { label: "81–100", min: 81, max: 100 },
  ];

  const data = buckets.map((b) => ({
    range: b.label,
    count: accounts.filter((a) => {
      const s = a.audit?.totalScore ?? 0;
      return s >= b.min && s <= b.max;
    }).length,
  }));

  return (
    <Section title="Score Distribution" icon={<BarChart3 size={15} />}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="range" tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="count" name="Leads" fill={ACCENT} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Pipeline value by status ──────────────────────────────────────────────
function ValueByStatus({ accounts }: { accounts: ClientRecord[] }) {
  const data = STATUS_ORDER.slice(0, 6).map((s) => ({
    status: STATUS_LABELS[s],
    value: accounts
      .filter((a) => a.status === s)
      .reduce((sum, a) => sum + (a.metrics?.estimatedValue ?? 0), 0),
  })).filter((d) => d.value > 0);

  return (
    <Section title="Pipeline Value by Stage" icon={<Activity size={15} />}>
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
          <YAxis dataKey="status" type="category" tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" name="Pipeline Value" fill={EMERALD} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ─── Top leads table ───────────────────────────────────────────────────────
function TopLeads({ accounts }: { accounts: ClientRecord[] }) {
  const top = [...accounts]
    .sort((a, b) => (b.audit?.totalScore ?? 0) - (a.audit?.totalScore ?? 0))
    .slice(0, 10);

  return (
    <Section title="Top Leads by Score" icon={<TrendingUp size={15} />}>
      <div className="space-y-2">
        {top.map((a, i) => (
          <div key={a.id} className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--color-text-muted)] w-4">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--color-text)] truncate">{a.businessName}</div>
              <div className="text-xs text-[var(--color-text-muted)] truncate">{a.businessType} · {a.area}</div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {a.metrics?.estimatedValue != null && (
                <span className="text-xs font-mono text-emerald-400">£{Math.round(a.metrics.estimatedValue).toLocaleString()}</span>
              )}
              <span className="font-mono text-sm font-bold text-[var(--color-accent)]">{a.audit?.totalScore ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Analytics() {
  const { state, isLoading } = useAppStore();
  const accounts = state?.accounts ?? [];
  const metrics = state?.metrics;

  const avgScore = useMemo(() => {
    const scored = accounts.filter((a) => a.audit?.totalScore != null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((s, a) => s + (a.audit!.totalScore!), 0) / scored.length);
  }, [accounts]);

  const wonAccounts = accounts.filter((a) => a.status === "won");
  const wonValue = wonAccounts.reduce((s, a) => s + (a.metrics?.estimatedValue ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Analytics</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Pipeline intelligence across {accounts.length} accounts</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Pipeline"
              value={`£${Math.round(metrics?.weightedPipeline ?? 0).toLocaleString()}`}
              icon={<PoundSterling size={18} />}
            />
            <StatCard
              label="Won Value"
              value={`£${Math.round(wonValue).toLocaleString()}`}
              icon={<TrendingUp size={18} />}
              trend={wonAccounts.length ? `${wonAccounts.length} deal${wonAccounts.length === 1 ? "" : "s"} closed` : undefined}
            />
            <StatCard
              label="Reply Rate"
              value={metrics?.qualifiedLeads
                ? `${Math.round(((metrics.repliedAccounts ?? 0) / metrics.qualifiedLeads) * 100)}%`
                : "—"
              }
              icon={<MessageSquare size={18} />}
            />
            <StatCard
              label="Avg Audit Score"
              value={`${avgScore}/100`}
              icon={<BarChart3 size={18} />}
            />
          </>
        )}
      </div>

      {/* Charts grid */}
      {!isLoading && accounts.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PipelineFunnel accounts={accounts} />
            <HealthPie accounts={accounts} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScoreDistribution accounts={accounts} />
            <ValueByStatus accounts={accounts} />
          </div>
          <TopLeads accounts={accounts} />
        </>
      )}

      {!isLoading && accounts.length === 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-16 text-center">
          <BarChart3 size={40} className="text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)]">No data yet. Run the pipeline to generate analytics.</p>
        </div>
      )}
    </div>
  );
}
