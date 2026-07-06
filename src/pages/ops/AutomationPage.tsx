import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Zap, Play, Square, RefreshCw, CheckCircle2, XCircle, Clock,
  AlertCircle, Search, ImageIcon, Mail, Database, ChevronDown, ChevronUp,
  ShieldCheck, LockKeyhole, Radar, ArrowRight, Bot, Layers3,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface PipelineResult {
  runId: string;
  status: "idle" | "running" | "completed" | "failed" | "paused";
  startedAt: string;
  finishedAt: string | null;
  totalLeads: number;
  processed: number;
  emailsSent: number;
  emailsDrafted: number;
  imagesGenerated: number;
  errors: number;
  steps: Array<{ step: string; status: "ok" | "skip" | "error"; message: string; timestamp: string }>;
  leadResults: Array<{
    businessName: string;
    url: string;
    score: number;
    clientId: string | null;
    imageGenerated: boolean;
    browserAudited: boolean;
    browserAuditScreenshot: string | null;
    emailSent: boolean;
    emailDrafted: boolean;
    error: string | null;
  }>;
}

interface PipelineHistoryResponse {
  generatedAt: string;
  runs: PipelineResult[];
}

interface AutopilotStage {
  id: string;
  name: string;
  owner: string;
  status: "live" | "approval-required" | "needs-setup" | "blocked";
  evidence: string;
  nextAction: string;
}

interface AutomationReadiness {
  generatedAt: string;
  mode: "continuous-with-approvals" | "assisted-autopilot";
  score: number;
  stages: AutopilotStage[];
  blockers: AutopilotStage[];
  interfaceFeatures: Array<{
    name: string;
    inspiration: string;
    status: "implemented" | "ready" | "next" | "needs-setup";
    value: string;
  }>;
  guardrails: string[];
  nextRevenueMove: string;
}

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
    gmailConfigured: boolean;
    smtpConfigured: boolean;
    canSend: boolean;
    allowColdEmailSend: boolean;
    missingSmtp: string[];
  };
  policy: {
    maxLeadsPerRun: number;
    outsideWorldActions: string;
    compliance: string[];
  };
}

async function apiFetch(path: string, init?: RequestInit) {
  let response = await fetch(path, init);
  if (!response.ok && window.location.hostname === "localhost") {
    response = await fetch(`http://127.0.0.1:3007${path}`, init);
  }
  return response;
}

async function fetchPipelineStatus(): Promise<PipelineResult | null> {
  const res = await apiFetch("/api/automation/status");
  if (!res.ok) return null;
  return res.json() as Promise<PipelineResult>;
}

async function fetchPipelineHistory(): Promise<PipelineHistoryResponse> {
  const res = await apiFetch("/api/automation/history?limit=12");
  if (!res.ok) throw new Error("Pipeline history check failed");
  return res.json() as Promise<PipelineHistoryResponse>;
}

async function fetchAutomationReadiness(): Promise<AutomationReadiness> {
  const res = await apiFetch("/api/automation/readiness");
  if (!res.ok) throw new Error("Automation readiness check failed");
  return res.json() as Promise<AutomationReadiness>;
}

async function fetchHourlyAutomation(): Promise<HourlyAutomation> {
  const res = await apiFetch("/api/automation/hourly");
  if (!res.ok) throw new Error("Hourly automation check failed");
  return res.json() as Promise<HourlyAutomation>;
}

async function updateHourlyAutomation(input: Partial<HourlyAutomation["config"]> & {runNow?: boolean}): Promise<HourlyAutomation> {
  const res = await apiFetch("/api/automation/hourly", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({error: "Hourly automation update failed"})) as {error?: string};
    throw new Error(err.error ?? "Hourly automation update failed");
  }
  return res.json() as Promise<HourlyAutomation>;
}

async function startPipeline(config: {
  searchQuery: string;
  location: string;
  maxLeads: number;
  minScore: number;
  generateImages: boolean;
  runBrowserAudit: boolean;
  sendEmails: boolean;
}): Promise<PipelineResult> {
  const res = await apiFetch("/api/automation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Failed to start pipeline");
  }
  return res.json() as Promise<PipelineResult>;
}

async function abortPipeline(): Promise<void> {
  await apiFetch("/api/automation/abort", { method: "POST" });
}

const statusColors = {
  idle:      "text-[var(--color-text-muted)]",
  running:   "text-blue-400",
  completed: "text-green-400",
  failed:    "text-red-400",
  paused:    "text-yellow-400",
};

const statusBg = {
  idle:      "bg-[var(--color-surface-3)]",
  running:   "bg-blue-500/10",
  completed: "bg-green-500/10",
  failed:    "bg-red-500/10",
  paused:    "bg-yellow-500/10",
};

const stepIcons = {
  search: Search,
  "lead[": Database,
  image:  ImageIcon,
  email:  Mail,
  done:   CheckCircle2,
  fatal:  XCircle,
  abort:  Square,
};

const stageStatusStyles: Record<AutopilotStage["status"], string> = {
  live: "border-green-500/20 bg-green-500/10 text-green-300",
  "approval-required": "border-amber-500/25 bg-amber-500/10 text-amber-300",
  "needs-setup": "border-blue-500/20 bg-blue-500/10 text-blue-300",
  blocked: "border-red-500/25 bg-red-500/10 text-red-300",
};

const stageStatusLabels: Record<AutopilotStage["status"], string> = {
  live: "Live",
  "approval-required": "Approval gated",
  "needs-setup": "Needs setup",
  blocked: "Blocked",
};

function getStepIcon(step: string) {
  for (const [key, Icon] of Object.entries(stepIcons)) {
    if (step.startsWith(key)) return Icon;
  }
  return Zap;
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return iso; }
}

export function AutomationPage() {
  const [searchQuery,    setSearchQuery]    = useState("local business Greater Manchester");
  const [location,       setLocation]       = useState("Greater Manchester");
  const [maxLeads,       setMaxLeads]       = useState(10);
  const [minScore,       setMinScore]       = useState(40);
  const [generateImages, setGenerateImages] = useState(true);
  const [runBrowserAudit, setRunBrowserAudit] = useState(true);
  const [sendEmails,     setSendEmails]     = useState(false);
  const [showAllSteps,   setShowAllSteps]   = useState(false);
  const [selectedRunId,  setSelectedRunId]  = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["pipeline-status"],
    queryFn: fetchPipelineStatus,
    staleTime: 5_000,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3_000 : 10_000),
  });

  const historyQuery = useQuery({
    queryKey: ["pipeline-history"],
    queryFn: fetchPipelineHistory,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const readinessQuery = useQuery({
    queryKey: ["automation-readiness"],
    queryFn: fetchAutomationReadiness,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const hourlyQuery = useQuery({
    queryKey: ["hourly-automation"],
    queryFn: fetchHourlyAutomation,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const pipeline = statusQuery.data;
  const historyRuns = historyQuery.data?.runs ?? [];
  const selectedRun = selectedRunId ? historyRuns.find((run) => run.runId === selectedRunId) ?? null : null;
  const inspectedRun = selectedRun ?? pipeline;
  const readiness = readinessQuery.data;
  const isRunning = pipeline?.status === "running";

  const startMutation = useMutation({
    mutationFn: startPipeline,
    onSuccess: async (run) => {
      setSelectedRunId(run.runId);
      await Promise.all([statusQuery.refetch(), historyQuery.refetch()]);
    },
  });

  const abortMutation = useMutation({
    mutationFn: abortPipeline,
    onSuccess: async () => {
      await Promise.all([statusQuery.refetch(), historyQuery.refetch()]);
    },
  });

  const hourlyMutation = useMutation({
    mutationFn: updateHourlyAutomation,
    onSuccess: () => hourlyQuery.refetch(),
  });

  const handleStart = () => {
    startMutation.mutate({ searchQuery, location, maxLeads, minScore, generateImages, runBrowserAudit, sendEmails });
  };

  const steps = inspectedRun?.steps ?? [];
  const visibleSteps = showAllSteps ? steps : steps.slice(-8);

  const progressPct = pipeline && pipeline.totalLeads > 0
    ? Math.round((pipeline.processed / pipeline.totalLeads) * 100)
    : 0;

  return (
    <PageWrapper
      eyebrow="Operations"
      title="Overnight automation"
      description="Finds businesses, enriches dossiers, audits websites, builds premium demos, drafts outreach, and checks replies with guardrails instead of fake automation."
    >
      <div className="automation-hero-grid mb-6">
        <Card className="relative overflow-hidden border-[var(--color-border-strong)] bg-[linear-gradient(135deg,rgba(99,102,241,0.14),rgba(6,182,212,0.05)_42%,rgba(251,191,36,0.08))]">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[var(--color-accent)]/20 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="section-kicker">Client acquisition autopilot</p>
                <h2 className="display-title !text-[var(--text-xl)]">A real workflow, with proof before outreach.</h2>
                <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-[var(--color-text-muted)]">
                  This readiness layer checks whether the system can actually discover, enrich, audit, generate, contact, and follow up.
                  Missing integrations are shown as blockers; outside-world actions stay approval-gated.
                </p>
              </div>
              <div className="rounded-[var(--radius-2xl)] border border-white/10 bg-black/20 px-5 py-4 text-right shadow-[var(--shadow-md)]">
                <p className="font-mono text-4xl font-semibold tracking-tight text-[var(--color-text)]">{readiness?.score ?? "--"}%</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {readiness?.mode === "continuous-with-approvals" ? "Continuous ready" : "Assisted mode"}
                </p>
              </div>
            </div>

            <div className="automation-stage-grid">
              {(readiness?.stages ?? []).slice(0, 6).map((stage) => (
                <div key={stage.id} className="rounded-[var(--radius-xl)] border border-white/10 bg-[var(--color-surface)]/70 p-4 backdrop-blur">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${stageStatusStyles[stage.status]}`}>
                      {stageStatusLabels[stage.status]}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{stage.owner}</span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{stage.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{stage.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="section-kicker">Guardrails</p>
              <h2 className="display-title !text-[var(--text-lg)]">No fake work. No risky sends.</h2>
            </div>
          </div>

          <div className="space-y-2">
            {(readiness?.guardrails ?? [
              "Checking live automation guardrails...",
            ]).slice(0, 4).map((guardrail) => (
              <div key={guardrail} className="flex gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] px-3 py-2.5">
                <LockKeyhole size={13} className="mt-0.5 shrink-0 text-amber-300" />
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{guardrail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent-2)]">
              <Radar size={13} />
              Next revenue move
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-text)]">
              {readiness?.nextRevenueMove ?? "Run readiness checks, then start with a focused 10-lead batch."}
            </p>
          </div>
        </Card>
      </div>

      <Card className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent-2)]/10 text-[var(--color-accent-2)]">
              <Layers3 size={18} />
            </span>
            <div>
              <p className="section-kicker">Design intelligence layer</p>
              <h2 className="display-title !text-[var(--text-lg)]">Best-in-class interface patterns now mapped to HAMID.OS.</h2>
            </div>
          </div>
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
            Research-backed operating surface
          </span>
        </div>
        <div className="automation-feature-grid">
          {(readiness?.interfaceFeatures ?? []).map((feature) => (
            <div key={feature.name} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{feature.inspiration}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                  feature.status === "implemented" ? "bg-green-500/10 text-green-300" :
                  feature.status === "ready" ? "bg-blue-500/10 text-blue-300" :
                  feature.status === "needs-setup" ? "bg-amber-500/10 text-amber-300" :
                  "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                }`}>
                  {feature.status.replace("-", " ")}
                </span>
              </div>
              <p className="text-sm font-semibold text-[var(--color-text)]">{feature.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">{feature.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Hourly acquisition workflow</p>
            <h2 className="display-title !text-[var(--text-lg)]">Find 50 prospects, audit, draft outreach, log everything.</h2>
            <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-[var(--color-text-muted)]">
              Runs the same real pipeline on a schedule. It uses Firecrawl for discovery, website scraping for evidence,
              KIE for hero assets, Gmail/SMTP transport when allowed, and CRM timeline logging for every lead.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={hourlyQuery.data?.config.enabled ? "danger" : "primary"}
              disabled={hourlyMutation.isPending}
              onClick={() => hourlyMutation.mutate({
                enabled: !hourlyQuery.data?.config.enabled,
                intervalMinutes: 60,
                searchQuery,
                location,
                maxLeads: 50,
                minScore,
                generateImages,
                sendEmails: true,
              })}
            >
              {hourlyQuery.data?.config.enabled ? "Stop hourly run" : "Enable hourly run"}
            </Button>
            <Button
              variant="secondary"
              disabled={hourlyMutation.isPending || hourlyQuery.data?.state.status === "running"}
              onClick={() => hourlyMutation.mutate({
                enabled: hourlyQuery.data?.config.enabled ?? false,
                searchQuery,
                location,
                maxLeads: 50,
                minScore,
                generateImages,
                sendEmails: true,
                runNow: true,
              })}
            >
              Run 50-lead batch now
            </Button>
          </div>
        </div>

        <div className="automation-status-grid">
          {[
            {label: "Status", value: hourlyQuery.data?.state.status ?? "loading"},
            {label: "Next run", value: hourlyQuery.data?.state.nextRunAt ? fmtTime(hourlyQuery.data.state.nextRunAt) : "Not scheduled"},
            {label: "Transport", value: hourlyQuery.data?.transport.canSend ? (hourlyQuery.data.transport.gmailConfigured ? "Gmail" : "SMTP") : "Draft only"},
            {label: "Send mode", value: hourlyQuery.data?.transport.allowColdEmailSend ? "Live send" : "Approval gated"},
          ].map((item) => (
            <div key={item.label} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{item.label}</p>
              <p className="mt-2 text-sm font-semibold capitalize text-[var(--color-text)]">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[var(--radius-xl)] border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-300">Cold email safety gate</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {hourlyQuery.data?.policy.outsideWorldActions ?? "Checking transport and approval policy..."}
          </p>
          {hourlyQuery.data?.transport.missingSmtp.length ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              SMTP missing: {hourlyQuery.data.transport.missingSmtp.join(", ")}. Gmail can still be used if OAuth send is connected.
            </p>
          ) : null}
        </div>

        {hourlyMutation.isError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle size={14} />
            {hourlyMutation.error instanceof Error ? hourlyMutation.error.message : "Hourly automation update failed"}
          </div>
        )}
      </Card>

      <div className="automation-work-grid">

        {/* Left: Config + Controls */}
        <div className="space-y-5">

          {/* Current status */}
          {pipeline && (
            <Card className={`${statusBg[pipeline.status]} border-0 space-y-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex size-9 items-center justify-center rounded-full bg-white/10 ${statusColors[pipeline.status]}`}>
                    {isRunning
                      ? <RefreshCw size={16} className="animate-spin" />
                      : pipeline.status === "completed" ? <CheckCircle2 size={16} />
                      : pipeline.status === "failed"    ? <XCircle size={16} />
                      : <Clock size={16} />
                    }
                  </span>
                  <div>
                    <p className={`text-sm font-bold capitalize ${statusColors[pipeline.status]}`}>
                      Pipeline {pipeline.status}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">Run {pipeline.runId}</p>
                  </div>
                </div>
                {pipeline.finishedAt && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Finished {fmtTime(pipeline.finishedAt)}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              {(isRunning || pipeline.status === "completed") && (
                <div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
                    <span>{pipeline.processed} / {pipeline.totalLeads} leads processed</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Leads",   value: pipeline.totalLeads },
                  { label: "Images",  value: pipeline.imagesGenerated },
                  { label: "Drafts",  value: pipeline.emailsDrafted ?? 0 },
                  { label: "Errors",  value: pipeline.errors },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-xl font-black text-[var(--color-text)]">{value}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
                  </div>
                ))}
              </div>

              {/* Abort */}
              {isRunning && (
                <Button
                  variant="secondary"
                  className="gap-2 w-full"
                  onClick={() => abortMutation.mutate()}
                  disabled={abortMutation.isPending}
                >
                  <Square size={13} />
                  Abort pipeline
                </Button>
              )}
            </Card>
          )}

          {/* Config */}
          <Card className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                <Zap size={18} className="text-[var(--color-accent)]" />
              </span>
              <div>
                <p className="section-kicker">Pipeline configuration</p>
                <h2 className="display-title !text-[var(--text-lg)]">Search & automation</h2>
              </div>
            </div>

            {readiness?.blockers && readiness.blockers.length > 0 && (
              <div className="rounded-[var(--radius-xl)] border border-amber-500/20 bg-amber-500/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <Bot size={15} />
                  Autopilot still needs setup
                </div>
                <div className="space-y-2">
                  {readiness.blockers.slice(0, 3).map((blocker) => (
                    <div key={blocker.id} className="flex gap-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                      <ArrowRight size={12} className="mt-0.5 shrink-0 text-amber-300" />
                      <span>{blocker.nextAction}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="automation-config-grid">
              <div className="automation-config-wide">
                <Input
                  label="Search query"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. restaurants Manchester, hair salons Oldham"
                />
              </div>
              <Input
                label="Location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Greater Manchester"
              />
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Max leads
                </label>
                <input
                  type="number"
                  value={maxLeads}
                  onChange={e => setMaxLeads(Number(e.target.value))}
                  min={1} max={50}
                  className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Min score to process
                </label>
                <input
                  type="number"
                  value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  min={0} max={100}
                  className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              {[
                { label: "Run human browser audits", desc: "Playwright — clicks through pages, captures proof, scores flaws", value: runBrowserAudit, set: setRunBrowserAudit },
                { label: "Generate hero images",  desc: "KIE.ai — creates a branded hero for each lead",  value: generateImages, set: setGenerateImages },
                { label: "Send outreach emails",  desc: "SMTP — sends draft emails (requires SMTP config)", value: sendEmails,     set: setSendEmails },
              ].map(({ label, desc, value, set }) => (
                <label key={label} className="flex items-center gap-4 cursor-pointer">
                  <button
                    role="switch"
                    aria-checked={value}
                    onClick={() => set(!value)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${value ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-3)]"}`}
                  >
                    <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Start button */}
            <Button
              variant="primary"
              className="w-full gap-2 h-12 text-base"
              onClick={handleStart}
              disabled={isRunning || startMutation.isPending || !searchQuery.trim()}
            >
              {isRunning || startMutation.isPending
                ? <><RefreshCw size={16} className="animate-spin" /> Pipeline running…</>
                : <><Play size={16} /> Run pipeline now</>
              }
            </Button>

            {startMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">
                <AlertCircle size={14} />
                {String(startMutation.error)}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Live log + lead results */}
        <div className="space-y-5">
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Persistent proof</p>
                <h2 className="display-title !text-[var(--text-lg)]">Run history</h2>
              </div>
              {selectedRunId && (
                <Button variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => setSelectedRunId(null)}>
                  Live run
                </Button>
              )}
            </div>

            {historyRuns.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-4 py-6 text-center">
                <Database size={22} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-50" />
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  No persisted acquisition runs yet. Start a pipeline and every step, lead, draft, image, and error will be saved here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {historyRuns.map((run) => (
                  <button
                    key={run.runId}
                    type="button"
                    onClick={() => setSelectedRunId(run.runId)}
                    className={`w-full rounded-[var(--radius-xl)] border px-3 py-3 text-left transition-all duration-[var(--duration-base)] ${
                      selectedRunId === run.runId
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-glow)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[var(--color-text)]">{run.runId}</p>
                        <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                          {fmtTime(run.startedAt)} · {run.processed}/{run.totalLeads} processed
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${statusColors[run.status]}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[var(--color-text-muted)]">
                      <span>{run.emailsDrafted} drafts</span>
                      <span>{run.imagesGenerated} images</span>
                      <span>{run.emailsSent} sent</span>
                      <span>{run.errors} errors</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {historyQuery.isError ? (
              <p className="text-xs text-red-400">Could not load run history from the backend.</p>
            ) : null}
          </Card>

          {/* Live step log */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{selectedRun ? "Archived run log" : "Live log"}</p>
                {inspectedRun?.runId ? <p className="text-[10px] text-[var(--color-text-muted)]">{inspectedRun.runId}</p> : null}
              </div>
              {isRunning && !selectedRun && <span className="flex items-center gap-1 text-xs text-blue-400"><RefreshCw size={10} className="animate-spin" /> Live</span>}
            </div>

            {steps.length === 0 ? (
              <div className="py-8 text-center text-[var(--color-text-muted)]">
                <Clock size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No pipeline run yet. Configure and start one.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                  {visibleSteps.map((s, i) => {
                    const Icon = getStepIcon(s.step);
                    return (
                      <div key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 ${
                        s.status === "error" ? "bg-red-500/10" :
                        s.status === "skip"  ? "bg-[var(--color-surface-2)]" :
                        "bg-[var(--color-surface-2)]"
                      }`}>
                        <Icon size={12} className={`shrink-0 mt-0.5 ${
                          s.status === "error" ? "text-red-400" :
                          s.status === "skip"  ? "text-[var(--color-text-muted)]" :
                          "text-green-400"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[var(--color-text)] leading-snug">{s.message}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">{fmtTime(s.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {steps.length > 8 && (
                  <button
                    onClick={() => setShowAllSteps(v => !v)}
                    className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline w-full justify-center"
                  >
                    {showAllSteps ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {steps.length} steps</>}
                  </button>
                )}
              </>
            )}
          </Card>

          {/* Lead results */}
          {(inspectedRun?.leadResults ?? []).length > 0 && (
            <Card className="space-y-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">Lead results</p>
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {inspectedRun!.leadResults.map((lr, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        {lr.clientId ? (
                          <a href={`#/leads/${encodeURIComponent(lr.clientId)}`} className="truncate text-xs font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline">
                            {lr.businessName}
                          </a>
                        ) : (
                          <p className="truncate text-xs font-semibold text-[var(--color-text)]">{lr.businessName}</p>
                        )}
                        <span className={`text-[10px] font-bold ${lr.score >= 70 ? "text-green-400" : lr.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                          {lr.score}
                        </span>
                      </div>
                      {lr.clientId && (
                        <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{lr.clientId}</p>
                      )}
                      {lr.error && (
                        <p className="text-[10px] text-red-400 truncate">{lr.error}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {lr.imageGenerated && (
                        <span title="Image generated" className="inline-flex size-5 items-center justify-center rounded bg-yellow-500/10 text-yellow-400">
                          <ImageIcon size={10} />
                        </span>
                      )}
                      {lr.browserAudited && (
                        <span title={lr.browserAuditScreenshot ? `Browser audit saved: ${lr.browserAuditScreenshot}` : "Browser audit saved"} className="inline-flex size-5 items-center justify-center rounded bg-cyan-500/10 text-cyan-300">
                          <Search size={10} />
                        </span>
                      )}
                      {lr.emailSent && (
                        <span title="Email sent" className="inline-flex size-5 items-center justify-center rounded bg-green-500/10 text-green-400">
                          <Mail size={10} />
                        </span>
                      )}
                      {lr.emailDrafted && !lr.emailSent && (
                        <span title="Email draft logged, not sent" className="inline-flex size-5 items-center justify-center rounded bg-blue-500/10 text-blue-400">
                          <Mail size={10} />
                        </span>
                      )}
                      {lr.error && (
                        <span title={lr.error} className="inline-flex size-5 items-center justify-center rounded bg-red-500/10 text-red-400">
                          <XCircle size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
