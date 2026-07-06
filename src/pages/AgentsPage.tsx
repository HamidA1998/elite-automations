import {useEffect, useMemo, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {
  Bot,
  BrainCircuit,
  ChevronRight,
  CirclePlay,
  Command,
  DatabaseZap,
  Gauge,
  MessagesSquare,
  Send,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import {PageWrapper} from "@/components/layout/PageWrapper";
import {Badge} from "@/components/ui/Badge";
import {Button} from "@/components/ui/Button";
import {Card} from "@/components/ui/Card";
import {Input} from "@/components/ui/Input";
import {Modal} from "@/components/ui/Modal";
import {Skeleton} from "@/components/ui/Skeleton";
import {
  fetchOpenClawAgent,
  fetchOpenClawAgents,
  fetchOpenClawApprovals,
  fetchOpenClawMemory,
  fetchOpenClawSession,
  fetchOpenClawSessions,
  fetchOpenClawSystem,
  resolveOpenClawApproval,
  sendOpenClawCommand,
} from "@/services/api";
import type {
  OpenClawActivityEvent,
  OpenClawAgent,
  OpenClawSessionSummary,
} from "@/types/frontend";

type AgentsTab = "fleet" | "overview" | "sessions" | "skills-memory";
type ApprovalDecision = "allow-once" | "allow-always" | "deny";

interface SessionWorkspaceState {
  notes: string;
  bookmarks: string[];
}

interface PlaybookDraft {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
}

const agentsTabOptions: Array<{id: AgentsTab; label: string}> = [
  {id: "fleet", label: "Fleet"},
  {id: "overview", label: "Overview"},
  {id: "sessions", label: "Sessions"},
  {id: "skills-memory", label: "Skills & Memory"},
];

const WORKFORCE_ROLES = [
  {
    id: "jarvis",
    name: "JARVIS",
    title: "CEO agent",
    accent: "#d8b76a",
    responsibilities: "Reads metrics, leads, schedule, integrations, and approvals to set daily and weekly priorities.",
    systems: ["Command centre", "Metrics", "Schedule", "Approvals"],
  },
  {
    id: "ops",
    name: "OPS",
    title: "Operations controller",
    accent: "#76d6ce",
    responsibilities: "Watches stuck work, stale leads, delivery pressure, health alerts, and next actions.",
    systems: ["Mission Control", "Pipelines", "Health", "Tasks"],
  },
  {
    id: "leadgen",
    name: "LEADGEN",
    title: "Lead acquisition",
    accent: "#10b981",
    responsibilities: "Runs Firecrawl/Apify searches, qualifies businesses, creates CRM records, and enriches contact routes.",
    systems: ["Firecrawl", "Apify", "Lead pipeline", "Browser audit"],
  },
  {
    id: "outreach",
    name: "OUTREACH",
    title: "Sales copy and follow-up",
    accent: "#f59e0b",
    responsibilities: "Drafts cold emails, follow-ups, reply templates, and logs conversation outcomes.",
    systems: ["Gmail", "Campaigns", "Client memory", "Approvals"],
  },
  {
    id: "builder",
    name: "BUILDER",
    title: "Proof and demo builder",
    accent: "#3b82f6",
    responsibilities: "Coordinates demo sites, generated images, videos, Remotion assets, bugs, and deployment work.",
    systems: ["KIE.ai", "Remotion", "Demo builder", "Projects"],
  },
  {
    id: "content",
    name: "CONTENT",
    title: "Authority engine",
    accent: "#f472b6",
    responsibilities: "Writes posts, landing copy, scripts, repurposed content, and performance notes.",
    systems: ["Content", "Mail", "Scripts", "Analytics"],
  },
  {
    id: "finance",
    name: "FINANCE",
    title: "Cash and usage control",
    accent: "#22c55e",
    responsibilities: "Tracks spend, revenue, Stripe, RevenueCat, Plaid, margins, and usage caps.",
    systems: ["Stripe", "Plaid", "RevenueCat", "Cost alerts"],
  },
  {
    id: "support",
    name: "SUPPORT",
    title: "Client support desk",
    accent: "#a78bfa",
    responsibilities: "Handles client-facing updates, support replies, reference lookups, and delivery status.",
    systems: ["Client files", "Calls", "Mail", "Projects"],
  },
] as const;

function relativeTime(iso: string | null) {
  if (!iso) return "No activity yet";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function loadLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function persistLocalJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function statusVariant(status: OpenClawAgent["status"]) {
  switch (status) {
    case "error":
      return "error";
    case "running-tool":
      return "warning";
    case "thinking":
      return "info";
    default:
      return "success";
  }
}

function eventVariant(type: OpenClawActivityEvent["type"]) {
  switch (type) {
    case "error":
      return "error";
    case "tool_call":
      return "warning";
    case "approval":
      return "info";
    case "webhook":
      return "success";
    default:
      return "neutral";
  }
}

function Sparkline({values}: {values: number[]}) {
  const points = values.length ? values : [0];
  const path = points
    .map((value, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 90 - Math.max(0, Math.min(100, value)) * 0.72;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      <path d={`${path} L 100 100 L 0 100 Z`} fill="color-mix(in oklab, var(--color-accent) 18%, transparent)" />
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function findRoleAgent(roleId: string, agents: OpenClawAgent[]) {
  const normalized = roleId.toLowerCase();
  return agents.find((agent) => {
    const haystack = `${agent.id} ${agent.name} ${agent.role} ${agent.description}`.toLowerCase();
    return haystack.includes(normalized);
  }) ?? null;
}

function FleetTab({
  agents,
  onDispatch,
}: {
  agents: OpenClawAgent[];
  onDispatch: (agentId: string, prompt: string) => Promise<void> | void;
}) {
  const [dispatches, setDispatches] = useState<Record<string, string>>({});
  const [firing, setFiring] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const registeredRoles = WORKFORCE_ROLES.filter((role) => findRoleAgent(role.id, agents)).length;

  const fire = async (roleId: string, agentId: string | null) => {
    const prompt = dispatches[roleId]?.trim();
    if (!prompt || !agentId) return;
    setFiring(roleId);
    try {
      await onDispatch(agentId, prompt);
      setDispatches((prev) => ({ ...prev, [roleId]: "" }));
    } finally {
      setFiring(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
          {registeredRoles}/{WORKFORCE_ROLES.length} workforce roles registered in OpenClaw
        </span>
        <span className="text-[var(--color-border)]">·</span>
        <span className="text-xs text-[var(--color-text-muted)]">Unregistered roles are visible as required operating seats, but cannot be dispatched yet.</span>
        {firing && (
          <>
            <span className="text-[var(--color-border)]">·</span>
            <span className="text-xs font-bold text-[var(--color-accent)]">
              Dispatching {firing.toUpperCase()}
            </span>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {WORKFORCE_ROLES.map((role) => {
          const liveAgent = findRoleAgent(role.id, agents);
          const isFiring = firing === role.id;
          const isFocused = focused === role.id;
          const hasPrompt = !!(dispatches[role.id]?.trim());

          return (
            <div
              key={role.id}
              className="relative rounded-2xl overflow-hidden transition-all duration-300 group"
              style={{
                border: `1px solid ${isFiring ? role.accent : isFocused ? `${role.accent}60` : `${role.accent}20`}`,
                background: `linear-gradient(135deg, var(--color-surface) 0%, ${role.accent}08 100%)`,
                boxShadow: isFiring
                  ? `0 0 24px ${role.accent}40, 0 0 8px ${role.accent}20`
                  : isFocused
                  ? `0 0 12px ${role.accent}20`
                  : "none",
              }}
              onFocus={() => setFocused(role.id)}
              onBlur={() => setFocused(null)}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-300"
                style={{
                  background: `linear-gradient(90deg, ${role.accent}00, ${role.accent}, ${role.accent}00)`,
                  opacity: isFiring ? 1 : isFocused ? 0.6 : 0.3,
                }}
              />

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 relative"
                      style={{
                        background: `${role.accent}18`,
                        border: `1px solid ${role.accent}30`,
                      }}
                    >
                      <Bot size={18} style={{ color: role.accent }} />
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-surface)]"
                        style={{
                          background: isFiring ? role.accent : liveAgent ? "#22c55e" : "#f59e0b",
                          boxShadow: isFiring
                            ? `0 0 8px ${role.accent}`
                            : liveAgent ? "0 0 4px #4ade8080" : "0 0 4px #f59e0b80",
                        }}
                      />
                    </div>
                    <div>
                      <div
                        className="font-black text-sm tracking-wider uppercase"
                        style={{ color: role.accent }}
                      >
                        {role.name}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                        {role.title}
                      </div>
                    </div>
                  </div>

                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                    style={{
                      background: isFiring ? `${role.accent}30` : `${role.accent}12`,
                      color: isFiring ? role.accent : `${role.accent}aa`,
                      border: `1px solid ${isFiring ? role.accent : `${role.accent}20`}`,
                    }}
                  >
                    {isFiring ? "Sending" : liveAgent ? liveAgent.status : "Not registered"}
                  </span>
                </div>

                <div
                  className="rounded-lg px-3 py-2 space-y-0.5"
                  style={{ background: `${role.accent}08`, border: `1px solid ${role.accent}15` }}
                >
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: `${role.accent}80` }}>
                    LIVE STATUS
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {liveAgent ? `${liveAgent.name} · ${relativeTime(liveAgent.lastActivityAt)}` : `Create or expose an OpenClaw agent containing "${role.id}".`}
                  </p>
                </div>

                <div className="text-[10px] text-[var(--color-text-muted)] leading-relaxed px-0.5">
                  {role.responsibilities}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {role.systems.map((system) => (
                    <span key={system} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                      {system}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={dispatches[role.id] ?? ""}
                    onChange={(e) =>
                      setDispatches((prev) => ({ ...prev, [role.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void fire(role.id, liveAgent?.id ?? null);
                    }}
                    placeholder={liveAgent ? `Mission brief for ${role.name}...` : "Register this OpenClaw agent before dispatch."}
                    rows={2}
                    className="w-full text-xs rounded-lg px-3 py-2 text-[var(--color-text)] resize-none focus:outline-none transition-all"
                    style={{
                      background: "var(--color-surface-2)",
                      border: `1px solid ${isFocused || hasPrompt ? `${role.accent}50` : "var(--color-border)"}`,
                    }}
                    disabled={!liveAgent}
                  />
                  <button
                    onClick={() => void fire(role.id, liveAgent?.id ?? null)}
                    disabled={!hasPrompt || isFiring || !liveAgent}
                    className="w-full py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 disabled:opacity-30"
                    style={{
                      background: hasPrompt
                        ? isFiring
                          ? `${role.accent}50`
                          : `${role.accent}22`
                        : "var(--color-surface-2)",
                      color: hasPrompt ? role.accent : "var(--color-text-muted)",
                      border: `1px solid ${hasPrompt ? `${role.accent}40` : "var(--color-border)"}`,
                      boxShadow: hasPrompt && !isFiring ? `0 0 8px ${role.accent}20` : "none",
                    }}
                  >
                    {isFiring ? "DISPATCHING" : liveAgent ? "DISPATCH" : "NEEDS AGENT"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionNotesPanel({
  sessionKey,
}: {
  sessionKey: string;
}) {
  const [state, setState] = useState<SessionWorkspaceState>(() =>
    loadLocalJson<SessionWorkspaceState>(`elite-openclaw-session-${sessionKey}`, {
      notes: "",
      bookmarks: [],
    }),
  );

  useEffect(() => {
    persistLocalJson(`elite-openclaw-session-${sessionKey}`, state);
  }, [sessionKey, state]);

  return (
    <Card className="space-y-4">
      <div>
        <p className="section-kicker">Session notes</p>
        <h3 className="display-title !text-[var(--text-lg)]">Hamid's control notes</h3>
      </div>
      <textarea
        value={state.notes}
        onChange={(event) => setState((current) => ({...current, notes: event.target.value}))}
        placeholder="Tag context, risks, or decisions for this session."
        className="min-h-40 w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)]"
      />
      <p className="text-sm text-[var(--color-text-muted)]">
        Bookmarked message ids: {state.bookmarks.length ? state.bookmarks.join(", ") : "none yet"}
      </p>
    </Card>
  );
}

export function AgentsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AgentsTab>("overview");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [commandAgentId, setCommandAgentId] = useState("jarvis");
  const [commandSessionId, setCommandSessionId] = useState("");
  const [commandBody, setCommandBody] = useState("");
  const [pauseFeed, setPauseFeed] = useState(false);
  const [liveEvents, setLiveEvents] = useState<OpenClawActivityEvent[]>([]);
  const [playbooks, setPlaybooks] = useState<PlaybookDraft[]>(() =>
    loadLocalJson<PlaybookDraft[]>("elite-openclaw-playbooks", []),
  );
  const [newPlaybook, setNewPlaybook] = useState<PlaybookDraft>({
    id: "",
    name: "",
    agentId: "jarvis",
    prompt: "",
  });

  useEffect(() => {
    persistLocalJson("elite-openclaw-playbooks", playbooks);
  }, [playbooks]);

  const agentsQuery = useQuery({queryKey: ["openclaw-agents"], queryFn: fetchOpenClawAgents});
  const sessionsQuery = useQuery({queryKey: ["openclaw-sessions"], queryFn: fetchOpenClawSessions});
  const systemQuery = useQuery({queryKey: ["openclaw-system"], queryFn: fetchOpenClawSystem, refetchInterval: 30_000});
  const approvalsQuery = useQuery({queryKey: ["openclaw-approvals"], queryFn: fetchOpenClawApprovals, refetchInterval: 15_000});
  const agentDetailQuery = useQuery({
    queryKey: ["openclaw-agent", selectedAgentId],
    queryFn: () => fetchOpenClawAgent(selectedAgentId!),
    enabled: Boolean(selectedAgentId),
  });
  const sessionDetailQuery = useQuery({
    queryKey: ["openclaw-session", selectedSessionId],
    queryFn: () => fetchOpenClawSession(selectedSessionId!),
    enabled: Boolean(selectedSessionId),
  });
  const memoryQueryResult = useQuery({
    queryKey: ["openclaw-memory", memoryQuery],
    queryFn: () => fetchOpenClawMemory(memoryQuery),
  });

  useEffect(() => {
    const firstAgent = agentsQuery.data?.agents[0]?.id ?? null;
    if (!selectedAgentId && firstAgent) setSelectedAgentId(firstAgent);
    if (!commandAgentId && firstAgent) setCommandAgentId(firstAgent);
  }, [agentsQuery.data?.agents, selectedAgentId, commandAgentId]);

  useEffect(() => {
    const source = new EventSource("/api/openclaw/stream");
    source.addEventListener("activity", (event) => {
      if (pauseFeed) return;
      const payload = JSON.parse((event as MessageEvent).data) as OpenClawActivityEvent;
      setLiveEvents((current) => [payload, ...current].slice(0, 120));
    });
    return () => source.close();
  }, [pauseFeed]);

  const sendCommandMutation = useMutation({
    mutationFn: () =>
      sendOpenClawCommand(commandAgentId, {
        message: commandBody,
        sessionId: commandSessionId || undefined,
      }),
    onSuccess: async () => {
      setCommandBody("");
      setCommandModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["openclaw-sessions"]}),
        queryClient.invalidateQueries({queryKey: ["openclaw-agent", commandAgentId]}),
      ]);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({approvalId, decision}: {approvalId: string; decision: ApprovalDecision}) =>
      resolveOpenClawApproval(approvalId, decision),
    onSuccess: async () => {
      await queryClient.invalidateQueries({queryKey: ["openclaw-approvals"]});
    },
  });

  const sortedEvents = useMemo(
    () =>
      liveEvents.slice().sort((left, right) => right.at.localeCompare(left.at)),
    [liveEvents],
  );
  const sessions = sessionsQuery.data?.sessions ?? [];
  const agents = agentsQuery.data?.agents ?? [];
  const selectedSession = sessions.find((session) => session.sessionKey === selectedSessionId) ?? null;

  return (
    <>
      <PageWrapper
        eyebrow="Agents"
        title="Mission Control for every OpenClaw operator, session, memory surface, and approval."
        description="This is the cockpit over Hamid's local agent system: live feed, command dispatch, approval control, and searchable memory in one place."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={agents.length ? "info" : "warning"}>{agents.length} agents reported</Badge>
            <Button onClick={() => setCommandModalOpen(true)}>
              <Command size={16} />
              Global command
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {agentsTabOptions.map((option) => (
              <Button
                key={option.id}
                variant={tab === option.id ? "primary" : "secondary"}
                onClick={() => setTab(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {tab === "fleet" ? (
            <FleetTab
              agents={agents}
              onDispatch={async (agentId, prompt) => {
                await sendOpenClawCommand(agentId, { message: prompt });
                await Promise.all([
                  queryClient.invalidateQueries({queryKey: ["openclaw-sessions"]}),
                  queryClient.invalidateQueries({queryKey: ["openclaw-agent", agentId]}),
                ]);
              }}
            />
          ) : tab === "overview" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
              <div className="space-y-6">
                <Card className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="section-kicker">Agent grid</p>
                      <h2 className="display-title !text-[var(--text-lg)]">Live operator roster</h2>
                    </div>
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
                      <Bot size={18} className="text-[var(--color-accent)]" />
                    </span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {agentsQuery.isLoading ? (
                      <>
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-48 w-full" />
                      </>
                    ) : (
                      agents.map((agent) => (
                        <div key={agent.id} className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="section-kicker">{agent.id}</p>
                              <h3 className="display-title !text-[var(--text-lg)]">{agent.name}</h3>
                            </div>
                            <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
                          </div>
                          <p className="mt-3 text-sm text-[var(--color-text-muted)]">{agent.description}</p>
                          <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-muted)]">
                            <p><strong className="text-[var(--color-text)]">Primary:</strong> {agent.primaryModel ?? "Unknown"}</p>
                            <p><strong className="text-[var(--color-text)]">Fallbacks:</strong> {agent.fallbackModels.join(", ") || "None logged"}</p>
                            <p><strong className="text-[var(--color-text)]">Last activity:</strong> {relativeTime(agent.lastActivityAt)}</p>
                          </div>
                          <div className="mt-5 flex flex-wrap gap-3">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setCommandAgentId(agent.id);
                                setCommandModalOpen(true);
                              }}
                            >
                              <Send size={14} />
                              Send command
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setSelectedAgentId(agent.id);
                                setTab("sessions");
                              }}
                            >
                              View sessions
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="section-kicker">Live activity feed</p>
                      <h2 className="display-title !text-[var(--text-lg)]">Gateway and session traffic</h2>
                    </div>
                    <Button variant="ghost" onClick={() => setPauseFeed((current) => !current)}>
                      {pauseFeed ? "Resume feed" : "Pause feed"}
                    </Button>
                  </div>
                  <div className="max-h-[34rem] space-y-3 overflow-auto">
                    {sortedEvents.length ? (
                      sortedEvents.map((event) => (
                        <div key={event.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={eventVariant(event.type)}>{event.type}</Badge>
                            <p className="section-kicker">{new Date(event.at).toLocaleString("en-GB")}</p>
                            {event.agentId ? <Badge variant="neutral">{event.agentId}</Badge> : null}
                          </div>
                          <p className="mt-2 font-medium text-[var(--color-text)]">{event.title}</p>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{event.detail}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--color-text-faint)]">{event.impact}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">
                        The live feed will populate as soon as agent traffic hits the OpenClaw gateway or local session files update.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="section-kicker">Approvals</p>
                      <h2 className="display-title !text-[var(--text-lg)]">Human-in-the-loop queue</h2>
                    </div>
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
                      <ShieldCheck size={18} className="text-[var(--color-accent)]" />
                    </span>
                  </div>
                  <div className="space-y-3">
                    {approvalsQuery.data?.pending.length ? (
                      approvalsQuery.data.pending.map((approval) => (
                        <div key={approval.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="warning">{approval.agentId ?? "system"}</Badge>
                            <p className="section-kicker">{new Date(approval.requestedAt).toLocaleString("en-GB")}</p>
                          </div>
                          <p className="mt-2 font-medium">{approval.command}</p>
                          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{approval.rationale}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--color-text-faint)]">
                            {approval.estimatedImpact}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => approvalMutation.mutate({approvalId: approval.id, decision: "allow-once"})}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => approvalMutation.mutate({approvalId: approval.id, decision: "allow-always"})}
                            >
                              Allow always
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => approvalMutation.mutate({approvalId: approval.id, decision: "deny"})}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">
                        No pending approvals are waiting right now.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="space-y-5">
                  <div>
                    <p className="section-kicker">System health</p>
                    <h2 className="display-title !text-[var(--text-lg)]">Host telemetry</h2>
                  </div>
                  {systemQuery.isLoading ? (
                    <Skeleton className="h-56 w-full" />
                  ) : systemQuery.data ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={systemQuery.data.status === "Critical" ? "error" : systemQuery.data.status === "Elevated" ? "warning" : "success"}>
                          {systemQuery.data.status}
                        </Badge>
                        <span className="text-sm text-[var(--color-text-muted)]">Live OpenClaw host profile</span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        {[
                          {label: "CPU", value: systemQuery.data.cpuLoad, icon: Gauge},
                          {label: "Memory", value: systemQuery.data.memoryUsedPct, icon: BrainCircuit},
                          {label: "Disk", value: systemQuery.data.diskUsedPct, icon: DatabaseZap},
                        ].map((metric) => {
                          const Icon = metric.icon;
                          const history =
                            metric.label === "CPU"
                              ? systemQuery.data.history.cpuLoad
                              : metric.label === "Memory"
                                ? systemQuery.data.history.memoryUsedPct
                                : systemQuery.data.history.diskUsedPct;
                          return (
                            <div key={metric.label} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="section-kicker">{metric.label}</p>
                                <Icon size={16} className="text-[var(--color-accent)]" />
                              </div>
                              <p className="metric-mono mt-2 text-3xl font-semibold">{metric.value}%</p>
                              <div className="mt-4 h-16">
                                <Sparkline values={history} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </Card>

                <Card className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="section-kicker">Playbooks</p>
                      <h2 className="display-title !text-[var(--text-lg)]">Runbooks for repeat workflows</h2>
                    </div>
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
                      <CirclePlay size={18} className="text-[var(--color-accent)]" />
                    </span>
                  </div>
                  <div className="space-y-3">
                    {playbooks.map((playbook) => (
                      <div key={playbook.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">{playbook.name}</p>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{playbook.agentId}</p>
                          </div>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setCommandAgentId(playbook.agentId);
                              setCommandBody(playbook.prompt);
                              setCommandModalOpen(true);
                            }}
                          >
                            Run
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3">
                    <Input
                      label="Playbook name"
                      value={newPlaybook.name}
                      onChange={(event) => setNewPlaybook((current) => ({...current, name: event.target.value, id: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}))}
                    />
                    <Input
                      label="Agent id"
                      value={newPlaybook.agentId}
                      onChange={(event) => setNewPlaybook((current) => ({...current, agentId: event.target.value}))}
                    />
                    <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
                      Playbook prompt
                      <textarea
                        value={newPlaybook.prompt}
                        onChange={(event) => setNewPlaybook((current) => ({...current, prompt: event.target.value}))}
                        className="min-h-32 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)]"
                      />
                    </label>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!newPlaybook.name.trim() || !newPlaybook.prompt.trim()) return;
                        setPlaybooks((current) => [...current, newPlaybook]);
                        setNewPlaybook({id: "", name: "", agentId: "jarvis", prompt: ""});
                      }}
                    >
                      Save playbook
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {tab === "sessions" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
              <Card className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="section-kicker">Sessions</p>
                    <h2 className="display-title !text-[var(--text-lg)]">Live mission sessions</h2>
                  </div>
                  <Badge variant="info">{sessions.length} sessions</Badge>
                </div>
                <div className="space-y-3">
                  {sessionsQuery.isLoading ? (
                    <Skeleton className="h-72 w-full" />
                  ) : sessions.length ? (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.sessionKey)}
                        className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="section-kicker">{session.agentName}</p>
                            <p className="font-medium text-[var(--color-text)]">{session.sessionKey}</p>
                          </div>
                          <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="neutral">{session.channel}</Badge>
                          <Badge variant="info">{session.status}</Badge>
                          <Badge variant="success">{session.messageCount} messages</Badge>
                        </div>
                        <p className="mt-3 text-sm text-[var(--color-text-muted)]">{session.lastMessage || "No last message preview."}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--color-text-faint)]">
                          {relativeTime(session.lastActivityAt)}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">
                      No OpenClaw sessions are visible yet.
                    </div>
                  )}
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="space-y-5">
                  <div>
                    <p className="section-kicker">Session detail</p>
                    <h2 className="display-title !text-[var(--text-lg)]">
                      {selectedSession ? selectedSession.agentName : "Select a session"}
                    </h2>
                  </div>
                  {sessionDetailQuery.isLoading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : sessionDetailQuery.data ? (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.85fr)]">
                      <div className="space-y-3">
                        <p className="section-kicker">Conversation</p>
                        <div className="max-h-[32rem] space-y-3 overflow-auto">
                          {sessionDetailQuery.data.messages.map((message) => (
                            <div key={message.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={message.role === "assistant" ? "info" : message.role === "user" ? "neutral" : "warning"}>
                                  {message.role}
                                </Badge>
                                {message.at ? (
                                  <p className="section-kicker">{new Date(message.at).toLocaleString("en-GB")}</p>
                                ) : null}
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
                                {message.text || "No text body"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="section-kicker">Tool activity</p>
                        <div className="max-h-[32rem] space-y-3 overflow-auto">
                          {sessionDetailQuery.data.tools.length ? (
                            sessionDetailQuery.data.tools.map((tool) => (
                              <div key={tool.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={tool.outcome === "error" ? "error" : tool.outcome === "success" ? "success" : "neutral"}>
                                    {tool.outcome}
                                  </Badge>
                                  <p className="font-medium">{tool.name}</p>
                                </div>
                                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{tool.summary}</p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8 text-sm text-[var(--color-text-muted)]">
                              No tool activity captured for this session yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">
                      Choose a session to inspect the full conversation and tool activity.
                    </div>
                  )}
                </Card>

                {selectedSession ? <SessionNotesPanel sessionKey={selectedSession.sessionKey} /> : null}
              </div>
            </div>
          ) : null}

          {tab === "skills-memory" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-6">
                <Card className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="section-kicker">Agent inspector</p>
                      <h2 className="display-title !text-[var(--text-lg)]">Identity and skills</h2>
                    </div>
                    <select
                      value={selectedAgentId ?? ""}
                      onChange={(event) => setSelectedAgentId(event.target.value)}
                      className="min-h-11 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4"
                    >
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  {agentDetailQuery.isLoading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : agentDetailQuery.data ? (
                    <div className="space-y-5">
                      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                        <p className="section-kicker">Identity file</p>
                        <p className="mt-2 text-sm text-[var(--color-text-muted)] break-all">
                          {agentDetailQuery.data.identityFilePath ?? "Read-only identity surface"}
                        </p>
                        <pre className="mt-4 max-h-72 overflow-auto rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-4 text-sm whitespace-pre-wrap text-[var(--color-text-muted)]">
                          {agentDetailQuery.data.identityText || "No AGENTS.md content could be loaded for this agent."}
                        </pre>
                      </div>
                      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                        <div className="flex items-center gap-2">
                          <Wrench size={16} className="text-[var(--color-accent)]" />
                          <p className="section-kicker">Skills</p>
                        </div>
                        <div className="mt-4 space-y-3">
                          {agentDetailQuery.data.skills.length ? (
                            agentDetailQuery.data.skills.map((skill) => (
                              <div key={skill.name} className="rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">{skill.name}</p>
                                  <Badge variant={skill.enabled ? "success" : "neutral"}>
                                    {skill.enabled ? "enabled" : "disabled"}
                                  </Badge>
                                  {skill.target ? <Badge variant="info">{skill.target}</Badge> : null}
                                </div>
                                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{skill.description || "No description available."}</p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8 text-sm text-[var(--color-text-muted)]">
                              Skills could not be resolved for this agent yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="section-kicker">Memory viewer</p>
                      <h2 className="display-title !text-[var(--text-lg)]">Search across OpenClaw memory</h2>
                    </div>
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
                      <BrainCircuit size={18} className="text-[var(--color-accent)]" />
                    </span>
                  </div>
                  <Input
                    label="Search memory"
                    value={memoryQuery}
                    onChange={(event) => setMemoryQuery(event.target.value)}
                    placeholder="Search MEMORY.md, HEARTBEAT.md, or stored notes."
                  />
                  <div className="max-h-[46rem] space-y-4 overflow-auto">
                    {memoryQueryResult.isLoading ? (
                      <Skeleton className="h-96 w-full" />
                    ) : memoryQueryResult.data?.sections.length ? (
                      memoryQueryResult.data.sections.map((section) => (
                        <div key={section.path} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-2">
                            <MessagesSquare size={14} className="text-[var(--color-accent)]" />
                            <p className="font-medium">{section.title}</p>
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--color-text-faint)] break-all">
                            {section.path}
                          </p>
                          <pre className="mt-4 max-h-72 overflow-auto rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-4 text-sm whitespace-pre-wrap text-[var(--color-text-muted)]">
                            {section.body}
                          </pre>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">
                        No memory documents matched this search yet.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          ) : null}
        </div>
      </PageWrapper>

      <Modal
        open={commandModalOpen}
        title="Global Command"
        description="Route a mission command into any OpenClaw agent or existing session."
        onClose={() => setCommandModalOpen(false)}
      >
        <div className="space-y-4">
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Agent
            <select
              value={commandAgentId}
              onChange={(event) => setCommandAgentId(event.target.value)}
              className="min-h-11 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Existing session key (optional)
            <input
              value={commandSessionId}
              onChange={(event) => setCommandSessionId(event.target.value)}
              placeholder="agent:jarvis:main"
              className="min-h-11 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text)]">
            Message
            <textarea
              value={commandBody}
              onChange={(event) => setCommandBody(event.target.value)}
              placeholder="What do you need the agent to do?"
              className="min-h-40 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)]"
            />
          </label>
          <Button onClick={() => sendCommandMutation.mutate()} disabled={!commandBody.trim() || sendCommandMutation.isPending}>
            <Send size={16} />
            Send command
          </Button>
          {sendCommandMutation.data?.replyText ? (
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
              <p className="section-kicker">Latest reply</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
                {sendCommandMutation.data.replyText}
              </p>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
