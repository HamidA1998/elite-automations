import type { Agent, AgentSession, LiveEvent, SystemStats } from "@/types";

const BASE = "/api/openclaw";

async function ocRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({ error: "Invalid response" }));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const openclawApi = {
  listAgents: () => ocRequest<{ agents: Agent[] }>("/agents"),
  getAgent: (id: string) => ocRequest<Agent>(`/agents/${encodeURIComponent(id)}`),
  listSessions: () => ocRequest<{ sessions: AgentSession[] }>("/sessions"),
  getSession: (id: string) => ocRequest<AgentSession>(`/sessions/${encodeURIComponent(id)}`),
  getSystemStats: () => ocRequest<SystemStats>("/system"),

  sendCommand: (agentId: string, message: string, sessionId?: string, metadata?: Record<string, unknown>) =>
    ocRequest<{ reply: string; sessionId: string }>(`/agents/${encodeURIComponent(agentId)}/send`, {
      method: "POST",
      body: JSON.stringify({ message, sessionId, metadata }),
    }),

  // SSE connection for live events
  streamEvents: (
    onEvent: (event: LiveEvent) => void,
    onError?: (err: Event) => void
  ): (() => void) => {
    const source = new EventSource("/api/openclaw/stream");
    source.addEventListener("agent-event", (e: MessageEvent) => {
      try {
        onEvent(JSON.parse(e.data) as LiveEvent);
      } catch {
        // malformed event — ignore
      }
    });
    if (onError) source.addEventListener("error", onError);
    return () => source.close();
  },
};
