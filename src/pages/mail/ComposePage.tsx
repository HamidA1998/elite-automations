import { useState, useEffect } from "react";
import { Send, Loader2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { apiUrl, fetchLeadPipeline } from "@/services/api";
import { useLocation } from "react-router-dom";

function useQueryParams() {
  return new URLSearchParams(useLocation().search);
}

export function ComposePage() {
  const params = useQueryParams();
  const [to, setTo] = useState(params.get("to") ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedLead, setSelectedLead] = useState(params.get("clientId") ?? "");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: pipelineData } = useQuery({
    queryKey: ["lead-pipeline"],
    queryFn: fetchLeadPipeline,
    staleTime: 60_000,
  });
  const leads = pipelineData?.leads ?? [];

  useEffect(() => {
    if (selectedLead) {
      const lead = leads.find((l) => l.clientId === selectedLead);
      if (lead?.emailAddress) setTo(lead.emailAddress);
    }
  }, [selectedLead, leads]);

  async function generateTemplate() {
    if (!selectedLead) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/mail/generate-template?clientId=${selectedLead}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate template");
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/mail/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim(), clientId: selectedLead || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data?.sent !== true) {
        throw new Error(data?.error ?? data?.note ?? "Send failed — no transport delivered the message.");
      }
      setSent(true);
      setTimeout(() => setSent(false), 5000);
      setSubject("");
      setBody("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-[900px] mx-auto">
      <div>
        <p className="section-kicker">Mail</p>
        <h1 className="display-title mt-2">Compose</h1>
      </div>

      <div className="glass-panel rounded-[var(--radius-2xl)] p-6 space-y-5">
        {/* Lead picker */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Lead (optional)</label>
          <div className="flex gap-3">
            <select
              value={selectedLead}
              onChange={(e) => setSelectedLead(e.target.value)}
              className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            >
              <option value="">— manual entry —</option>
              {leads.map((l) => (
                <option key={l.clientId} value={l.clientId}>{l.businessName}</option>
              ))}
            </select>
            {selectedLead && (
              <Button variant="secondary" onClick={generateTemplate} disabled={generating}>
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>AI draft</span>
              </Button>
            )}
          </div>
        </div>

        {/* To */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">To</label>
          <input
            type="email"
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Subject</label>
          <input
            type="text"
            placeholder="Email subject…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
        </div>

        {/* Body */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Message</label>
          <textarea
            rows={12}
            placeholder="Write your email…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 resize-none font-mono"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={loading || !to.trim() || !subject.trim() || !body.trim()}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>Send email</span>
          </Button>
          {sent && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 size={15} />
              <span>Email sent!</span>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle size={15} />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
