import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  fetchClient360,
  fetchIntegrationsStatus,
  fetchMailInbox,
  fetchOpenClawApprovals,
  fetchOpenClawSessions,
  apiUrl,
} from "@/services/api";
import type { Client360TimelineEvent, IntegrationConnector, MailInboxMessage, OpenClawSessionSummary } from "@/types/frontend";

type EventType = "workflow" | "pipeline" | "call" | "email" | "system" | "approval";
type FilterType = "all" | EventType;

interface CallSummary {
  configured: boolean;
  recentCalls: Array<{
    sid: string;
    to: string;
    from: string;
    status: string;
    duration: string;
    start_time: string;
    direction: string;
  }>;
}

interface TimelineEvent {
  id: string;
  type: EventType;
  event: string;
  agent?: string;
  timestamp: string;
  href: string;
  source: string;
}

async function fetchCallSummary(): Promise<CallSummary> {
  const response = await fetch(apiUrl("/api/calls/summary"));
  if (!response.ok) throw new Error("Call summary unavailable");
  return response.json() as Promise<CallSummary>;
}

function eventTypeFromClientEvent(event: Client360TimelineEvent): EventType {
  if (event.channel === "call") return "call";
  if (event.channel === "email") return "email";
  if (event.channel === "proposal") return "pipeline";
  if (event.channel === "ops") return "workflow";
  return "pipeline";
}

function eventTimestamp(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const iso = date.toISOString().slice(0, 10);
  if (iso === today.toISOString().slice(0, 10)) return "Today";
  if (iso === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function eventTone(type: EventType): string {
  const tones: Record<EventType, string> = {
    workflow: "bg-pink-400",
    pipeline: "bg-cyan-400",
    call: "bg-green-400",
    email: "bg-violet-400",
    system: "bg-orange-400",
    approval: "bg-yellow-400",
  };
  return tones[type];
}

function eventLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    workflow: "WORKFLOW",
    pipeline: "PIPELINE",
    call: "CALL",
    email: "EMAIL",
    system: "SYSTEM",
    approval: "APPROVAL",
  };
  return labels[type];
}

function clientEventToTimeline(event: Client360TimelineEvent): TimelineEvent {
  return {
    id: `client-${event.id}`,
    type: eventTypeFromClientEvent(event),
    event: `${event.businessName}: ${event.label}${event.body ? ` - ${event.body}` : ""}`,
    agent: event.actor,
    timestamp: eventTimestamp(event.at, new Date().toISOString()),
    href: `/leads/${event.clientId}`,
    source: event.channel,
  };
}

function mailToTimeline(message: MailInboxMessage): TimelineEvent {
  return {
    id: `mail-${message.id}`,
    type: "email",
    event: `${message.fromName || message.fromEmail}: ${message.subject || "No subject"}${message.preview ? ` - ${message.preview}` : ""}`,
    agent: message.tag,
    timestamp: eventTimestamp(message.receivedAt, new Date().toISOString()),
    href: "/mail",
    source: "gmail",
  };
}

function callToTimeline(call: CallSummary["recentCalls"][number]): TimelineEvent {
  const counterparty = call.direction === "inbound" ? call.from : call.to;
  return {
    id: `call-${call.sid}`,
    type: "call",
    event: `${call.direction.replace("-", " ")} call with ${counterparty} - ${call.status}${call.duration ? ` · ${call.duration}s` : ""}`,
    agent: "Twilio",
    timestamp: eventTimestamp(call.start_time, new Date().toISOString()),
    href: "/calls/logs",
    source: "twilio",
  };
}

function sessionToTimeline(session: OpenClawSessionSummary): TimelineEvent {
  return {
    id: `session-${session.id}`,
    type: session.status === "error" ? "system" : "workflow",
    event: `${session.agentName}: ${session.lastMessage || `${session.messageCount} messages in ${session.channel}`}`,
    agent: session.agentName,
    timestamp: eventTimestamp(session.lastActivityAt ?? session.startedAt, new Date().toISOString()),
    href: "/agents",
    source: "openclaw",
  };
}

function connectorToTimeline(connector: IntegrationConnector, generatedAt: string): TimelineEvent {
  return {
    id: `connector-${connector.provider}`,
    type: connector.status === "connected" ? "system" : "approval",
    event: `${connector.label}: ${connector.status}${connector.error ? ` - ${connector.error}` : ""}`,
    agent: connector.provider,
    timestamp: eventTimestamp(connector.syncedAt, generatedAt),
    href: "/ops/health",
    source: "integration",
  };
}

export function TimelinePage() {
  const [filter, setFilter] = useState<FilterType>("all");

  const client360Query = useQuery({ queryKey: ["client-360"], queryFn: fetchClient360, staleTime: 60_000 });
  const mailQuery = useQuery({ queryKey: ["mail-inbox", "timeline"], queryFn: () => fetchMailInbox({ maxResults: 12 }), staleTime: 60_000 });
  const callsQuery = useQuery({ queryKey: ["calls-summary"], queryFn: fetchCallSummary, staleTime: 30_000 });
  const sessionsQuery = useQuery({ queryKey: ["openclaw-sessions"], queryFn: fetchOpenClawSessions, staleTime: 30_000 });
  const approvalsQuery = useQuery({ queryKey: ["openclaw-approvals"], queryFn: fetchOpenClawApprovals, staleTime: 15_000 });
  const integrationsQuery = useQuery({ queryKey: ["integrations-status"], queryFn: fetchIntegrationsStatus, staleTime: 60_000 });

  const liveEvents = useMemo<TimelineEvent[]>(() => {
    const generatedAt = new Date().toISOString();
    const clientEvents = (client360Query.data?.timeline ?? []).slice(0, 40).map(clientEventToTimeline);
    const mailEvents = (mailQuery.data?.messages ?? []).slice(0, 12).map(mailToTimeline);
    const callEvents = (callsQuery.data?.recentCalls ?? []).slice(0, 12).map(callToTimeline);
    const sessionEvents = (sessionsQuery.data?.sessions ?? []).slice(0, 16).map(sessionToTimeline);
    const approvalEvents = (approvalsQuery.data?.pending ?? []).map((approval) => ({
      id: `approval-${approval.id}`,
      type: "approval" as const,
      event: `Approval requested: ${approval.command} - ${approval.rationale}`,
      agent: approval.agentId ?? "system",
      timestamp: eventTimestamp(approval.requestedAt, generatedAt),
      href: "/ops/approvals",
      source: "openclaw",
    }));
    const connectorEvents = (integrationsQuery.data?.connectors ?? [])
      .filter((connector) => connector.status !== "connected")
      .map((connector) => connectorToTimeline(connector, integrationsQuery.data?.generatedAt ?? generatedAt));

    return [
      ...clientEvents,
      ...mailEvents,
      ...callEvents,
      ...sessionEvents,
      ...approvalEvents,
      ...connectorEvents,
    ]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, 120);
  }, [
    approvalsQuery.data?.pending,
    callsQuery.data?.recentCalls,
    client360Query.data?.timeline,
    integrationsQuery.data?.connectors,
    integrationsQuery.data?.generatedAt,
    mailQuery.data?.messages,
    sessionsQuery.data?.sessions,
  ]);

  const filtered = filter === "all" ? liveEvents : liveEvents.filter((event) => event.type === filter);
  const filterTypes: FilterType[] = ["all", "workflow", "pipeline", "call", "email", "system", "approval"];
  const isLoading =
    client360Query.isLoading ||
    mailQuery.isLoading ||
    callsQuery.isLoading ||
    sessionsQuery.isLoading ||
    approvalsQuery.isLoading ||
    integrationsQuery.isLoading;

  return (
    <PageWrapper
      eyebrow="HAMID.OS · LIVE OPERATIONAL HISTORY"
      title="Timeline"
      description="Live chronological truth from CRM, Gmail, Twilio, OpenClaw, approvals, and integration health. No mock events."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {filterTypes.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-all ${
                filter === item
                  ? "bg-[var(--color-accent)] text-black"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {item !== "all" ? <span className={`size-2 rounded-full ${eventTone(item)}`} /> : null}
              {item === "all" ? "ALL LIVE EVENTS" : eventLabel(item)}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--color-text-muted)]">
            {isLoading ? "Syncing live sources..." : `${filtered.length} event${filtered.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <Card className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
              No live events for this filter yet. Run acquisition, send mail, make a call, or move a client record and it will appear here.
            </div>
          ) : (
            <div className="relative">
              <div className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--color-border)]" />
              <div className="space-y-0">
                {filtered.map((event, index) => {
                  const showDateSeparator = index === 0 || formatDateLabel(event.timestamp) !== formatDateLabel(filtered[index - 1].timestamp);
                  return (
                    <div key={event.id}>
                      {showDateSeparator ? (
                        <div className="mb-4 mt-6 flex items-center gap-3 pl-6 first:mt-0">
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            {formatDateLabel(event.timestamp)}
                          </span>
                          <div className="h-px flex-1 bg-[var(--color-border)]" />
                        </div>
                      ) : null}
                      <Link to={event.href} className="group flex items-start gap-4 rounded-[var(--radius-xl)] py-2 transition-colors hover:bg-[var(--color-surface-2)]">
                        <span className={`z-10 mt-1.5 size-3.5 shrink-0 rounded-full ${eventTone(event.type)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="line-clamp-2 text-sm">{event.event}</span>
                            {event.agent ? <Badge variant="neutral" className="text-xs">{event.agent}</Badge> : null}
                            <Badge variant="info" className="text-xs">{event.source}</Badge>
                          </div>
                        </div>
                        <span className="metric-mono shrink-0 text-xs text-[var(--color-text-muted)]">{formatTime(event.timestamp)}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
