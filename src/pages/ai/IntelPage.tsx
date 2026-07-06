import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, BrainCircuit, FileSearch, RefreshCw, Search, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  fetchClient360,
  fetchIntegrationsStatus,
  fetchLeadSearchStatus,
  fetchOpenClawAgents,
  sendAiCommand,
} from "@/services/api";
import type { Client360Account } from "@/types/frontend";

interface IntelReport {
  id: string;
  title: string;
  subtitle: string;
  agent: string;
  confidence: number;
  timeLabel: string;
  accent: string;
  href: string;
}

interface ResearchTemplate {
  label: string;
  agent: string;
  desc: string;
  prompt: string;
  href: string;
  accent: string;
}

const TEMPLATES: ResearchTemplate[] = [
  {
    label: "Lead discovery",
    agent: "LEADGEN",
    desc: "Find local companies and convert weak websites into sales angles.",
    prompt: "Analyse the current CRM and suggest the next lead discovery search: market, location, evidence needed, and outreach angle.",
    href: "/ai/scraper",
    accent: "#10b981",
  },
  {
    label: "Conversion audit",
    agent: "OPS",
    desc: "Identify stale, incomplete, or high-friction accounts.",
    prompt: "Review the current pipeline and explain which businesses are stuck, why, and what Hamid should do next.",
    href: "/crm",
    accent: "#d8b76a",
  },
  {
    label: "Offer strategy",
    agent: "JARVIS",
    desc: "Turn account evidence into a paid offer and payment path.",
    prompt: "Based on current leads and revenue metrics, propose the sharpest offer, price anchor, and closing plan for this week.",
    href: "/pay",
    accent: "#76d6ce",
  },
  {
    label: "Agent review",
    agent: "OPS",
    desc: "Check OpenClaw, approvals, and system readiness.",
    prompt: "Audit the AI workforce and integration health. Surface blockers, risks, and the next setup action.",
    href: "/agents",
    accent: "#f59e0b",
  },
];

function confidenceFromScore(score: number): number {
  return Math.max(35, Math.min(98, Math.round(score)));
}

function relativeTime(value: string | null): string {
  if (!value) return "No activity";
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return "Unknown";
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function accountReport(account: Client360Account): IntelReport {
  const missing = account.riskFlags.length ? account.riskFlags[0] : account.nextBestAction;
  return {
    id: `account-${account.clientId}`,
    title: account.businessName,
    subtitle: `${account.businessType} · ${account.area} · ${missing}`,
    agent: account.relationshipBand === "critical" ? "OPS" : account.siteScore >= 70 ? "OUTREACH" : "LEADGEN",
    confidence: confidenceFromScore((account.siteScore + account.relationshipScore + account.dossierCompleteness) / 3),
    timeLabel: relativeTime(account.latestActivityAt),
    accent: account.relationshipBand === "critical" ? "#ef4444" : account.siteScore >= 70 ? "#10b981" : "#d8b76a",
    href: `/leads/${account.clientId}`,
  };
}

export function IntelPage() {
  const [query, setQuery] = useState("");

  const client360Query = useQuery({ queryKey: ["client-360"], queryFn: fetchClient360, staleTime: 60_000 });
  const leadSearchQuery = useQuery({ queryKey: ["lead-search-status"], queryFn: fetchLeadSearchStatus, refetchInterval: 10_000 });
  const integrationsQuery = useQuery({ queryKey: ["integrations-status"], queryFn: fetchIntegrationsStatus, staleTime: 60_000 });
  const agentsQuery = useQuery({ queryKey: ["openclaw-agents"], queryFn: fetchOpenClawAgents, staleTime: 60_000 });

  const intelReports = useMemo<IntelReport[]>(() => {
    const accounts = client360Query.data?.accounts ?? [];
    const hot = (client360Query.data?.signals.hotAccounts ?? []).slice(0, 3).map(accountReport);
    const stale = (client360Query.data?.signals.staleAccounts ?? []).slice(0, 2).map(accountReport);
    const incomplete = (client360Query.data?.signals.incompleteDossiers ?? []).slice(0, 2).map(accountReport);
    const blockedConnectors = (integrationsQuery.data?.connectors ?? [])
      .filter((connector) => connector.status !== "connected")
      .slice(0, 3)
      .map((connector) => ({
        id: `connector-${connector.provider}`,
        title: `${connector.label} needs attention`,
        subtitle: connector.error || connector.missingEnv.length ? `Missing: ${connector.missingEnv.join(", ") || connector.error}` : connector.enables,
        agent: connector.provider === "plaid" || connector.provider === "revenuecat" ? "FINANCE" : "OPS",
        confidence: connector.status === "error" ? 96 : 78,
        timeLabel: connector.syncedAt ? relativeTime(connector.syncedAt) : "Not synced",
        accent: connector.status === "error" ? "#ef4444" : "#f59e0b",
        href: "/ops/health",
      }));

    return [...hot, ...stale, ...incomplete, ...blockedConnectors]
      .filter((report, index, list) => list.findIndex((item) => item.id === report.id) === index)
      .slice(0, 10)
      .concat(
        accounts.length
          ? []
          : [{
              id: "empty-pipeline",
              title: "Pipeline has no live accounts yet",
              subtitle: leadSearchQuery.data?.message ?? "Run Firecrawl/Apify discovery to create the first real intelligence records.",
              agent: "LEADGEN",
              confidence: 100,
              timeLabel: leadSearchQuery.data?.startedAt ? relativeTime(leadSearchQuery.data.startedAt) : "Waiting",
              accent: "#f59e0b",
              href: "/ops/automation",
            }],
      );
  }, [
    client360Query.data?.accounts,
    client360Query.data?.signals.hotAccounts,
    client360Query.data?.signals.incompleteDossiers,
    client360Query.data?.signals.staleAccounts,
    integrationsQuery.data?.connectors,
    leadSearchQuery.data?.message,
    leadSearchQuery.data?.startedAt,
  ]);

  const commandMutation = useMutation({
    mutationFn: (message: string) => sendAiCommand({ message, mode: "strategy" }),
  });

  const runResearch = (message: string) => {
    if (!message.trim()) return;
    commandMutation.mutate(message);
  };

  return (
    <PageWrapper
      eyebrow="HAMID.OS · LIVE INTELLIGENCE"
      title="Intel"
      description="Research command built from live CRM, pipeline, OpenClaw, and integration state. No canned reports."
    >
      <div className="max-w-5xl space-y-6">
        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <Input
                label="Research query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask what the live data says, which market to pursue, or why leads are stuck..."
                className="pl-9"
              />
            </div>
            <Button onClick={() => runResearch(query)} disabled={!query.trim() || commandMutation.isPending}>
              <BrainCircuit size={16} />
              {commandMutation.isPending ? "Thinking" : "Ask JARVIS"}
            </Button>
            <Link to="/ai/scraper">
              <Button variant="secondary">
                <FileSearch size={16} />
                Run scraper
              </Button>
            </Link>
          </div>
          {commandMutation.data ? (
            <div className="mt-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{commandMutation.data.model}</Badge>
                <span className="section-kicker">{commandMutation.data.context.accountsIncluded} accounts in context</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-muted)]">{commandMutation.data.reply}</p>
            </div>
          ) : commandMutation.error ? (
            <div className="mt-4 rounded-[var(--radius-xl)] border border-[color-mix(in_oklab,var(--color-error)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-error)_9%,var(--color-surface))] p-4 text-sm text-[var(--color-text-muted)]">
              {commandMutation.error instanceof Error ? commandMutation.error.message : "AI command failed."}
            </div>
          ) : null}
        </Card>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Live research routes
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.label}
                onClick={() => {
                  setQuery(template.prompt);
                  runResearch(template.prompt);
                }}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)]/40"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{template.label}</span>
                  <span className="rounded px-1.5 py-0.5 text-xs font-bold" style={{ color: template.accent, background: `${template.accent}20` }}>
                    {template.agent}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{template.desc}</p>
                <Link to={template.href} className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-accent)]" onClick={(event) => event.stopPropagation()}>
                  Workspace
                  <ArrowUpRight size={12} />
                </Link>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Live intelligence reports
            </h2>
            <div className="flex flex-wrap gap-2">
              <Badge variant={agentsQuery.data?.agents.length ? "success" : "warning"}>
                {agentsQuery.data?.agents.length ?? 0} agents
              </Badge>
              <Badge variant={leadSearchQuery.data?.status === "running" ? "info" : "neutral"}>
                discovery {leadSearchQuery.data?.status ?? "unknown"}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            {client360Query.isLoading || integrationsQuery.isLoading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : intelReports.length ? (
              intelReports.map((report) => (
                <Card key={report.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="mt-1 w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: report.accent }} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{report.title}</h3>
                          <Badge variant="neutral">{report.agent}</Badge>
                        </div>
                        <p className="text-xs leading-5 text-[var(--color-text-muted)]">{report.subtitle}</p>
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs text-[var(--color-text-muted)]">
                            <span>Evidence confidence</span>
                            <span>{report.confidence}%</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${report.confidence}%`, backgroundColor: report.accent }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="mb-3 text-xs text-[var(--color-text-muted)]">{report.timeLabel}</div>
                      <Link to={report.href}>
                        <Button variant="secondary" className="px-3 py-1 text-xs">View</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="border-dashed p-8 text-center">
                <ShieldAlert size={22} className="mx-auto text-[var(--color-warning)]" />
                <p className="mt-3 font-medium text-[var(--color-text-muted)]">No live intelligence yet</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Run the acquisition pipeline or add CRM accounts and this page will build reports from real records.
                </p>
              </Card>
            )}
          </div>
        </div>

        <Card className="border-dashed p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">Live research status</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {leadSearchQuery.data?.message ?? "No discovery job has reported yet."}
              </p>
            </div>
            <Link to="/ops/automation">
              <Button variant="secondary">
                <Sparkles size={16} />
                Acquisition loop
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => leadSearchQuery.refetch()}>
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
