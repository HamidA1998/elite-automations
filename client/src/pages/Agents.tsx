import { useState, useEffect, useRef } from "react";
import { openclawApi } from "@/services/openclaw";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import type { Agent, AgentSession, LiveEvent, SystemStats } from "@/types";
import {
  Bot, Zap, Activity, Terminal, Send, RefreshCw,
  Circle, CheckCircle2, XCircle, Clock, Cpu, HardDrive,
  MessageSquare, ChevronRight, AlertTriangle,
} from "lucide-react";

// ─── Status helpers ─────────────────────────────────────────────────────────
function agentStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "error" | "default" | "muted" }> = {
    online:  { label: "Online",  variant: "success" },
    busy:    { label: "Busy",    variant: "warning" },
    offline: { label: "Offline", variant: "muted" },
    error:   { label: "Error",   variant: "error" },
  };
  return map[status] ?? { label: status, variant: "default" };
}

// ─── Agent card ─────────────────────────────────────────────────────────────
function AgentCard({ agent, selected, onSelect }: {
  agent: Agent;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = agentStatusBadge(agent.status);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200
        ${selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
            ${agent.status === "online" ? "bg-emerald-400/15 text-emerald-400" : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"}`}>
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)] truncate">{agent.name}</div>
            <div className="text-xs text-[var(--color-text-muted)] truncate">{agent.id}</div>
          </div>
        </div>
        <Badge label={badge.label} variant={badge.variant} />
      </div>
      {agent.currentTask && (
        <div className="mt-3 text-xs text-[var(--color-text-muted)] truncate">
          <span className="text-[var(--color-accent)]">▶</span> {agent.currentTask}
        </div>
      )}
      {agent.skills && agent.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.skills.slice(0, 3).map((s) => (
            <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-text-muted)]">
              {s}
            </span>
          ))}
          {agent.skills.length > 3 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-text-muted)]">
              +{agent.skills.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Session timeline ────────────────────────────────────────────────────────
function SessionView({ session }: { session: AgentSession }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [session.messages]);

  return (
    <div ref={containerRef} className="space-y-3 overflow-y-auto max-h-[400px] pr-1">
      {session.messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${msg.role === "user"
              ? "bg-[var(--color-accent)] text-white rounded-br-sm"
              : msg.role === "system"
                ? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs italic"
                : "bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-bl-sm"
            }`}
          >
            {msg.content}
            <div className={`text-xs mt-1.5 ${msg.role === "user" ? "text-white/60" : "text-[var(--color-text-muted)]"}`}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Command panel ────────────────────────────────────────────────────────────
function CommandPanel({ agent, onSent }: { agent: Agent; onSent: () => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await openclawApi.sendCommand(agent.id, input.trim());
      setInput("");
      onSent();
    } catch (e: any) {
      setError(e.message ?? "Failed to send command");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Send command to ${agent.name}…`}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          className="flex-1 h-10 px-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
        <Button variant="primary" size="sm" onClick={send} loading={loading} disabled={!input.trim()}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}

// ─── Live event feed ──────────────────────────────────────────────────────────
function LiveEventFeed({ events }: { events: LiveEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events]);

  return (
    <div ref={ref} className="overflow-y-auto max-h-64 space-y-1 font-mono text-xs">
      {events.length === 0 && (
        <div className="text-[var(--color-text-muted)] py-4 text-center">No events yet…</div>
      )}
      {[...events].reverse().slice(0, 50).map((ev) => (
        <div key={ev.id} className="flex items-start gap-2 py-1 border-b border-[var(--color-border)]/40 last:border-0">
          <span className="text-[var(--color-text-muted)] flex-shrink-0">
            {new Date(ev.timestamp).toLocaleTimeString()}
          </span>
          <span className={`flex-shrink-0 ${
            ev.type === "agent_event" ? "text-cyan-400" :
            ev.type === "lead_added" ? "text-[var(--color-accent)]" :
            ev.type === "email_sent" ? "text-emerald-400" : "text-[var(--color-text-muted)]"
          }`}>
            [{ev.type}]
          </span>
          <span className="text-[var(--color-text)] break-all">{ev.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── System stats strip ───────────────────────────────────────────────────────
function SystemStatsBar({ stats }: { stats: SystemStats }) {
  return (
    <div className="flex items-center gap-6 flex-wrap text-xs text-[var(--color-text-muted)]">
      <div className="flex items-center gap-1.5">
        <Cpu size={12} className="text-[var(--color-accent)]" />
        <span>CPU <span className="font-mono text-[var(--color-text)]">{stats.cpuPercent}%</span></span>
      </div>
      <div className="flex items-center gap-1.5">
        <HardDrive size={12} className="text-cyan-400" />
        <span>RAM <span className="font-mono text-[var(--color-text)]">{stats.memoryPercent}%</span></span>
      </div>
      <div className="flex items-center gap-1.5">
        <Bot size={12} className="text-emerald-400" />
        <span><span className="font-mono text-[var(--color-text)]">{stats.activeAgents}</span> agents</span>
      </div>
      <div className="flex items-center gap-1.5">
        <MessageSquare size={12} className="text-amber-400" />
        <span><span className="font-mono text-[var(--color-text)]">{stats.totalSessions}</span> sessions</span>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
type Tab = "overview" | "sessions" | "events";

export function Agents() {
  const [tab, setTab] = useState<Tab>("overview");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ag, st] = await Promise.all([
        openclawApi.listAgents(),
        openclawApi.getSystemStats(),
      ]);
      setAgents(ag);
      setStats(st);
    } catch (e: any) {
      setError(e.message ?? "Cannot connect to OpenClaw gateway");
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const s = await openclawApi.listSessions();
      setSessions(s);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();

    // SSE live events
    const unsub = openclawApi.streamEvents((ev) => {
      setLiveEvents((prev) => [...prev.slice(-199), ev]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (tab === "sessions") loadSessions();
  }, [tab]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <Activity size={14} /> },
    { key: "sessions", label: "Sessions", icon: <MessageSquare size={14} /> },
    { key: "events",   label: "Live Events", icon: <Terminal size={14} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Agent Mission Control</h1>
          <p className="text-sm text-[var(--color-text-muted)]">OpenClaw local AI gateway</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
          <SystemStatsBar stats={stats} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-5 py-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-400">Cannot reach OpenClaw gateway</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{error}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              Ensure OpenClaw is running and <code className="font-mono bg-[var(--color-surface-2)] px-1 py-0.5 rounded">OPENCLAW_GATEWAY_URL</code> is set in your .env
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150
              ${tab === key
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Agent list */}
          <div className="space-y-3">
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
            {!loading && agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selected={selectedAgent?.id === agent.id}
                onSelect={() => setSelectedAgent(agent)}
              />
            ))}
            {!loading && agents.length === 0 && !error && (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-muted)]">
                No agents found
              </div>
            )}
          </div>

          {/* Agent detail + command */}
          <div className="lg:col-span-2 space-y-4">
            {selectedAgent ? (
              <>
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/15 flex items-center justify-center">
                        <Bot size={20} className="text-[var(--color-accent)]" />
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--color-text)]">{selectedAgent.name}</div>
                        <div className="text-xs font-mono text-[var(--color-text-muted)]">{selectedAgent.id}</div>
                      </div>
                    </div>
                    <Badge {...agentStatusBadge(selectedAgent.status)} />
                  </div>

                  {selectedAgent.skills && selectedAgent.skills.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Skills</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedAgent.skills.map((s) => (
                          <span key={s} className="text-xs px-2 py-1 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAgent.currentTask && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                      <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">Current Task</div>
                      <div className="text-sm text-[var(--color-text)]">{selectedAgent.currentTask}</div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <div className="text-sm font-semibold text-[var(--color-text)] mb-3">Send Command</div>
                  <CommandPanel agent={selectedAgent} onSent={load} />
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-16 text-center">
                <Bot size={40} className="text-[var(--color-text-muted)] mx-auto mb-3" />
                <p className="text-sm text-[var(--color-text-muted)]">Select an agent to view details and send commands</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "sessions" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Session list */}
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-150
                  ${selectedSession?.id === s.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)]"
                  }`}
              >
                <div className="text-xs font-semibold text-[var(--color-text)] truncate">{s.agentId}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {s.messages.length} messages · {new Date(s.startedAt).toLocaleTimeString()}
                </div>
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-text-muted)]">
                No sessions found
              </div>
            )}
          </div>

          {/* Session view */}
          <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            {selectedSession ? (
              <SessionView session={selectedSession} />
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-muted)]">
                Select a session to view messages
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm font-semibold text-[var(--color-text)]">Live Event Stream</span>
            <span className="ml-auto text-xs text-[var(--color-text-muted)] font-mono">{liveEvents.length} events</span>
          </div>
          <LiveEventFeed events={liveEvents} />
        </div>
      )}
    </div>
  );
}
