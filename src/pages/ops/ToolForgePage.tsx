import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bot,
  Boxes,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  Hammer,
  Layers3,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchToolForge } from "@/services/api";
import type { ToolForgeCategory, ToolForgeItem, ToolForgeStatus } from "@/types/frontend";

const statusVariant: Record<ToolForgeStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  live: "success",
  partial: "info",
  "build-next": "warning",
  "needs-adapter": "error",
  planned: "neutral",
};

const statusLabel: Record<ToolForgeStatus, string> = {
  live: "live",
  partial: "partial",
  "build-next": "build next",
  "needs-adapter": "adapter needed",
  planned: "planned",
};

const categoryLabel: Record<ToolForgeCategory, string> = {
  acquisition: "Acquisition",
  outreach: "Outreach",
  delivery: "Delivery",
  client: "Client OS",
  voice: "Voice",
  finance: "Finance",
  personal: "Personal",
  ops: "Ops",
};

const categoryGlow: Record<ToolForgeCategory, string> = {
  acquisition: "from-[color-mix(in_oklab,var(--color-accent)_20%,transparent)]",
  outreach: "from-[color-mix(in_oklab,var(--color-success)_18%,transparent)]",
  delivery: "from-[color-mix(in_oklab,var(--color-warning)_18%,transparent)]",
  client: "from-[color-mix(in_oklab,var(--color-accent-2)_18%,transparent)]",
  voice: "from-[color-mix(in_oklab,var(--color-accent)_16%,transparent)]",
  finance: "from-[color-mix(in_oklab,var(--color-gold)_18%,transparent)]",
  personal: "from-[color-mix(in_oklab,var(--color-text)_8%,transparent)]",
  ops: "from-[color-mix(in_oklab,var(--color-accent-2)_16%,transparent)]",
};

function moneyPriority(tool: ToolForgeItem) {
  return tool.priority <= 1 ? "Revenue-critical" : tool.priority === 2 ? "Next leverage" : "Compounder";
}

function ToolCard({ tool }: { tool: ToolForgeItem }) {
  const primaryRoute = tool.routes[0] ?? "/ops/tools";
  return (
    <Card className="group relative min-w-0 overflow-hidden p-0">
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${categoryGlow[tool.category]} to-transparent opacity-70`} />
      <div className="relative flex h-full flex-col gap-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant[tool.status]}>{statusLabel[tool.status]}</Badge>
              <Badge variant={tool.approvalRequired ? "warning" : "neutral"}>
                {tool.approvalRequired ? "guarded" : "owned"}
              </Badge>
            </div>
            <h3 className="mt-3 break-words text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]">
              {tool.name}
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-faint)]">
              {categoryLabel[tool.category]} · {tool.ownerAgent}
            </p>
          </div>
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Wrench size={18} />
          </span>
        </div>

        <div className="space-y-3">
          <div className="rounded-[20px] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_55%,transparent)] p-4">
            <p className="section-kicker">Money function</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">{tool.moneyFunction}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] bg-[var(--color-surface)] p-3">
              <p className="section-kicker !text-[9px]">Owned core</p>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{tool.ownedCore}</p>
            </div>
            <div className="rounded-[18px] bg-[var(--color-surface)] p-3">
              <p className="section-kicker !text-[9px]">Next build</p>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{tool.nextBuild}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex flex-wrap gap-2">
            {tool.replaces.slice(0, 3).map((item) => (
              <span
                key={item}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[11px] text-[var(--color-text-muted)]"
              >
                replaces {item}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
            <div>
              <p className="metric-mono text-xs text-[var(--color-text-muted)]">{moneyPriority(tool)}</p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-faint)]">{tool.estimatedValue}</p>
            </div>
            <Link to={primaryRoute}>
              <Button variant="secondary" className="min-h-9 px-3 text-xs">
                Open
                <ArrowUpRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function BuildQueueRow({ tool, index }: { tool: ToolForgeItem; index: number }) {
  const primaryRoute = tool.routes[0] ?? "/ops/tools";
  return (
    <Link
      to={primaryRoute}
      className="group grid gap-4 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] md:grid-cols-[72px_1fr_auto]"
    >
      <div className="flex items-center gap-3 md:block">
        <span className="metric-mono inline-flex size-12 items-center justify-center rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)] text-lg font-semibold text-[var(--color-accent)]">
          {index + 1}
        </span>
        <Badge variant={statusVariant[tool.status]} className="md:mt-3">
          {statusLabel[tool.status]}
        </Badge>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-[var(--color-text)]">{tool.name}</p>
          <Badge variant="neutral">{tool.ownerAgent}</Badge>
          {tool.approvalRequired ? <Badge variant="warning">approval path</Badge> : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{tool.nextBuild}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-faint)]">{tool.moneyFunction}</p>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <p className="metric-mono text-xs text-[var(--color-text-muted)]">{categoryLabel[tool.category]}</p>
        <ArrowUpRight size={16} className="text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-accent)]" />
      </div>
    </Link>
  );
}

export function ToolForgePage() {
  const toolForgeQuery = useQuery({
    queryKey: ["operator-tool-forge"],
    queryFn: fetchToolForge,
    staleTime: 60_000,
  });

  const toolsByCategory = useMemo(() => {
    const grouped = new Map<ToolForgeCategory, ToolForgeItem[]>();
    for (const tool of toolForgeQuery.data?.tools ?? []) {
      grouped.set(tool.category, [...(grouped.get(tool.category) ?? []), tool]);
    }
    return grouped;
  }, [toolForgeQuery.data?.tools]);

  if (toolForgeQuery.isLoading) {
    return (
      <PageWrapper
        eyebrow="OPS · TOOL FORGE"
        title="Loading custom tool registry."
        description="Reading owned systems, live adapters, and money-loop build priorities."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="h-48 animate-pulse bg-[var(--color-surface)]" />
          ))}
        </div>
      </PageWrapper>
    );
  }

  if (toolForgeQuery.isError || !toolForgeQuery.data) {
    return (
      <PageWrapper
        eyebrow="OPS · TOOL FORGE"
        title="Tool Forge is offline."
        description="The custom tool registry could not be read from the local operator runtime."
      >
        <Card className="p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Check that the dashboard server is running on port 3007, then refresh this page.</p>
        </Card>
      </PageWrapper>
    );
  }

  const { summary, categories, tools, buildQueue, patterns } = toolForgeQuery.data;
  const generatedAt = new Date(toolForgeQuery.data.generatedAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <PageWrapper
      eyebrow="OPS · TOOL FORGE"
      title="Build owned tools, not another SaaS bill."
      description="A local-first map of every custom system HAMID.OS needs to find clients, convert them, deliver proof, collect money, and support your life."
      actions={
        <>
          <Link to="/ai">
            <Button variant="secondary">
              <Bot size={16} />
              Ask JARVIS
            </Button>
          </Link>
          <Link to="/ops/approvals">
            <Button variant={summary.pendingApprovals > 0 ? "primary" : "secondary"}>
              <ShieldCheck size={16} />
              {summary.pendingApprovals} approvals
            </Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[radial-gradient(circle_at_18%_18%,color-mix(in_oklab,var(--color-accent)_18%,transparent),transparent_34%),linear-gradient(135deg,color-mix(in_oklab,var(--color-surface)_94%,black),var(--color-bg))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-7">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:42px_42px] opacity-35" />
          <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">local-first</Badge>
                <Badge variant="info">{summary.operatorToolCount} operator tools</Badge>
                <Badge variant="warning">{summary.approvalGated} guarded systems</Badge>
              </div>
              <h2 className="mt-5 max-w-3xl font-display text-[clamp(2.4rem,5vw,5.8rem)] font-light leading-[0.92] tracking-[-0.045em] text-[var(--color-text)]">
                The business stack we own.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--color-text-muted)] md:text-base">
                {toolForgeQuery.data.thesis}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/ops/automation">
                  <Button>
                    <Sparkles size={16} />
                    Wire money loop
                  </Button>
                </Link>
                <Link to="/leads">
                  <Button variant="secondary">
                    <Route size={16} />
                    Open pipeline
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Tool registry", value: summary.total, detail: `${summary.live} live · ${summary.partial} partial`, icon: Boxes },
                { label: "Revenue loop", value: `${summary.revenueLoopCoveragePct}%`, detail: "covered by live/queued systems", icon: Coins },
                { label: "Build next", value: summary.buildNext, detail: "highest leverage systems", icon: Hammer },
                { label: "Updated", value: generatedAt, detail: "local server truth", icon: Clock3 },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-[24px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                      <p className="section-kicker">{stat.label}</p>
                      <Icon size={16} className="text-[var(--color-accent)]" />
                    </div>
                    <p className="metric-mono mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)]">{stat.value}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{stat.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Build doctrine</p>
                <h2 className="mt-2 text-xl font-semibold">How we avoid AI slop.</h2>
              </div>
              <LockKeyhole size={20} className="text-[var(--color-accent)]" />
            </div>
            <div className="mt-5 space-y-3">
              {toolForgeQuery.data.buildPrinciples.map((principle) => (
                <div key={principle} className="flex items-start gap-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-success)]" />
                  <p className="text-sm leading-6 text-[var(--color-text-muted)]">{principle}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Replicate, then own</p>
                <h2 className="mt-2 text-xl font-semibold">Patterns worth copying intelligently.</h2>
              </div>
              <Layers3 size={20} className="text-[var(--color-accent)]" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {patterns.map((pattern) => (
                <div key={pattern.name} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">{pattern.name}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">{pattern.source}</p>
                    </div>
                    <ExternalLink size={14} className="text-[var(--color-text-muted)]" />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">{pattern.pattern}</p>
                  <p className="mt-3 text-xs leading-5 text-[var(--color-text)]">{pattern.localVersion}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Build queue</p>
                <h2 className="mt-2 text-xl font-semibold">Next custom tools that make money fastest.</h2>
              </div>
              <Badge variant="warning">{buildQueue.length} queued</Badge>
            </div>
            <div className="mt-5 space-y-3">
              {buildQueue.length ? buildQueue.map((tool, index) => (
                <BuildQueueRow key={tool.id} tool={tool} index={index} />
              )) : (
                <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <Badge variant="success">cleared</Badge>
                  <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">The first owned-tool batch is now wired.</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                    Reply Radar, Deal Room, Owned Voice Agent, and Finance Guard now have live workbench routes. The next queue should be scheduled from real usage gaps.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-kicker">Coverage map</p>
                <h2 className="mt-2 text-xl font-semibold">Business systems by area.</h2>
              </div>
              <Boxes size={20} className="text-[var(--color-accent)]" />
            </div>
            <div className="mt-5 space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{category.label}</p>
                    <Badge variant={category.liveOrPartial === category.total ? "success" : "info"}>
                      {category.liveOrPartial}/{category.total}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{category.mission}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.round((category.liveOrPartial / Math.max(1, category.total)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-kicker">Owned systems</p>
              <h2 className="mt-2 text-xl font-semibold">Everything we are turning into custom software.</h2>
            </div>
            <Badge variant="neutral">{tools.length} systems</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
