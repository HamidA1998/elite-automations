import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PhoneCall, PhoneIncoming, PhoneOff, Play, Download, Search } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { apiUrl } from "@/services/api";

interface CallLog {
  sid: string;
  to: string;
  from: string;
  status: string;
  direction: string;
  duration: string;
  start_time: string;
  price: string | null;
  price_unit: string;
  to_formatted: string;
  from_formatted: string;
}

interface Recording {
  sid: string;
  call_sid: string;
  duration: string;
  date_created: string;
  status: string;
  uri: string;
}

async function fetchCallLogs(page = 0) {
  const res = await fetch(apiUrl(`/api/calls/logs?page=${page}`));
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{ calls: CallLog[]; nextPage: string | null }>;
}

async function fetchRecordings(callSid?: string) {
  const url = callSid ? `/api/calls/recordings?callSid=${callSid}` : `/api/calls/recordings`;
  const res = await fetch(apiUrl(url));
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{ recordings: Recording[] }>;
}

const statusStyles: Record<string, { dot: string; text: string }> = {
  completed:    { dot: "bg-green-500", text: "text-green-400" },
  "in-progress":{ dot: "bg-blue-500 animate-pulse", text: "text-blue-400" },
  failed:       { dot: "bg-red-500", text: "text-red-400" },
  busy:         { dot: "bg-yellow-500", text: "text-yellow-400" },
  "no-answer":  { dot: "bg-orange-500", text: "text-orange-400" },
  queued:       { dot: "bg-purple-500", text: "text-purple-400" },
  ringing:      { dot: "bg-blue-400 animate-pulse", text: "text-blue-300" },
  canceled:     { dot: "bg-gray-500", text: "text-gray-400" },
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
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export function CallLogsPage() {
  const [search, setSearch] = useState("");
  const [expandedSid, setExpandedSid] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const logsQuery = useQuery({
    queryKey: ["call-logs", page],
    queryFn: () => fetchCallLogs(page),
    staleTime: 30_000,
  });

  const recordingsQuery = useQuery({
    queryKey: ["recordings", expandedSid],
    queryFn: () => fetchRecordings(expandedSid ?? undefined),
    enabled: expandedSid !== null,
    staleTime: 60_000,
  });

  const calls = (logsQuery.data?.calls ?? []).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.to.includes(s) || c.from.includes(s) || c.status.includes(s) || c.to_formatted.includes(s);
  });

  return (
    <PageWrapper eyebrow="Calls" title="Call logs" description="Every call, recording, and conversation in one place.">
      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by number or status…"
          className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] pl-10 pr-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      <Card className="overflow-hidden">
        {logsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
          </div>
        ) : logsQuery.isError ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">
            <p>Twilio not configured or connection error.</p>
          </div>
        ) : calls.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center text-[var(--color-text-muted)]">
            <PhoneOff size={36} className="mb-3 opacity-30" />
            <p className="text-sm">No call logs found.</p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-[var(--color-border)] text-xs font-bold text-[var(--color-text-muted)] tracking-wider uppercase">
              <span />
              <span>From / To</span>
              <span className="hidden sm:block">Time</span>
              <span className="hidden md:block">Duration</span>
              <span>Status</span>
              <span>Rec.</span>
            </div>

            {calls.map(call => {
              const style = statusStyles[call.status] ?? statusStyles.canceled;
              const isExpanded = expandedSid === call.sid;
              const displayNumber = call.direction === "inbound" ? call.from_formatted || call.from : call.to_formatted || call.to;

              return (
                <div key={call.sid} className="border-b border-[var(--color-border)] last:border-0">
                  <div
                    className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 items-center px-5 py-4 hover:bg-[var(--color-surface-2)] cursor-pointer transition-colors"
                    onClick={() => setExpandedSid(isExpanded ? null : call.sid)}
                  >
                    {/* Direction icon */}
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)] shrink-0">
                      {call.direction === "inbound" ? <PhoneIncoming size={13} /> : <PhoneCall size={13} />}
                    </span>

                    {/* Number */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{displayNumber}</p>
                      <p className="text-xs text-[var(--color-text-muted)] capitalize">{call.direction.replace("-", " ")}</p>
                    </div>

                    {/* Time */}
                    <p className="hidden sm:block text-xs text-[var(--color-text-muted)]">{fmtTime(call.start_time)}</p>

                    {/* Duration */}
                    <p className="hidden md:block text-xs text-[var(--color-text-muted)] tabular-nums">{fmtDuration(call.duration)}</p>

                    {/* Status */}
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block size-2 rounded-full ${style.dot}`} />
                      <span className={`text-xs font-medium capitalize ${style.text}`}>{call.status.replace("-", " ")}</span>
                    </div>

                    {/* Recording indicator */}
                    <span className="text-[var(--color-text-muted)]">
                      {call.duration && Number(call.duration) > 0 ? (
                        <Play size={13} className="text-[var(--color-accent)]" />
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </span>
                  </div>

                  {/* Expanded recordings */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-[var(--color-surface-2)]">
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Recordings for {call.sid}
                      </p>
                      {recordingsQuery.isLoading ? (
                        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
                      ) : (recordingsQuery.data?.recordings ?? []).length === 0 ? (
                        <p className="text-xs text-[var(--color-text-muted)]">No recording for this call.</p>
                      ) : (
                        <div className="space-y-2">
                          {(recordingsQuery.data?.recordings ?? []).map(rec => (
                            <div key={rec.sid} className="flex items-center justify-between bg-[var(--color-surface-3)] rounded-xl px-4 py-3">
                              <div>
                                <p className="text-xs font-medium text-[var(--color-text)]">{rec.sid}</p>
                                <p className="text-[10px] text-[var(--color-text-muted)]">{fmtDuration(rec.duration)} · {fmtTime(rec.date_created)}</p>
                              </div>
                              <a
                                href={`/api/calls/recording/${rec.sid}/download`}
                                download
                                className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                <Download size={12} />
                                Download MP3
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {(logsQuery.data?.calls?.length ?? 0) > 0 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--color-border)]">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">Page {page + 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!logsQuery.data?.nextPage}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}
