import { useState } from "react";
import { Send, Loader2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { apiUrl, fetchLeadPipeline } from "@/services/api";

export function CampaignsPage() {
  const { data: pipelineData } = useQuery({
    queryKey: ["lead-pipeline"],
    queryFn: fetchLeadPipeline,
    staleTime: 60_000,
  });
  const leads = pipelineData?.leads ?? [];

  const withEmail = leads.filter((l) => l.emailAddress);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; email: string; ok: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleAll() {
    if (selected.size === withEmail.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withEmail.map((l) => l.clientId)));
    }
  }

  async function handleSendCampaign() {
    if (!subject || !body || selected.size === 0) return;
    setSending(true);
    setError(null);
    setResults([]);
    const targets = withEmail.filter((l) => selected.has(l.clientId));
    try {
      const res = await fetch(apiUrl("/api/mail/campaign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          recipients: targets.map((l) => ({ email: l.emailAddress!, name: l.businessName, clientId: l.clientId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Campaign failed");
      setResults(data.results ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <p className="section-kicker">Mail</p>
        <h1 className="display-title mt-2">Campaigns</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Send bulk outreach to multiple leads at once.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recipient selector */}
        <div className="glass-panel rounded-[var(--radius-2xl)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[var(--color-accent)]" />
              <p className="font-semibold text-sm text-[var(--color-text)]">Recipients</p>
              <span className="metric-mono text-xs text-[var(--color-accent)]">{selected.size}/{withEmail.length}</span>
            </div>
            <button onClick={toggleAll} className="text-xs text-[var(--color-accent)] hover:underline">
              {selected.size === withEmail.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="overflow-y-auto max-h-80 divide-y divide-[var(--color-border)]">
            {withEmail.map((lead) => (
              <label key={lead.clientId} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(lead.clientId)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    e.target.checked ? next.add(lead.clientId) : next.delete(lead.clientId);
                    setSelected(next);
                  }}
                  className="accent-[var(--color-accent)]"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{lead.businessName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{lead.emailAddress}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="glass-panel rounded-[var(--radius-2xl)] p-5 space-y-4">
          <p className="font-semibold text-sm text-[var(--color-text)]">Message</p>
          <input
            type="text"
            placeholder="Subject line…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          <textarea
            rows={10}
            placeholder="Email body… (use {name} for business name)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 resize-none font-mono"
          />
          <Button
            variant="primary"
            onClick={handleSendCampaign}
            disabled={sending || selected.size === 0 || !subject || !body}
            className="w-full justify-center"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span>Send to {selected.size} recipient{selected.size !== 1 ? "s" : ""}</span>
          </Button>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="glass-panel rounded-[var(--radius-2xl)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <p className="font-semibold text-sm text-[var(--color-text)]">Campaign results</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{r.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{r.email}</p>
                </div>
                {r.ok ? (
                  <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 size={13} /> Sent</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle size={13} /> Failed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
