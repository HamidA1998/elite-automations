import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchGmailOAuthUrl, fetchMailInbox } from "@/services/api";
import type { MailDraftAccount, MailInboxMessage } from "@/types/frontend";

type TabId = "all" | "unread" | "replies" | "outreach" | "drafts";

interface MailRow {
  id: string;
  kind: "message" | "draft";
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: string | null;
  read: boolean;
  starred: boolean;
  tag: "inbox" | "reply" | "outreach" | "lead" | "draft" | string;
  clientId: string | null;
}

const TABS: Array<{ id: TabId; label: string; icon: typeof Inbox }> = [
  {id: "all", label: "All", icon: Inbox},
  {id: "unread", label: "Unread", icon: Mail},
  {id: "replies", label: "Replies", icon: ChevronRight},
  {id: "outreach", label: "Outreach", icon: Send},
  {id: "drafts", label: "CRM drafts", icon: Sparkles},
];

const TAG_STYLES: Record<string, {label: string; color: string; bg: string}> = {
  reply: {label: "Reply", color: "#22c55e", bg: "#22c55e18"},
  outreach: {label: "Outreach", color: "#f59e0b", bg: "#f59e0b18"},
  draft: {label: "Draft", color: "var(--color-accent)", bg: "var(--color-accent-glow)"},
  lead: {label: "Lead", color: "#06b6d4", bg: "#06b6d418"},
  inbox: {label: "Inbox", color: "var(--color-text-muted)", bg: "rgba(255,255,255,0.06)"},
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "EA";
}

function formatMailTime(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  const ageMs = Date.now() - date.getTime();
  if (ageMs < 86_400_000) {
    return new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit"}).format(date);
  }
  return new Intl.DateTimeFormat("en-GB", {day: "2-digit", month: "short"}).format(date);
}

function messageToRow(message: MailInboxMessage): MailRow {
  return {
    id: message.id,
    kind: "message",
    from: message.fromName,
    fromEmail: message.fromEmail,
    subject: message.subject,
    preview: message.preview,
    receivedAt: message.receivedAt,
    read: message.read,
    starred: message.starred,
    tag: message.tag,
    clientId: null,
  };
}

function draftToRow(draft: MailDraftAccount): MailRow {
  return {
    id: `draft-${draft.clientId}`,
    kind: "draft",
    from: draft.businessName,
    fromEmail: draft.emailAddress ?? "No email captured",
    subject: `${draft.mailStatus}: ${draft.businessName} outreach`,
    preview: draft.latestMailNotes || draft.nextActionNotes || "CRM email draft is ready to review from this client file.",
    receivedAt: draft.latestMailEventAt ?? draft.draftedAt,
    read: true,
    starred: draft.mailStatus === "Replied",
    tag: draft.mailStatus === "Replied" ? "reply" : "draft",
    clientId: draft.clientId,
  };
}

export function MailInboxPage() {
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [starredOverrides, setStarredOverrides] = useState<Record<string, boolean>>({});

  const inboxQuery = useQuery({
    queryKey: ["mail-inbox"],
    queryFn: () => fetchMailInbox({maxResults: 50}),
    staleTime: 60_000,
  });
  const gmailOAuthQuery = useQuery({
    queryKey: ["gmail-oauth-url"],
    queryFn: fetchGmailOAuthUrl,
    staleTime: 60_000,
  });

  const mail = inboxQuery.data;
  const rows = useMemo(() => {
    const messages = (mail?.messages ?? []).map(messageToRow);
    const drafts = (mail?.drafts ?? []).map(draftToRow);
    return [...messages, ...drafts].sort((a, b) => {
      const at = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
      const bt = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
      return bt - at;
    });
  }, [mail]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const tabMatch =
        tab === "all" ||
        (tab === "unread" && !row.read) ||
        (tab === "replies" && row.tag === "reply") ||
        (tab === "outreach" && (row.tag === "outreach" || row.tag === "draft")) ||
        (tab === "drafts" && row.kind === "draft");
      const searchMatch = !q || [row.from, row.fromEmail, row.subject, row.preview, row.tag].some((field) => field.toLowerCase().includes(q));
      return tabMatch && searchMatch;
    });
  }, [rows, search, tab]);

  const selectedRow = selected ? rows.find((row) => row.id === selected) ?? null : null;
  const unreadCount = rows.filter((row) => !row.read).length;
  const replyCount = rows.filter((row) => row.tag === "reply").length;
  const draftCount = rows.filter((row) => row.kind === "draft").length;
  const connected = Boolean(mail?.connected);

  return (
    <PageWrapper
      eyebrow="HAMID.OS · MAIL"
      title="Mailbox"
      description="Real Gmail inbox sync when connected, plus CRM outreach drafts from every client file."
      actions={
        <div className="flex items-center gap-2">
          <Link to="/mail/compose" className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-90">
            <Plus size={13} />
            Compose
          </Link>
          <Link to="/mail/campaigns" className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-3)]">
            <Sparkles size={13} />
            Campaigns
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        <Card className={`p-4 ${connected ? "border-[var(--color-success)]/30" : "border-[var(--color-warning)]/35"}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${connected ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"}`}>
                {connected ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {connected ? `Gmail connected: ${mail?.account}` : "Gmail is not connected yet"}
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {connected
                    ? "Messages below are coming from the Gmail API. CRM drafts are merged in so replies and outbound work can be managed from one place."
                    : `Add ${mail?.missingEnv.join(", ") || "Gmail OAuth environment variables"} to sync the real mailbox. Until then, this view shows real CRM outreach drafts and lead email routes, not fake inbox data.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!connected && gmailOAuthQuery.data?.authUrl ? (
                <a
                  href={gmailOAuthQuery.data.authUrl}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-opacity hover:opacity-90"
                >
                  Connect Gmail
                </a>
              ) : null}
              <Badge variant={connected ? "success" : "warning"}>{connected ? "live" : "setup required"}</Badge>
            </div>
          </div>
          {!connected && gmailOAuthQuery.data && !gmailOAuthQuery.data.authUrl ? (
            <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              Gmail sign-in is ready in the app, but Google OAuth credentials are still missing:
              {" "}
              <span className="font-semibold text-[var(--color-warning)]">{gmailOAuthQuery.data.missingEnv.join(", ")}</span>.
              Add those two keys first, then this panel will show the live Connect Gmail button.
            </div>
          ) : null}
          {mail?.error && (
            <p className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]">
              {mail.error}
            </p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {label: "Synced messages", value: mail?.messages.length ?? 0, icon: Mail, color: "var(--color-accent)"},
            {label: "Unread", value: unreadCount, icon: Inbox, color: "#f59e0b"},
            {label: "Replies", value: replyCount, icon: ChevronRight, color: "#22c55e"},
            {label: "CRM drafts", value: draftCount, icon: Tag, color: "#a78bfa"},
          ].map(({label, value, icon: Icon, color}) => (
            <Card key={label} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full" style={{background: `${color}18`, color}}>
                <Icon size={14} />
              </span>
              <div>
                <p className="metric-mono text-xl font-bold leading-none">{inboxQuery.isLoading ? "-" : value}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            {to: "/mail/compose", icon: Send, label: "Compose", desc: "Write a new email", color: "var(--color-accent)"},
            {to: "/mail/templates", icon: Archive, label: "Templates", desc: "Manage saved templates", color: "#f97316"},
            {to: "/mail/campaigns", icon: Sparkles, label: "Campaigns", desc: "AI-powered bulk outreach", color: "#8b5cf6"},
          ].map(({to, icon: Icon, label, desc, color}) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-2)]"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all group-hover:scale-110" style={{background: `${color}18`, color}}>
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{label}</p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {TABS.map(({id, label, icon: Icon}) => {
                const count = id === "unread" ? unreadCount : id === "replies" ? replyCount : id === "drafts" ? draftCount : null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      tab === id
                        ? "bg-[var(--color-accent)] text-black"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]"
                    }`}
                  >
                    <Icon size={11} />
                    {label}
                    {count != null && count > 0 && (
                      <span className="rounded-full bg-black/15 px-1.5 text-[10px] font-bold">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex w-48 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
              <Search size={12} className="shrink-0 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search mail..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          </div>

          <div className="flex min-h-[480px]">
            <div className={`max-h-[620px] shrink-0 divide-y divide-[var(--color-border)] overflow-y-auto ${selectedRow ? "w-80 border-r border-[var(--color-border)]" : "w-full"}`}>
              {inboxQuery.isLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({length: 8}).map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-[var(--radius-xl)] bg-[var(--color-surface-2)]" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Inbox size={28} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-30" />
                  <p className="text-sm text-[var(--color-text-muted)]">No mail matches this view.</p>
                </div>
              ) : (
                filtered.map((row) => {
                  const tagStyle = TAG_STYLES[row.tag] ?? TAG_STYLES.inbox;
                  const isSelected = selected === row.id;
                  const isStarred = starredOverrides[row.id] ?? row.starred;
                  return (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(isSelected ? null : row.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelected(isSelected ? null : row.id);
                      }}
                      className={`group flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-all ${
                        isSelected
                          ? "bg-[var(--color-accent)]/8"
                          : "hover:bg-[var(--color-surface-2)]"
                      }`}
                    >
                      <span
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-black"
                        style={{background: tagStyle.bg, color: tagStyle.color, borderColor: `${tagStyle.color}30`}}
                      >
                        {initials(row.from)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 flex items-center gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-sm ${!row.read ? "font-bold text-[var(--color-text)]" : "font-medium text-[var(--color-text-muted)]"}`}
                            title={row.from}
                          >
                            {row.from}
                          </span>
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{background: tagStyle.bg, color: tagStyle.color}}>
                            {tagStyle.label}
                          </span>
                        </span>
                        <span
                          className={`block truncate text-xs ${!row.read ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}
                          title={row.subject}
                        >
                          {row.subject}
                        </span>
                        <span
                          className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)]"
                          title={row.preview}
                        >
                          {row.preview}
                        </span>
                      </span>

                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="metric-mono whitespace-nowrap text-[10px] text-[var(--color-text-muted)]">
                          {formatMailTime(row.receivedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          {!row.read && <span className="size-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent-glow)]" />}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setStarredOverrides((previous) => ({...previous, [row.id]: !isStarred}));
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              event.stopPropagation();
                              setStarredOverrides((previous) => ({...previous, [row.id]: !isStarred}));
                            }}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Star size={12} className={isStarred ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[var(--color-text-muted)]"} />
                          </button>
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {selectedRow && (
              <div className="max-h-[620px] min-w-0 flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-base font-bold leading-snug">{selectedRow.subject}</h2>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="shrink-0 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[9px] font-black text-[var(--color-accent)]">
                          {initials(selectedRow.from)}
                        </span>
                        <span className="text-sm font-medium">{selectedRow.from}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">&lt;{selectedRow.fromEmail}&gt;</span>
                      </span>
                      <span className="ml-auto flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        <Clock size={11} />
                        {formatMailTime(selectedRow.receivedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-text)]">
                      {selectedRow.preview || "No preview text is available for this message."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link
                      to={selectedRow.clientId
                        ? `/mail/compose?clientId=${selectedRow.clientId}&to=${encodeURIComponent(selectedRow.fromEmail)}&name=${encodeURIComponent(selectedRow.from)}`
                        : `/mail/compose?to=${encodeURIComponent(selectedRow.fromEmail)}&name=${encodeURIComponent(selectedRow.from)}`}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
                    >
                      <Send size={12} />
                      {selectedRow.kind === "draft" ? "Open draft" : "Reply"}
                    </Link>
                    {selectedRow.clientId && (
                      <Link
                        to={`/leads/${selectedRow.clientId}`}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                      >
                        <Tag size={12} />
                        Client file
                      </Link>
                    )}
                    <button type="button" className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]">
                      <Archive size={12} />
                      Archive
                    </button>
                    <button type="button" className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10">
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5">
            <span className="text-xs text-[var(--color-text-muted)]">
              {filtered.length} visible · {unreadCount} unread · {draftCount} CRM drafts
            </span>
            <Link to="/mail/compose" className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
              <Plus size={10} />
              New email
            </Link>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
