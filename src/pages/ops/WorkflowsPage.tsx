import { useMemo } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, ExternalLink, Pause, Play, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  fetchIntegrationsStatus,
  fetchOpenClawApprovals,
  fetchOpenClawSessions,
  fetchOpenClawSystem,
  apiUrl,
} from "@/services/api";

type WorkflowStatus = "running" | "queued" | "completed" | "failed" | "paused";
type TriggerType = "cron" | "pipeline" | "schedule" | "manual" | "webhook" | "health";

interface HourlyAutomation {
  config: {
    enabled: boolean;
    intervalMinutes: number;
    searchQuery: string;
    location: string;
    maxLeads: number;
    minScore: number;
    generateImages: boolean;
    sendEmails: boolean;
  };
  state: {
    status: "idle" | "scheduled" | "running" | "completed" | "skipped" | "failed";
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastRunId: string | null;
    lastError: string | null;
  };
  transport: {
    canSend: boolean;
    allowColdEmailSend: boolean;
  };
}

interface WorkflowRow {
  id: string;
  name: string;
  desc: string;
  status: WorkflowStatus;
  agent: string;
  trigger: TriggerType;
  entity: string;
  lastRun: string;
  nextRun: string;
  failures: number;
  avgDuration: string;
  href: string;
  accent: string;
  runnable: boolean;
  pausable: boolean;
}

async function fetchHourlyAutomation(): Promise<HourlyAutomation> {
  const response = await fetch(apiUrl("/api/automation/hourly"));
  if (!response.ok) throw new Error("Hourly automation unavailable");
  return response.json() as Promise<HourlyAutomation>;
}

async function updateHourlyAutomation(input: Partial<HourlyAutomation["config"]> & {runNow?: boolean}): Promise<HourlyAutomation> {
  const response = await fetch(apiUrl("/api/automation/hourly"), {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({error: "Workflow update failed"})) as {error?: string};
    throw new Error(body.error ?? "Workflow update failed");
  }
  return response.json() as Promise<HourlyAutomation>;
}

function workflowStatusFromAutomation(status: HourlyAutomation["state"]["status"], enabled: boolean): WorkflowStatus {
  if (!enabled) return "paused";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  if (status === "scheduled" || status === "idle" || status === "skipped") return "queued";
  return "completed";
}

function fmtTime(iso: string | null): string {
  if (!iso) return "Not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-GB", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
}

const STATUS_BADGE: Record<WorkflowStatus, "success" | "warning" | "neutral" | "error"> = {
  running: "success",
  queued: "warning",
  completed: "neutral",
  failed: "error",
  paused: "neutral",
};

const STATUS_ICON: Record<WorkflowStatus, ReactNode> = {
  running: <Play size={12} />,
  queued: <Clock size={12} />,
  completed: <CheckCircle size={12} />,
  failed: <XCircle size={12} />,
  paused: <Pause size={12} />,
};

const TRIGGER_BADGE: Record<TriggerType, string> = {
  cron: "CRON",
  pipeline: "PIPELINE",
  schedule: "SCHEDULE",
  manual: "MANUAL",
  webhook: "WEBHOOK",
  health: "HEALTH",
};

export function WorkflowsPage() {
  const queryClient = useQueryClient();
  const hourlyQuery = useQuery({
    queryKey: ["hourly-automation"],
    queryFn: fetchHourlyAutomation,
    refetchInterval: 15_000,
  });
  const sessionsQuery = useQuery({
    queryKey: ["openclaw-sessions"],
    queryFn: fetchOpenClawSessions,
    refetchInterval: 30_000,
  });
  const approvalsQuery = useQuery({
    queryKey: ["openclaw-approvals"],
    queryFn: fetchOpenClawApprovals,
    refetchInterval: 15_000,
  });
  const integrationsQuery = useQuery({
    queryKey: ["integrations-status"],
    queryFn: fetchIntegrationsStatus,
    refetchInterval: 60_000,
  });
  const systemQuery = useQuery({
    queryKey: ["openclaw-system"],
    queryFn: fetchOpenClawSystem,
    refetchInterval: 30_000,
  });

  const hourlyMutation = useMutation({
    mutationFn: updateHourlyAutomation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: ["hourly-automation"]});
    },
  });

  const workflows = useMemo<WorkflowRow[]>(() => {
    const hourly = hourlyQuery.data;
    const sessions = sessionsQuery.data?.sessions ?? [];
    const approvals = approvalsQuery.data?.pending ?? [];
    const connectors = integrationsQuery.data?.connectors ?? [];
    const connectorErrors = connectors.filter((connector) => connector.status === "error");
    const missingConnectors = connectors.filter((connector) => connector.status === "not_configured");
    const runningSessions = sessions.filter((session) => session.status === "running" || session.status === "active");
    const staleSessions = sessions.filter((session) => {
      if (!session.lastActivityAt || !["running", "active"].includes(session.status)) return false;
      return Date.now() - new Date(session.lastActivityAt).getTime() > 15 * 60_000;
    });

    return [
      {
        id: "hourly-acquisition",
        name: "Hourly acquisition loop",
        desc: hourly
          ? `${hourly.config.searchQuery} in ${hourly.config.location} · ${hourly.config.maxLeads} leads/run · ${hourly.transport.allowColdEmailSend ? "send enabled" : "draft/approval mode"}`
          : "Loading acquisition scheduler state.",
        status: hourly ? workflowStatusFromAutomation(hourly.state.status, hourly.config.enabled) : "queued",
        agent: "LEADGEN",
        trigger: "cron",
        entity: "Lead acquisition",
        lastRun: fmtTime(hourly?.state.lastRunAt ?? null),
        nextRun: fmtTime(hourly?.state.nextRunAt ?? null),
        failures: hourly?.state.lastError ? 1 : 0,
        avgDuration: hourly?.state.lastRunId ? "Run logged" : "No run yet",
        href: "/ops/automation",
        accent: "#10b981",
        runnable: true,
        pausable: true,
      },
      {
        id: "openclaw-sessions",
        name: "OpenClaw session control",
        desc: `${sessions.length} session${sessions.length === 1 ? "" : "s"} visible · ${runningSessions.length} active · ${staleSessions.length} stuck.`,
        status: staleSessions.length ? "failed" : runningSessions.length ? "running" : sessions.length ? "completed" : "queued",
        agent: "OPS",
        trigger: "webhook",
        entity: "Agent workforce",
        lastRun: fmtTime(sessions[0]?.lastActivityAt ?? sessions[0]?.startedAt ?? null),
        nextRun: "Event driven",
        failures: staleSessions.length,
        avgDuration: `${sessions.reduce((sum, session) => sum + session.messageCount, 0)} messages`,
        href: "/agents",
        accent: "#76d6ce",
        runnable: false,
        pausable: false,
      },
      {
        id: "approval-guardrail",
        name: "Human approval guardrail",
        desc: `${approvals.length} outside-world action${approvals.length === 1 ? "" : "s"} waiting for Hamid.`,
        status: approvals.length ? "queued" : "completed",
        agent: "JARVIS",
        trigger: "manual",
        entity: "Approvals",
        lastRun: fmtTime(approvals[0]?.requestedAt ?? null),
        nextRun: approvals.length ? "Review now" : "On demand",
        failures: 0,
        avgDuration: "Human gated",
        href: "/ops/approvals",
        accent: "#d8b76a",
        runnable: false,
        pausable: false,
      },
      {
        id: "integration-spine",
        name: "Integration spine",
        desc: `${connectors.filter((connector) => connector.status === "connected").length}/${connectors.length} connectors live · ${missingConnectors.length} need setup.`,
        status: connectorErrors.length ? "failed" : missingConnectors.length ? "queued" : "completed",
        agent: "FORGE",
        trigger: "health",
        entity: "API control plane",
        lastRun: fmtTime(integrationsQuery.data?.generatedAt ?? null),
        nextRun: "Every 60s",
        failures: connectorErrors.length,
        avgDuration: `${connectors.length} connectors`,
        href: "/ops/health",
        accent: "#f59e0b",
        runnable: false,
        pausable: false,
      },
      {
        id: "host-health",
        name: "Host telemetry sweep",
        desc: systemQuery.data
          ? `CPU ${systemQuery.data.cpuLoad}% · RAM ${systemQuery.data.memoryUsedPct}% · Disk ${systemQuery.data.diskUsedPct}%.`
          : "Waiting for host telemetry.",
        status: systemQuery.data?.status === "Critical" ? "failed" : systemQuery.data?.status === "Elevated" ? "queued" : "completed",
        agent: "OPS",
        trigger: "health",
        entity: "Local runtime",
        lastRun: fmtTime(new Date().toISOString()),
        nextRun: "Every 30s",
        failures: systemQuery.data?.status === "Critical" ? 1 : 0,
        avgDuration: systemQuery.data?.status ?? "Checking",
        href: "/ops/health",
        accent: "#3b82f6",
        runnable: false,
        pausable: false,
      },
    ];
  }, [
    approvalsQuery.data?.pending,
    hourlyQuery.data,
    integrationsQuery.data,
    sessionsQuery.data?.sessions,
    systemQuery.data,
  ]);

  const isLoading =
    hourlyQuery.isLoading ||
    sessionsQuery.isLoading ||
    approvalsQuery.isLoading ||
    integrationsQuery.isLoading ||
    systemQuery.isLoading;

  const stats = {
    active: workflows.filter((workflow) => workflow.status === "running" || workflow.status === "queued").length,
    paused: workflows.filter((workflow) => workflow.status === "paused").length,
    failed: workflows.filter((workflow) => workflow.status === "failed").length,
    completed: workflows.filter((workflow) => workflow.status === "completed").length,
  };

  return (
    <PageWrapper
      eyebrow="HAMID.OS · OPS"
      title="WORKFLOWS"
      description="Live automation infrastructure from the scheduler, OpenClaw sessions, approvals, integrations, and host telemetry."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Active", value: stats.active, color: "text-green-400" },
            { label: "Paused", value: stats.paused, color: "text-yellow-400" },
            { label: "Failed", value: stats.failed, color: "text-red-400" },
            { label: "Completed", value: stats.completed, color: "text-[var(--color-text-muted)]" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-4 text-center">
              <div className={`text-2xl font-bold font-mono ${color}`}>{isLoading ? "-" : value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-text-muted)]">
            {workflows.length} LIVE WORKFLOW SURFACES
          </h2>
          <Link to="/ops/automation">
            <Button>
              <Play size={14} />
              Open automation runner
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="p-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: workflow.accent }} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{workflow.name}</h3>
                        <Badge variant={STATUS_BADGE[workflow.status]}>
                          <span className="flex items-center gap-1">
                            {STATUS_ICON[workflow.status]}
                            {workflow.status.toUpperCase()}
                          </span>
                        </Badge>
                        <Badge variant="neutral">{TRIGGER_BADGE[workflow.trigger]}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{workflow.desc}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {workflow.pausable ? (
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        onClick={() => hourlyMutation.mutate({enabled: workflow.status === "paused"})}
                      >
                        {workflow.status === "paused" ? <Play size={12} /> : <Pause size={12} />}
                        {workflow.status === "paused" ? "Resume" : "Pause"}
                      </Button>
                    ) : null}
                    {workflow.runnable ? (
                      <Button
                        className="px-3 py-1 text-xs"
                        onClick={() => hourlyMutation.mutate({runNow: true})}
                        disabled={hourlyMutation.isPending}
                      >
                        <Play size={12} />
                        Run now
                      </Button>
                    ) : null}
                    <Link to={workflow.href}>
                      <Button variant="ghost" className="px-3 py-1 text-xs">
                        <ExternalLink size={12} />
                        Open
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-4 xl:grid-cols-6">
                  {[
                    { label: "Agent", value: workflow.agent },
                    { label: "Entity", value: workflow.entity },
                    { label: "Last run", value: workflow.lastRun },
                    { label: "Next run", value: workflow.nextRun },
                    { label: "Failures", value: String(workflow.failures), highlight: workflow.failures > 0 },
                    { label: "Avg duration", value: workflow.avgDuration },
                  ].map(({ label, value, highlight }) => (
                    <div key={label}>
                      <div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
                      <div className={`text-sm font-medium font-mono ${highlight ? "text-red-400" : ""}`}>
                        {value}
                        {highlight ? <AlertCircle size={12} className="ml-1 inline text-red-400" /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-dashed p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">Guardrail</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                This page no longer creates fake local workflows. New autonomous flows should be added as real backend jobs or OpenClaw playbooks, then they will appear here from live state.
              </p>
            </div>
            <Link to="/agents">
              <Button variant="secondary">
                <ShieldCheck size={14} />
                Manage playbooks
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
