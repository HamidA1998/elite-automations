import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarClock, FileText, Mail, Phone, Search, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchClient360 } from "@/services/api";
import type { Client360TimelineEvent } from "@/types/frontend";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const eventIcon: Record<Client360TimelineEvent["channel"], typeof Zap> = {
  call: Phone,
  email: Mail,
  proposal: BriefcaseBusiness,
  ops: CalendarClock,
  crm: FileText,
};

function impactVariant(impact: Client360TimelineEvent["impact"]): "success" | "warning" | "error" | "neutral" {
  if (impact === "high") return "success";
  if (impact === "medium") return "warning";
  return "neutral";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function relativeAge(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Unknown";
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3_600_000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityPage() {
  const [filter, setFilter] = useState<"all" | Client360TimelineEvent["channel"]>("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["client-360"],
    queryFn: fetchClient360,
    staleTime: 60_000,
  });

  const feed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.timeline ?? []).filter((event) => {
      const channelMatch = filter === "all" || event.channel === filter;
      const searchMatch = !q || [
        event.businessName,
        event.area,
        event.label,
        event.body,
        event.actor,
        event.status,
      ].some((field) => field.toLowerCase().includes(q));
      return channelMatch && searchMatch;
    });
  }, [data, filter, search]);

  const channelCounts = useMemo(() => {
    const counts = {all: data?.timeline.length ?? 0, call: 0, email: 0, proposal: 0, ops: 0, crm: 0};
    for (const event of data?.timeline ?? []) counts[event.channel] += 1;
    return counts;
  }, [data]);

  return (
    <PageWrapper
      eyebrow="HAMID.OS · CRM"
      title="Activity Timeline"
      description="A live client history across calls, email touches, tasks, proposals, notes, and CRM events."
      actions={<Link to="/crm" className="text-xs text-[var(--color-accent)] hover:underline">Back to CRM</Link>}
    >
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["all", "call", "email", "proposal", "ops", "crm"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-all ${
                    filter === item
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {item} · {channelCounts[item]}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search activity, company, owner..."
                className="w-full rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] px-6 py-5">
            <p className="section-kicker">Chronological record</p>
            <h2 className="display-title !text-[var(--text-lg)]">Recent touches and operational movement</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({length: 8}).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-[var(--radius-xl)] bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : feed.length ? (
            <div className="divide-y divide-[var(--color-border)]">
              {feed.map((event) => {
                const Icon = eventIcon[event.channel] ?? Zap;
                return (
                  <Link
                    key={`${event.type}-${event.id}`}
                    to={`/leads/${event.clientId}`}
                    className="grid gap-4 px-6 py-5 transition-colors hover:bg-[var(--color-surface-2)] md:grid-cols-[minmax(0,1fr)_0.7fr_0.35fr]"
                  >
                    <div className="flex min-w-0 gap-4">
                      <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-accent)]">
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--color-text)]">{event.label}</p>
                          <Badge variant={impactVariant(event.impact)}>{event.impact}</Badge>
                          <Badge variant="neutral">{event.channel}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-muted)]">{event.body}</p>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{event.businessName} · {event.area}</p>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      <p className="text-[var(--color-text)]">{event.actor}</p>
                      <p className="mt-1">{event.status}</p>
                      <p className="mt-1">{formatTime(event.at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="metric-mono text-xs text-[var(--color-accent)]">{relativeAge(event.at)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-12 text-sm text-[var(--color-text-muted)]">
              No activity matches this filter yet.
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
