import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  DollarSign,
  Search,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { fetchClient360, fetchDashboardState, fetchMetrics } from "@/services/api";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtGbp(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function getPriorityVariant(priority: string): "error" | "warning" | "neutral" {
  const n = priority.toLowerCase();
  if (n === "high" || n === "critical") return "error";
  if (n === "medium") return "warning";
  return "neutral";
}

function daysSince(iso: string | null) {
  if (!iso) return 999;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

const STATUS_COLORS: Record<string, string> = {
  "researched": "#6366f1",
  "ready-to-send": "#06b6d4",
  "contacted":  "#f59e0b",
  "in-follow-up": "#a78bfa",
  "replied":    "#22c55e",
  "proposal":   "#f97316",
  "won":        "#10b981",
  "lost":       "#ef4444",
  "critical":   "#ef4444",
  "weak":       "#f59e0b",
  "workable":   "#06b6d4",
  "stable":     "#10b981",
};

function statusColor(status: string) {
  return STATUS_COLORS[status.toLowerCase()] ?? "#64748b";
}

// ─── Custom tooltip for charts ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[var(--color-text)]">{label}</p>
      <p className="text-[var(--color-accent)]">{payload[0].value} leads</p>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CRMOverviewPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-state"],
    queryFn: fetchDashboardState,
    staleTime: 60_000,
  });
  const client360Query = useQuery({
    queryKey: ["client-360"],
    queryFn: fetchClient360,
    staleTime: 60_000,
  });
  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    staleTime: 60_000,
  });

  const metrics = data?.metrics;
  const crmMetrics = metricsQuery.data;
  const client360 = client360Query.data;
  const accounts = client360?.accounts ?? [];

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      [a.clientId, a.businessName, a.businessType, a.area, a.accountStatus, a.lifecycle, a.nextBestAction, ...a.riskFlags].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [accounts, search]);

  const actionQueue = useMemo(
    () =>
      [...accounts]
        .sort((a, b) => {
          if (a.overdueTasks !== b.overdueTasks) return b.overdueTasks - a.overdueTasks;
          if (a.riskFlags.length !== b.riskFlags.length) return b.riskFlags.length - a.riskFlags.length;
          const ao = a.dueDate ? new Date(a.dueDate).getTime() < Date.now() : false;
          const bo = b.dueDate ? new Date(b.dueDate).getTime() < Date.now() : false;
          if (ao !== bo) return ao ? -1 : 1;
          return daysSince(b.lastTimelineEventAt) - daysSince(a.lastTimelineEventAt);
        })
        .slice(0, 5),
    [accounts],
  );

  const topDeals = useMemo(
    () => [...accounts].sort((a, b) => b.dealValue - a.dealValue).slice(0, 5),
    [accounts],
  );

  // Pipeline funnel chart data
  const funnelData = [
    { name: "Prospects",  value: metrics?.totalProspects ?? 0,     fill: "#64748b" },
    { name: "Qualified",  value: metrics?.qualifiedLeads ?? 0,     fill: "#f59e0b" },
    { name: "Proposal",   value: metrics?.proposalStage ?? 0,      fill: "#f97316" },
    { name: "Won",        value: crmMetrics?.wonDeals ?? 0,        fill: "#22c55e" },
  ];

  // Status pie chart
  const statusCounts = useMemo(() => {
    return (client360?.charts.statusDistribution ?? []).map((entry) => ({
      name: entry.label,
      value: entry.value,
      fill: statusColor(entry.label),
    }));
  }, [client360]);

  // KPI cards
  const kpis = [
    { label: "Client files",      value: client360?.totals.totalAccounts ?? metrics?.totalProspects ?? "—", color: "var(--color-accent)", icon: Users },
    { label: "Contact records",   value: client360?.totals.totalContacts ?? "—",       color: "#22c55e",            icon: BriefcaseBusiness },
    { label: "Open tasks",        value: client360?.totals.openTasks ?? "—",           color: "#f59e0b",            icon: Clock3 },
    { label: "Overdue work",      value: client360?.totals.overdueTasks ?? "—",        color: "#ef4444",            icon: Zap },
    { label: "Weighted pipeline", value: client360 ? fmtGbp(client360.totals.weightedPipelineValue * 100) : crmMetrics ? fmtGbp(crmMetrics.weightedPipeline * 100) : "—", color: "#a78bfa", icon: DollarSign },
    { label: "Proposal value",    value: client360 ? fmtGbp(client360.totals.proposalValue * 100) : "—", color: "#10b981", icon: DollarSign },
    { label: "Stale files",       value: client360?.totals.staleAccounts ?? "—",       color: "#f97316",            icon: TrendingUp },
    { label: "Timeline events",   value: client360?.totals.timelineEvents ?? "—",      color: "#06b6d4",            icon: Activity },
  ];

  return (
    <PageWrapper
      eyebrow="HAMID.OS · CRM"
      title="CRM COMMAND"
      description="Pipeline intelligence, deal velocity, and account management"
      actions={
        <div className="flex items-center gap-3">
          {[
            { to: "/crm/contacts", label: "Contacts" },
            { to: "/crm/pipeline", label: "Pipeline" },
            { to: "/crm/activity", label: "Activity" },
          ].map(({ to, label }) => (
            <Link key={to} to={to} className="text-xs text-[var(--color-accent)] hover:underline">
              {label} →
            </Link>
          ))}
        </div>
      }
    >
      <div className="space-y-6">

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {kpis.map(({ label, value, color, icon: Icon }) => (
            <Card key={label} className="metric-panel p-4 space-y-2">
              <span
                className="inline-flex size-9 items-center justify-center rounded-[14px]"
                style={{ background: `${color}22`, color }}
              >
                <Icon size={14} />
              </span>
              <p className="metric-mono metric-value-fit font-bold" style={{ color }}>
                {isLoading || metricsQuery.isLoading || client360Query.isLoading ? "—" : value}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] leading-snug">{label}</p>
            </Card>
          ))}
        </div>

        <Card className="grid gap-4 p-5 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <p className="section-kicker">Client 360 spine</p>
            <h2 className="display-title !text-[var(--text-lg)]">Every file, touch, task, and commercial signal in one operating layer.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-muted)]">
              This view now reads the full account dossier: contacts, calls, timeline events, notes, proposals,
              stale movement, relationship score, and next action. Mail, Stripe, calls, scraping, and delivery will plug into this same record.
            </p>
          </div>
          <div className="metric-panel rounded-[22px] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Hot accounts</p>
            <p className="metric-mono metric-value-hero mt-2 font-semibold text-[var(--color-success)]">{client360?.signals.hotAccounts.length ?? 0}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Replies, proposals, won files, or relationship score above 75.</p>
          </div>
          <div className="metric-panel rounded-[22px] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Dossier gaps</p>
            <p className="metric-mono metric-value-hero mt-2 font-semibold text-[var(--color-warning)]">{client360?.signals.incompleteDossiers.length ?? 0}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Files under 60% completeness that need contact, memory, proposal, or activity coverage.</p>
          </div>
        </Card>

        {/* Charts row */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">

          {/* Funnel chart */}
          <Card className="p-6 space-y-4">
            <div>
              <p className="section-kicker">Pipeline funnel</p>
              <h2 className="display-title !text-[var(--text-lg)]">Lead conversion stages</h2>
            </div>
            {isLoading ? (
              <div className="h-48 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Status pie */}
          <Card className="p-6 space-y-4">
            <div>
              <p className="section-kicker">Account status</p>
              <h2 className="display-title !text-[var(--text-lg)]">Portfolio breakdown</h2>
            </div>
            {client360Query.isLoading ? (
              <div className="h-48 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
            ) : statusCounts.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-muted)]">
                No accounts yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusCounts}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusCounts.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{value}</span>}
                  />
                  <Tooltip
                    formatter={(value, name) => [String(value) + " accounts", String(name)]}
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Action queue + Top deals */}
        <div className="grid gap-6 lg:grid-cols-[1fr_0.5fr]">

          {/* Action queue */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-kicker">Action queue</p>
                <h2 className="display-title !text-[var(--text-lg)]">Needs attention now</h2>
              </div>
              <Badge variant="neutral">{actionQueue.length}</Badge>
            </div>
            <div className="space-y-3">
              {actionQueue.length ? actionQueue.map((account) => (
                <Link
                  key={account.clientId}
                  to={`/leads/${account.clientId}`}
                  className="metric-panel block rounded-[22px] p-4 transition-all hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-3)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text)]">{account.businessName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{account.clientId} · {account.area} · {account.businessType}</p>
                    </div>
                    <ArrowUpRight size={14} className="shrink-0 text-[var(--color-text-muted)] mt-0.5" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={getPriorityVariant(account.priority)}>{account.priority}</Badge>
                    <Badge variant="neutral">{account.accountStatus}</Badge>
                    <Badge variant={account.relationshipBand === "stable" ? "success" : account.relationshipBand === "workable" ? "info" : account.relationshipBand === "weak" ? "warning" : "error"}>
                      {account.relationshipScore}
                    </Badge>
                    <span className="metric-mono text-xs text-[var(--color-accent)]">{account.siteScore}/100</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Clock3 size={11} />
                    {account.daysSinceLastActivity >= 999 ? "No activity logged" : `${account.daysSinceLastActivity}d since last event`}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text-muted)]">{account.nextBestAction}</p>
                </Link>
              )) : (
                <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] px-6 py-8 text-sm text-[var(--color-text-muted)] text-center">
                  Queue is clear — all accounts are up to date.
                </div>
              )}
            </div>
          </Card>

          {/* Top deals */}
          <Card className="p-6 space-y-4">
            <div>
              <p className="section-kicker">Top deals</p>
              <h2 className="display-title !text-[var(--text-lg)]">Highest value</h2>
            </div>
            {topDeals.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No deal values set yet.</p>
            ) : (
              <div className="space-y-3">
                {topDeals.map((account, i) => (
                  <Link
                    key={account.clientId}
                    to={`/leads/${account.clientId}`}
                    className="flex items-center gap-3 py-2 border-b border-[var(--color-border)] last:border-0 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-xs font-bold metric-mono text-[var(--color-text-muted)] w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text)] truncate">{account.businessName}</p>
                      <Badge variant={getPriorityVariant(account.priority)} className="text-[9px] mt-0.5">{account.priority}</Badge>
                    </div>
                    <span className="metric-mono text-sm font-bold text-[var(--color-accent)] shrink-0">
                      £{account.dealValue.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Accounts ledger */}
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-[var(--color-border)] px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-kicker">Full ledger</p>
              <h2 className="display-title !text-[var(--text-lg)]">All accounts</h2>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by business, area, stage…"
                className="w-full rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-10 pr-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {isLoading || client360Query.isLoading ? (
              <div className="space-y-3 px-6 py-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-14 rounded-[var(--radius-xl)] animate-pulse bg-[var(--color-surface-2)]" />
                ))}
              </div>
            ) : filteredAccounts.length ? (
              filteredAccounts.map((account) => (
                <Link
                  key={account.clientId}
                  to={`/leads/${account.clientId}`}
                  className="grid gap-4 px-6 py-4 transition-colors hover:bg-[var(--color-surface-2)] md:grid-cols-[minmax(0,1.15fr)_0.72fr_0.72fr_0.45fr]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{account.businessName}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{account.clientId} · {account.businessType} · {account.area}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-[var(--color-text-muted)]">{account.primaryContact ? `${account.primaryContact.fullName} · ${account.primaryContact.role}` : "No named contact yet"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{account.accountStatus}</Badge>
                    <Badge variant={getPriorityVariant(account.priority)}>{account.priority}</Badge>
                    <Badge variant={account.relationshipBand === "stable" ? "success" : account.relationshipBand === "workable" ? "info" : account.relationshipBand === "weak" ? "warning" : "error"}>{account.relationshipScore}</Badge>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    <p>{account.openTasks} open · {account.overdueTasks} overdue · {account.dossierCompleteness}% file</p>
                    <p className="mt-0.5 line-clamp-1">{account.nextBestAction}</p>
                  </div>
                  <div className="text-right">
                    <p className="metric-mono text-sm text-[var(--color-accent)]">{account.siteScore}/100</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">£{account.dealValue.toLocaleString()}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-6 py-10 text-sm text-[var(--color-text-muted)]">
                No accounts match your search.
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}

function Activity({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
