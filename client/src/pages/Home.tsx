import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Gauge,
  MailCheck,
  MessageSquare,
  Microscope,
  Radio,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import { useTime } from "@/hooks/useTime";
import { useAppStore } from "@/stores/appStore";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { ClientRecord, DashboardMetrics } from "@/types";

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-GB");

function money(value: number | null | undefined) {
  return currency.format(Math.max(0, Math.round(value ?? 0)));
}

function shortTime(value: string | null | undefined) {
  if (!value) return "No activity";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function statusLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function stageColor(status: string) {
  if (["won", "booked", "replied"].includes(status)) return "var(--color-success)";
  if (["proposal", "in-follow-up", "ready-to-send"].includes(status)) return "var(--color-bronze)";
  if (["lost", "blocked"].includes(status)) return "var(--color-danger)";
  return "var(--color-cyan)";
}

function metricDelta(label: string, value: number) {
  if (!value) return "No movement logged";
  return label;
}

function CommandHero({
  metrics,
  accounts,
}: {
  metrics: DashboardMetrics | undefined;
  accounts: ClientRecord[];
}) {
  const stages = [
    {
      label: "Discover",
      sub: `${number.format(metrics?.totalProspects ?? accounts.length)} found`,
      icon: <Target size={24} />,
      to: "/leads",
    },
    {
      label: "Audit",
      sub: `${number.format(accounts.filter((item) => (item.audit?.totalScore ?? 0) > 0).length)} scored`,
      icon: <Microscope size={24} />,
      to: "/leads",
    },
    {
      label: "Demo",
      sub: `${number.format(metrics?.demosBuilt ?? 0)} ready`,
      icon: <Gauge size={24} />,
      to: "/leads",
    },
    {
      label: "Outreach",
      sub: `${number.format(metrics?.emailDraftsReady ?? 0)} drafts`,
      icon: <Send size={24} />,
      to: "/schedule",
    },
    {
      label: "Close",
      sub: `${number.format(metrics?.proposalStage ?? 0)} proposals`,
      icon: <Trophy size={24} />,
      to: "/analytics",
    },
  ];

  return (
    <section className="command-hero">
      <div className="command-hero__top">
        <div>
          <div className="eyebrow">Founder Command Room</div>
          <h1>Execute today. <span>Compound forever.</span></h1>
          <p>AI agents running. Pipeline building. Revenue compounding.</p>
        </div>
        <Link to="/settings" className="gold-button">
          <Clock3 size={16} />
          Update log
        </Link>
      </div>

      <div className="pipeline-strip" aria-label="Pipeline stages">
        {stages.map((stage, index) => (
          <Link className="pipeline-stage" to={stage.to} key={stage.label}>
            <div className="pipeline-stage__icon">{stage.icon}</div>
            <div>
              <strong>{stage.label}</strong>
              <span>{stage.sub}</span>
            </div>
            {index < stages.length - 1 && <i />}
          </Link>
        ))}
      </div>

      <div className="live-ledger">
        <span><b /> Pipeline ready</span>
        <span>{number.format(metrics?.qualifiedLeads ?? accounts.length)} qualified leads</span>
        <span>{money(metrics?.weightedPipeline)} pipeline value</span>
        <span>{number.format(metrics?.liveActivityCount ?? 0)} live activities</span>
      </div>
    </section>
  );
}

function MetricPanel({
  label,
  value,
  sub,
  tone = "cyan",
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "cyan" | "bronze" | "green" | "red" | "cream";
  icon: ReactNode;
}) {
  return (
    <article className={`metric-panel metric-panel--${tone}`}>
      <div className="panel-heading">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
      <div className="micro-line">
        <span />
      </div>
    </article>
  );
}

function MetricsGrid({ accounts }: { accounts: ClientRecord[] }) {
  const { state } = useAppStore();
  const metrics = state?.metrics;
  const overdueTasks = accounts.flatMap((account) =>
    (account.tasks ?? []).filter((task) => task.status !== "done" && new Date(task.dueDate).getTime() < Date.now()).map((task) => ({ account, task })),
  );
  const activeDeals = accounts.filter((account) => !["lost", "won"].includes(account.accountStatus));
  const revenuePressure = overdueTasks.reduce((sum, item) => sum + (item.account.valueEstimate ?? 0), 0);

  return (
    <section className="metric-grid">
      <MetricPanel
        label="Qualified leads"
        value={number.format(metrics?.qualifiedLeads ?? accounts.length)}
        sub={metricDelta(`${metrics?.highPriorityFollowUps ?? 0} high-priority follow-ups`, metrics?.highPriorityFollowUps ?? 0)}
        tone="cyan"
        icon={<Users size={16} />}
      />
      <MetricPanel
        label="Pipeline value"
        value={money(metrics?.weightedPipeline)}
        sub={`${number.format(activeDeals.length)} active accounts`}
        tone="bronze"
        icon={<CircleDollarSign size={16} />}
      />
      <MetricPanel
        label="Deals in progress"
        value={number.format(activeDeals.length)}
        sub={`${number.format(metrics?.proposalStage ?? 0)} in proposal stage`}
        tone="green"
        icon={<BriefcaseBusiness size={16} />}
      />
      <MetricPanel
        label="Revenue pressure"
        value={money(revenuePressure)}
        sub={`${number.format(overdueTasks.length)} overdue tasks`}
        tone="red"
        icon={<Zap size={16} />}
      />
      <MetricPanel
        label="Win rate"
        value={`${number.format(metrics?.bookedRate ?? 0)}%`}
        sub={`${number.format(metrics?.repliedAccounts ?? 0)} replies logged`}
        tone="green"
        icon={<TrendingUp size={16} />}
      />
    </section>
  );
}

function AgentLedger() {
  const { liveEvents } = useAppStore();
  const grouped = new Map<string, typeof liveEvents>();

  liveEvents.forEach((event) => {
    const key = event.agentId || event.agentName || "system";
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  });

  const rows = Array.from(grouped.entries())
    .map(([id, events]) => {
      const latest = events[0];
      return {
        id,
        name: latest.agentName || id,
        role: latest.type || "system",
        status: latest.type === "error" ? "Blocked" : "Active",
        activity: latest.content || "Live event received",
        lastAction: latest.timestamp,
        output: `${events.length} event${events.length === 1 ? "" : "s"}`,
      };
    })
    .slice(0, 8);

  return (
    <section className="ops-card ledger-card">
      <div className="section-title">
        <span><Radio size={15} /> Live Agents Ledger</span>
        <Link to="/agents">View all agents <ArrowRight size={13} /></Link>
      </div>
      <div className="ledger-table">
        <div className="ledger-head">
          <span>Agent</span>
          <span>Role</span>
          <span>Status</span>
          <span>Activity</span>
          <span>Last action</span>
          <span>Output</span>
        </div>
        {rows.map((row) => (
          <div className="ledger-row" key={row.id}>
            <span><Bot size={16} /> {row.name}</span>
            <span>{statusLabel(row.role)}</span>
            <span className={row.status === "Blocked" ? "status-pill status-pill--red" : "status-pill"}>{row.status}</span>
            <span>{row.activity}</span>
            <span>{shortTime(row.lastAction)}</span>
            <span>{row.output}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="empty-state">
            No live agent events have arrived in this session yet.
          </div>
        )}
      </div>
    </section>
  );
}

function QualifiedLeads({ accounts }: { accounts: ClientRecord[] }) {
  const leads = [...accounts]
    .sort((a, b) => (b.valueEstimate ?? 0) - (a.valueEstimate ?? 0))
    .slice(0, 8);

  return (
    <section className="ops-card leads-card">
      <div className="section-title">
        <span><ShieldCheck size={15} /> Qualified Leads</span>
        <Link to="/leads">View all leads <ArrowRight size={13} /></Link>
      </div>
      <div className="lead-table">
        <div className="lead-head">
          <span>Lead</span>
          <span>Score</span>
          <span>Value</span>
          <span>Stage</span>
          <span>Due</span>
        </div>
        {leads.map((lead) => (
          <Link to={`/leads/${lead.id}`} className="lead-row" key={lead.id}>
            <span>
              <strong>{lead.businessName}</strong>
              <small>{lead.businessType} · {lead.area}</small>
            </span>
            <span className="score-chip">{lead.audit?.totalScore ?? 0}</span>
            <span>{money(lead.valueEstimate)}</span>
            <span className="stage-chip" style={{ "--stage-color": stageColor(lead.accountStatus) } as CSSProperties}>
              {statusLabel(lead.accountStatus)}
            </span>
            <span>{shortDate(lead.followUp?.dueDate)}</span>
          </Link>
        ))}
        {leads.length === 0 && (
          <div className="empty-state">No qualified leads yet. Run the pipeline to populate the live CRM.</div>
        )}
      </div>
    </section>
  );
}

function Approvals({ accounts }: { accounts: ClientRecord[] }) {
  const approvals = accounts
    .flatMap((account) => [
      ...(account.proposals ?? [])
        .filter((proposal) => ["draft", "sent", "negotiating"].includes(proposal.status))
        .map((proposal) => ({
          id: proposal.id,
          account,
          title: proposal.title,
          value: proposal.price,
          scope: proposal.packageName,
          priority: proposal.price >= 5000 ? "High" : "Medium",
        })),
      ...(account.accountStatus === "ready-to-send"
        ? [{
            id: `${account.id}-email-approval`,
            account,
            title: "Review outreach draft",
            value: account.valueEstimate,
            scope: account.aiSummary?.nextBestAction ?? account.followUp?.nextStep ?? "Outbound draft",
            priority: account.followUp?.priority === "high" ? "High" : "Medium",
          }]
        : []),
    ])
    .slice(0, 3);

  return (
    <section className="ops-card approvals-card">
      <div className="section-title">
        <span>Approvals <b>{approvals.length}</b></span>
      </div>
      <div className="approval-list">
        {approvals.map((item) => (
          <article className="approval-item" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>Client: {item.account.businessName}</span>
              <span>Scope: {item.scope}</span>
              <span>Value: {money(item.value)}</span>
            </div>
            <div>
              <em>{item.priority}</em>
              <Link to={`/leads/${item.account.id}`} aria-label={`Review ${item.title}`}>
                <CheckCircle2 size={18} />
              </Link>
            </div>
          </article>
        ))}
        {approvals.length === 0 && (
          <div className="empty-state empty-state--tight">No approval-gated work is waiting.</div>
        )}
      </div>
      <Link to="/leads" className="full-width-link">View approval sources <ArrowRight size={13} /></Link>
    </section>
  );
}

function NextActions({ accounts }: { accounts: ClientRecord[] }) {
  const tasks = accounts
    .flatMap((account) =>
      (account.tasks ?? [])
        .filter((task) => task.status !== "done")
        .map((task) => ({ account, task })),
    )
    .sort((a, b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime())
    .slice(0, 4);

  return (
    <section className="ops-card next-card">
      <div className="section-title">
        <span><CalendarClock size={15} /> Next Actions</span>
      </div>
      <div className="next-list">
        {tasks.map(({ account, task }) => (
          <Link to={`/leads/${account.id}`} className="next-item" key={task.id}>
            <i><FileText size={18} /></i>
            <span>
              <strong>{task.title}</strong>
              <small>{task.description || account.businessName}</small>
              <em>Due {shortDate(task.dueDate)}</em>
            </span>
            <ArrowRight size={16} />
          </Link>
        ))}
        {tasks.length === 0 && (
          <div className="empty-state empty-state--tight">No open tasks are in the live CRM.</div>
        )}
      </div>
      <Link to="/schedule" className="full-width-link">View all tasks <ArrowRight size={13} /></Link>
    </section>
  );
}

function SystemStatus() {
  const { state } = useAppStore();
  const sync = state?.sync;
  const rows = [
    ["API Gateway", "Online", true],
    ["Data Sync", sync?.lastPipelineSync ? "Live" : "Ready", true],
    ["Email Connector", sync?.emailConnectorReady ? "Connected" : "Setup needed", Boolean(sync?.emailConnectorReady)],
    ["Call Connector", sync?.callConnectorReady ? "Connected" : "Setup needed", Boolean(sync?.callConnectorReady)],
    ["Stripe", sync?.stripeConnectorReady ? "Connected" : "Setup needed", Boolean(sync?.stripeConnectorReady)],
  ] as const;

  return (
    <section className="system-status">
      <div className="eyebrow">System Status</div>
      {rows.map(([label, value, ok]) => (
        <div className="system-row" key={label}>
          <span>{label}</span>
          <strong className={ok ? "" : "muted"}>{value}</strong>
        </div>
      ))}
      <Link to="/settings" className="full-width-link">View system health <ArrowRight size={13} /></Link>
    </section>
  );
}

function BottomMantra({ accounts }: { accounts: ClientRecord[] }) {
  const { state } = useAppStore();
  const pipeline = state?.metrics.weightedPipeline ?? 0;
  const target = Math.max(pipeline, accounts.reduce((sum, item) => sum + (item.valueEstimate ?? 0), 0));
  const progress = target ? Math.round((pipeline / target) * 100) : 0;

  return (
    <footer className="command-footer">
      <span>Discipline builds the system. The system builds freedom.</span>
      <b />
      <span>Focus: Revenue</span>
      <b />
      <span>Target: {money(target)}</span>
      <b />
      <span>Progress: {progress}% <i><em style={{ width: `${Math.min(progress, 100)}%` }} /></i></span>
      <strong>Locked in. Leveraged. Living free.</strong>
    </footer>
  );
}

export function Home() {
  const { state, loading } = useAppStore();
  useTime();

  const accounts = state?.clients ?? [];
  const metrics = state?.metrics;

  if (loading && !state) {
    return (
      <div className="space-y-5">
        <SkeletonCard />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="hamid-command">
      <div className="command-main">
        <CommandHero metrics={metrics} accounts={accounts} />
        <MetricsGrid accounts={accounts} />
        <div className="command-grid">
          <AgentLedger />
          <QualifiedLeads accounts={accounts} />
          <div className="side-stack">
            <Approvals accounts={accounts} />
            <NextActions accounts={accounts} />
          </div>
        </div>
      </div>
      <aside className="right-rail">
        <SystemStatus />
        <section className="system-status os-card">
          <div className="os-mark"><Sparkles size={18} /> HAMID.OS</div>
          <div className="system-row">
            <span>Mode</span>
            <strong>Founder</strong>
          </div>
          <div className="system-row">
            <span>Updated</span>
            <strong>{shortTime(state?.generatedAt)}</strong>
          </div>
        </section>
      </aside>
      <BottomMantra accounts={accounts} />
    </div>
  );
}
