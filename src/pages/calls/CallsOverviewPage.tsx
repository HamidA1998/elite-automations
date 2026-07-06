import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneCall, PhoneIncoming, MessageSquare, Voicemail, TrendingUp, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { apiUrl } from "@/services/api";

async function fetchCallsOverview() {
  const res = await fetch(apiUrl("/api/calls/summary"));
  if (!res.ok) throw new Error("Failed to fetch calls summary");
  return res.json() as Promise<{
    configured: boolean;
    phoneNumber: string;
    totalCalls: number;
    answeredCalls: number;
    failedCalls: number;
    totalMessages: number;
    totalRecordings: number;
    recentCalls: Array<{
      sid: string;
      to: string;
      from: string;
      status: string;
      duration: string;
      start_time: string;
      direction: string;
    }>;
    recentMessages: Array<{
      sid: string;
      to: string;
      from: string;
      body: string;
      status: string;
      direction: string;
      date_sent: string;
    }>;
  }>;
}

const statusColors: Record<string, string> = {
  completed:  "text-green-400 bg-green-500/10",
  "in-progress": "text-blue-400 bg-blue-500/10",
  failed:     "text-red-400 bg-red-500/10",
  busy:       "text-yellow-400 bg-yellow-500/10",
  "no-answer":"text-orange-400 bg-orange-500/10",
  queued:     "text-purple-400 bg-purple-500/10",
  ringing:    "text-blue-300 bg-blue-500/10",
  canceled:   "text-[var(--color-text-muted)] bg-[var(--color-surface-3)]",
};

function fmtDuration(secs: string | number): string {
  const s = Number(secs);
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function fmtTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CallsOverviewPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["calls-summary"],
    queryFn: fetchCallsOverview,
    staleTime: 30_000,
  });

  const kpis = [
    { label: "Total calls",     value: data?.totalCalls     ?? 0, icon: PhoneCall,    color: "var(--color-accent)" },
    { label: "Answered",        value: data?.answeredCalls  ?? 0, icon: Phone,        color: "#22c55e" },
    { label: "Failed / No ans", value: data?.failedCalls    ?? 0, icon: Voicemail,    color: "#f59e0b" },
    { label: "SMS sent",        value: data?.totalMessages  ?? 0, icon: MessageSquare,color: "#8b5cf6" },
  ];

  if (!data?.configured && !isLoading) {
    return (
      <PageWrapper
        eyebrow="Calls & SMS"
        title="Twilio not configured"
        description="Add your Twilio credentials to unlock the full calls system."
      >
        <Card className="py-12 flex flex-col items-center gap-4 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
            <Phone size={28} className="text-[var(--color-text-muted)]" />
          </span>
          <div className="max-w-sm">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Connect Twilio to get started</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Add these keys to your <code className="text-[var(--color-accent)]">.env.local</code> file:
            </p>
            <pre className="mt-3 text-left text-xs bg-[var(--color-surface-3)] rounded-xl p-4 text-[var(--color-text-muted)]">
{`TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxxxx
TWILIO_PHONE_NUMBER=+44xxxxxx`}
            </pre>
          </div>
          <Link to="/settings" className="mt-2 text-sm text-[var(--color-accent)] hover:underline">
            Go to Settings →
          </Link>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      eyebrow="Calls & SMS"
      title="Communication centre"
      description={data?.phoneNumber ? `Active line: ${data.phoneNumber}` : "Your Twilio-powered call and messaging hub."}
    >
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-panel rounded-[var(--radius-2xl)] p-5 flex items-center gap-4">
            <span className="inline-flex size-11 items-center justify-center rounded-full shrink-0" style={{ background: color + "20", color }}>
              <Icon size={20} />
            </span>
            <div>
              <p className="text-2xl font-black text-[var(--color-text)] leading-none">
                {isLoading ? "—" : value.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { to: "/calls/outbound", icon: PhoneCall,     label: "Make a call",   desc: "Manual or AI agent",      color: "var(--color-accent)" },
          { to: "/calls/logs",     icon: TrendingUp,    label: "Call logs",     desc: "All calls & recordings",  color: "#22c55e" },
          { to: "/calls/messages", icon: MessageSquare, label: "Messages",      desc: "SMS inbox & compose",     color: "#8b5cf6" },
          { to: "/calls/agents",   icon: Bot,           label: "AI agent",      desc: "ElevenLabs voice config", color: "#f59e0b" },
        ].map(({ to, icon: Icon, label, desc, color }) => (
          <Link
            key={to}
            to={to}
            className="glass-panel rounded-[var(--radius-2xl)] p-4 flex flex-col gap-2 hover:scale-[1.02] transition-transform"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-full" style={{ background: color + "20", color }}>
              <Icon size={18} />
            </span>
            <p className="text-sm font-bold text-[var(--color-text)]">{label}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recent calls */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Recent</p>
              <h2 className="display-title !text-[var(--text-lg)]">Call log</h2>
            </div>
            <Link to="/calls/logs" className="text-xs text-[var(--color-accent)] hover:underline">View all →</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
            </div>
          ) : isError ? (
            <p className="text-sm text-red-400">Failed to load call logs.</p>
          ) : (data?.recentCalls ?? []).length === 0 ? (
            <div className="py-8 flex flex-col items-center text-center text-[var(--color-text-muted)]">
              <PhoneIncoming size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No calls yet. Make your first call.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {(data?.recentCalls ?? []).map(call => (
                <div key={call.sid} className="flex items-center gap-3 py-3">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)] shrink-0">
                    {call.direction === "inbound" ? <PhoneIncoming size={13} /> : <PhoneCall size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {call.direction === "inbound" ? call.from : call.to}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{fmtTime(call.start_time)} · {fmtDuration(call.duration)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[call.status] ?? "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"}`}>
                    {call.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent SMS */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Recent</p>
              <h2 className="display-title !text-[var(--text-lg)]">Messages</h2>
            </div>
            <Link to="/calls/messages" className="text-xs text-[var(--color-accent)] hover:underline">View all →</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
            </div>
          ) : (data?.recentMessages ?? []).length === 0 ? (
            <div className="py-8 flex flex-col items-center text-center text-[var(--color-text-muted)]">
              <MessageSquare size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No messages yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {(data?.recentMessages ?? []).map(msg => (
                <div key={msg.sid} className="flex items-start gap-3 py-3">
                  <span className={`inline-flex size-8 items-center justify-center rounded-full shrink-0 ${msg.direction === "inbound" ? "bg-green-500/10 text-green-400" : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"}`}>
                    <MessageSquare size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {msg.direction === "inbound" ? msg.from : msg.to}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{msg.body}</p>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] shrink-0">{fmtTime(msg.date_sent)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
