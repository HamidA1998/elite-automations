import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  Gauge,
  GitBranch,
  HeartPulse,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  fetchClient360,
  fetchDashboardState,
  fetchMetrics,
  fetchOpenClawAgents,
  fetchOpenClawApprovals,
} from "@/services/api";
import { buildMissionCards, type MissionCard, type MissionStage } from "@/os/os-spine";

const STAGES: Array<{ id: MissionStage; label: string; description: string }> = [
  { id: "inbox", label: "Inbox", description: "New work and raw signals" },
  { id: "planning", label: "Planning", description: "Needs sequencing or owner" },
  { id: "executing", label: "Executing", description: "Agent or workflow active" },
  { id: "reviewing", label: "Reviewing", description: "Needs Hamid or QA" },
  { id: "done", label: "Done", description: "Completed or closed" },
];

const priorityVariant: Record<MissionCard["priority"], "success" | "warning" | "error" | "info" | "neutral"> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "error",
};

const kindIcon: Record<MissionCard["kind"], typeof CircleDot> = {
  client: TrendingUp,
  agent: Bot,
  approval: Shield,
  system: Gauge,
};

function formatRelative(value: string | null): string {
  if (!value) return "No activity";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function createEmptyBoard(): Record<MissionStage, MissionCard[]> {
  return {
    inbox: [],
    planning: [],
    executing: [],
    reviewing: [],
    done: [],
  };
}

function MissionWorkCard({ card }: { card: MissionCard }) {
  const Icon = kindIcon[card.kind];
  const content = (
    <div className="group relative flex flex-col gap-3 overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_86%,transparent)] px-4 py-4 transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.28)] focus-within:border-[var(--color-accent)]">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent)]/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-accent)]">
          <Icon size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityVariant[card.priority]}>{card.priority}</Badge>
            {card.stuck ? <Badge variant="error">stuck</Badge> : null}
          </div>
          <div>
            <p
              className="break-words text-[13.5px] font-semibold leading-[1.3] text-[var(--color-text)]"
              title={card.title}
            >
              {card.title}
            </p>
            <p
              className="mt-1 break-words text-xs leading-[1.5] text-[var(--color-text-muted)]"
              title={card.subtitle}
            >
              {card.subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="min-w-0 rounded-[16px] bg-[var(--color-surface)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Owner</p>
          <p className="metric-mono mt-0.5 break-words text-[var(--color-text)]" title={card.owner}>
            {card.owner}
          </p>
        </div>
        <div className="min-w-0 rounded-[16px] bg-[var(--color-surface)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Last action</p>
          <p className="metric-mono mt-0.5 break-words text-[var(--color-text)]">
            {formatRelative(card.lastActionAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--color-border)] pt-3">
        <p className="min-w-0 flex-1 break-words text-[11px] leading-[1.45] text-[var(--color-text-muted)]" title={card.impact}>
          {card.impact}
        </p>
        <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">
          {card.statusLabel}
        </p>
      </div>
    </div>
  );

  return card.href ? (
    <Link
      to={card.href}
      className="block rounded-[22px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      {content}
    </Link>
  ) : (
    content
  );
}

export function OpsCommandPage() {
  const client360Query = useQuery({
    queryKey: ["client-360"],
    queryFn: fetchClient360,
    staleTime: 60_000,
  });
  const agentsQuery = useQuery({
    queryKey: ["openclaw-agents"],
    queryFn: fetchOpenClawAgents,
    staleTime: 60_000,
  });
  const approvalsQuery = useQuery({
    queryKey: ["openclaw-approvals"],
    queryFn: fetchOpenClawApprovals,
    staleTime: 30_000,
  });
  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    staleTime: 60_000,
  });
  const stateQuery = useQuery({
    queryKey: ["dashboard-state"],
    queryFn: fetchDashboardState,
    staleTime: 60_000,
  });

  const cards = useMemo(
    () =>
      buildMissionCards({
        accounts: client360Query.data?.accounts ?? [],
        agents: agentsQuery.data?.agents ?? [],
        approvals: approvalsQuery.data ?? null,
      }),
    [agentsQuery.data?.agents, approvalsQuery.data, client360Query.data?.accounts],
  );

  const board = useMemo(
    () =>
      cards.reduce<Record<MissionStage, MissionCard[]>>((acc, card) => {
        acc[card.stage].push(card);
        return acc;
      }, createEmptyBoard()),
    [cards],
  );

  const stuckCards = cards.filter((card) => card.stuck);
  const criticalCards = cards.filter((card) => card.priority === "critical");
  const pendingApprovals = approvalsQuery.data?.pending.length ?? 0;
  const activeAgents = (agentsQuery.data?.agents ?? []).filter((agent) => agent.status !== "idle");
  const connectorCount = [
    stateQuery.data?.sync.emailConnectorReady,
    stateQuery.data?.sync.callConnectorReady,
    stateQuery.data?.sync.stripeConnectorReady,
  ].filter(Boolean).length;

  return (
    <PageWrapper
      eyebrow="HAMID.OS · MISSION CONTROL"
      title="One board for every moving part."
      description="Live work, stuck sessions, approvals, agent ownership, pipeline pressure, and system health in one operating surface."
      actions={
        <>
          <Link to="/ops/approvals">
            <Button variant={pendingApprovals > 0 ? "primary" : "secondary"}>
              <Shield size={16} />
              {pendingApprovals} approvals
            </Button>
          </Link>
          <Link to="/agents">
            <Button variant="secondary">
              <Bot size={16} />
              Agent fleet
            </Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <section className="ops-canvas p-4 md:p-5">
          <div className="relative z-[1] space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-5">
                <p className="section-kicker">Active work</p>
                <p className="metric-mono metric-value-hero mt-3 font-semibold">{cards.length}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Objects in the OS board</p>
              </Card>
              <Card className="p-5">
                <p className="section-kicker">Stuck</p>
                <p className="metric-mono metric-value-hero mt-3 font-semibold text-[var(--color-error)]">{stuckCards.length}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">No activity or overdue</p>
              </Card>
              <Card className="p-5">
                <p className="section-kicker">Agent load</p>
                <p className="metric-mono metric-value-hero mt-3 font-semibold text-[var(--color-accent)]">{activeAgents.length}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Agents thinking or running</p>
              </Card>
              <Card className="p-5">
                <p className="section-kicker">Weighted pipeline</p>
                <p className="metric-mono metric-value-hero mt-3 font-semibold">
                  £{Math.round(metricsQuery.data?.weightedPipeline ?? 0).toLocaleString("en-GB")}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Money closest to close</p>
              </Card>
            </div>

            {(criticalCards.length > 0 || pendingApprovals > 0) && (
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[26px] border border-[color-mix(in_oklab,var(--color-error)_34%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-error)_9%,var(--color-surface))] px-5 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="mt-0.5 text-[var(--color-error)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">Attention required</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                        {criticalCards.length} critical item{criticalCards.length === 1 ? "" : "s"} and {pendingApprovals} approval{pendingApprovals === 1 ? "" : "s"} need review before the system takes external action.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[26px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="section-kicker">Guardrails</p>
                      <p className="mt-1 text-sm font-semibold">Approval-first operations</p>
                    </div>
                    <Shield size={20} className="text-[var(--color-warning)]" />
                  </div>
                </div>
              </div>
            )}

            <div className="-mx-1 overflow-x-auto pb-2 app-scroll">
              <div className="grid min-w-full grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 px-1 md:auto-cols-[minmax(280px,1fr)] xl:grid-flow-row xl:auto-cols-auto xl:grid-cols-5">
                {STAGES.map((stage) => (
                  <div key={stage.id} className="ops-zone flex min-h-[420px] flex-col p-3">
                    <div className="mb-3 flex items-start justify-between gap-3 px-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{stage.label}</p>
                        <p
                          className="mt-0.5 break-words text-[11px] leading-4 text-[var(--color-text-muted)]"
                          title={stage.description}
                        >
                          {stage.description}
                        </p>
                      </div>
                      <Badge variant="neutral">{board[stage.id].length}</Badge>
                    </div>
                    <div className="flex-1 space-y-3">
                      {board[stage.id].length > 0 ? (
                        board[stage.id].map((card) => <MissionWorkCard key={card.id} card={card} />)
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
                          <span className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                            <CheckCircle2 size={18} />
                          </span>
                          <p className="mt-3 text-xs font-semibold text-[var(--color-text)]">Clear</p>
                          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">No work in this lane.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker">Activity timeline</p>
                <h2 className="mt-2 text-xl font-semibold">Latest operational signals</h2>
              </div>
              <Clock3 size={20} className="text-[var(--color-text-muted)]" />
            </div>
            <div className="mt-5 space-y-3">
              {cards.slice(0, 8).map((card) => (
                <Link
                  key={`timeline-${card.id}`}
                  to={card.href ?? "/ops"}
                  className="group flex items-start gap-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:shadow-[0_10px_32px_rgba(0,0,0,0.2)]"
                >
                  <span className="mt-1.5 inline-flex size-2.5 shrink-0 rounded-full bg-[var(--color-accent)] shadow-[0_0_18px_var(--color-accent-glow)] transition-transform group-hover:scale-110" />
                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-2 break-words text-sm font-semibold leading-snug text-[var(--color-text)]"
                      title={card.title}
                    >
                      {card.title}
                    </p>
                    <p className="mt-1 break-words text-xs leading-[1.5] text-[var(--color-text-muted)]">
                      {card.owner} · {card.stage} · {formatRelative(card.lastActionAt)}
                    </p>
                  </div>
                  <div className="shrink-0 self-start">
                    {card.stuck ? <Badge variant="error">stuck</Badge> : <Badge variant="neutral">{card.kind}</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker">System health</p>
                <h2 className="mt-2 text-xl font-semibold">Connectors and automation</h2>
              </div>
              <HeartPulse size={20} className="text-[var(--color-success)]" />
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Email connector", ok: stateQuery.data?.sync.emailConnectorReady ?? false },
                { label: "Call connector", ok: stateQuery.data?.sync.callConnectorReady ?? false },
                { label: "Stripe connector", ok: stateQuery.data?.sync.stripeConnectorReady ?? false },
              ].map((connector) => (
                <div key={connector.label} className="flex items-center justify-between rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex size-2.5 rounded-full ${connector.ok ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"}`} />
                    <p className="text-sm font-medium">{connector.label}</p>
                  </div>
                  <Badge variant={connector.ok ? "success" : "warning"}>{connector.ok ? "connected" : "configure"}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
              <div className="flex items-center justify-between">
                <p className="section-kicker">Readiness</p>
                <Badge variant={connectorCount === 3 ? "success" : "warning"}>{connectorCount}/3</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                Mission Control is strongest when Gmail, Twilio/ElevenLabs, Stripe, Firecrawl, Apify, and OpenClaw all write events into one timeline.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/ops/health">
                <Button variant="secondary">
                  <Gauge size={16} />
                  Health
                </Button>
              </Link>
              <Link to="/ops/workflows">
                <Button variant="secondary">
                  <GitBranch size={16} />
                  Workflows
                </Button>
              </Link>
              <Link to="/ai/scraper">
                <Button variant="secondary">
                  <Sparkles size={16} />
                  Research tools
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </PageWrapper>
  );
}
