import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Search, Phone } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { apiUrl } from "@/services/api";

interface SMSMessage {
  sid: string;
  to: string;
  from: string;
  body: string;
  status: string;
  direction: string;
  date_sent: string;
  date_created: string;
}

async function fetchMessages(): Promise<SMSMessage[]> {
  const res = await fetch(apiUrl("/api/sms/inbox"));
  if (!res.ok) throw new Error("Failed");
  const data = await res.json() as { messages: SMSMessage[] };
  return data.messages ?? [];
}

async function fetchThread(number: string): Promise<SMSMessage[]> {
  const res = await fetch(apiUrl(`/api/sms/thread?number=${encodeURIComponent(number)}`));
  if (!res.ok) throw new Error("Failed");
  const data = await res.json() as { messages: SMSMessage[] };
  return data.messages ?? [];
}

async function sendMessage(params: { to: string; body: string }): Promise<SMSMessage> {
  const res = await fetch(apiUrl("/api/sms/send"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Failed to send");
  }
  return res.json() as Promise<SMSMessage>;
}

function fmtTime(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86_400_000) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return iso; }
}

/** Get unique conversation partners from messages */
function getConversations(messages: SMSMessage[], myNumber: string) {
  const map = new Map<string, { number: string; lastMsg: SMSMessage }>();
  for (const msg of messages) {
    const partner = msg.direction === "inbound" ? msg.from : msg.to;
    const existing = map.get(partner);
    if (!existing || new Date(msg.date_sent ?? msg.date_created) > new Date(existing.lastMsg.date_sent ?? existing.lastMsg.date_created)) {
      map.set(partner, { number: partner, lastMsg: msg });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.lastMsg.date_sent ?? b.lastMsg.date_created).getTime() -
    new Date(a.lastMsg.date_sent ?? a.lastMsg.date_created).getTime(),
  );
}

export function MessagesPage() {
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [compose, setCompose] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const inboxQuery = useQuery({
    queryKey: ["sms-inbox"],
    queryFn: fetchMessages,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const threadQuery = useQuery({
    queryKey: ["sms-thread", selectedNumber],
    queryFn: () => fetchThread(selectedNumber!),
    enabled: Boolean(selectedNumber),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      setCompose("");
      qc.invalidateQueries({ queryKey: ["sms-thread", selectedNumber] });
      qc.invalidateQueries({ queryKey: ["sms-inbox"] });
    },
  });

  const messages = inboxQuery.data ?? [];
  const myNumber = ""; // server knows TWILIO_PHONE_NUMBER
  const conversations = getConversations(messages, myNumber).filter(c => {
    if (!search) return true;
    return c.number.includes(search);
  });

  const thread = threadQuery.data ?? [];
  const composeTo = selectedNumber ?? newNumber;

  const handleSend = () => {
    if (!composeTo.trim() || !compose.trim()) return;
    sendMutation.mutate({ to: composeTo, body: compose });
  };

  return (
    <PageWrapper eyebrow="Calls" title="Messages" description="Your SMS inbox, threads, and outbound messages.">
      <div className="grid gap-4 xl:grid-cols-[300px_1fr] h-[calc(100vh-220px)] min-h-[500px]">

        {/* Conversation list */}
        <Card className="flex flex-col overflow-hidden p-0">
          {/* Search */}
          <div className="p-3 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search numbers…"
                className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] pl-8 pr-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* New conversation */}
          <div className="p-3 border-b border-[var(--color-border)]">
            <input
              value={newNumber}
              onChange={e => setNewNumber(e.target.value)}
              onFocus={() => setSelectedNumber(null)}
              placeholder="+ New conversation: +44…"
              className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Threads */}
          <div className="flex-1 overflow-y-auto">
            {inboxQuery.isLoading ? (
              <div className="p-3 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-[var(--color-text-muted)] text-xs">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                No conversations yet
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.number}
                  onClick={() => { setSelectedNumber(conv.number); setNewNumber(""); }}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)] transition-colors border-b border-[var(--color-border)] last:border-0 ${selectedNumber === conv.number ? "bg-[var(--color-surface-2)]" : ""}`}
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] shrink-0">
                    <Phone size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--color-text)] truncate">{conv.number}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] shrink-0">{fmtTime(conv.lastMsg.date_sent ?? conv.lastMsg.date_created)}</p>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{conv.lastMsg.body}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Thread view */}
        <Card className="flex flex-col overflow-hidden p-0">
          {!selectedNumber && !newNumber ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-3">
              <MessageSquare size={40} className="opacity-20" />
              <p className="text-sm">Select a conversation or enter a number to start</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  <Phone size={15} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{composeTo}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">SMS thread</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadQuery.isLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
                  </div>
                ) : thread.length === 0 ? (
                  <div className="text-center text-sm text-[var(--color-text-muted)] py-8">
                    No messages yet. Send the first one.
                  </div>
                ) : (
                  thread.map(msg => {
                    const isOut = msg.direction === "outbound-api" || msg.direction === "outbound";
                    return (
                      <div key={msg.sid} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                            isOut
                              ? "bg-[var(--color-accent)] text-white rounded-br-sm"
                              : "bg-[var(--color-surface-3)] text-[var(--color-text)] rounded-bl-sm"
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{msg.body}</p>
                          <p className={`text-[10px] mt-1 ${isOut ? "text-white/60" : "text-[var(--color-text-muted)]"}`}>
                            {fmtTime(msg.date_sent ?? msg.date_created)} · {msg.status}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Compose */}
              <div className="px-4 py-3 border-t border-[var(--color-border)] flex gap-3 items-end">
                <textarea
                  value={compose}
                  onChange={e => setCompose(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                  placeholder="Type a message…"
                  rows={2}
                  className="flex-1 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <button
                  onClick={handleSend}
                  disabled={!compose.trim() || sendMutation.isPending}
                  className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 transition-all shrink-0"
                >
                  {sendMutation.isPending
                    ? <div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Send size={15} />
                  }
                </button>
              </div>

              {sendMutation.isError && (
                <p className="px-4 pb-2 text-xs text-red-400">{String(sendMutation.error)}</p>
              )}
            </>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
