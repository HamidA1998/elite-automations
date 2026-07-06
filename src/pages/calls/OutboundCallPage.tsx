import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneOff, Bot, User, Delete, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl, fetchLeadPipeline } from "@/services/api";

type CallMode = "manual" | "ai-agent";
type CallState = "idle" | "calling" | "active" | "completed" | "failed";

const dialPadKeys = ["1","2","3","4","5","6","7","8","9","*","0","#"];

export function OutboundCallPage() {
  const [mode, setMode] = useState<CallMode>("manual");
  const [number, setNumber] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [callState, setCallState] = useState<CallState>("idle");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [agentId, setAgentId] = useState(import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? "");

  const pipelineQuery = useQuery({ queryKey: ["lead-pipeline"], queryFn: fetchLeadPipeline });
  const leads = pipelineQuery.data?.leads ?? [];

  const handleDial = (key: string) => {
    setNumber(prev => prev + key);
  };

  const handleBackspace = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const startCall = async () => {
    const target = number.trim();
    if (!target) return;

    setCallState("calling");
    setErrorMsg(null);

    try {
      const body: Record<string, string> = { to: target, mode };
      if (mode === "ai-agent" && agentId) body.agentId = agentId;
      if (selectedLeadId) body.leadId = selectedLeadId;

      const res = await fetch(apiUrl("/api/calls/outbound"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? "Call failed");
      }

      const data = await res.json() as { callSid: string; status: string };
      setCallSid(data.callSid);
      setCallState("active");
    } catch (err) {
      setErrorMsg(String(err));
      setCallState("failed");
    }
  };

  const endCall = async () => {
    if (!callSid) { setCallState("idle"); return; }
    try {
      await fetch(apiUrl(`/api/calls/end/${callSid}`), { method: "POST" });
    } catch { /* non-fatal */ }
    setCallState("completed");
    setTimeout(() => { setCallState("idle"); setCallSid(null); }, 3000);
  };

  const selectedLead = leads.find(l => l.clientId === selectedLeadId);

  return (
    <PageWrapper eyebrow="Calls" title="Outbound call" description="Manual or AI-powered outbound calling.">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Mode toggle */}
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-2">
            {(["manual", "ai-agent"] as CallMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center justify-center gap-2 rounded-[var(--radius-xl)] py-3 px-4 text-sm font-semibold transition-all ${
                  mode === m
                    ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-sm)]"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {m === "manual" ? <User size={15} /> : <Bot size={15} />}
                {m === "manual" ? "Manual call" : "AI agent call"}
              </button>
            ))}
          </div>
          {mode === "ai-agent" && (
            <div className="mt-3">
              <Input
                label="ElevenLabs agent ID"
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                placeholder="agent_xxxxxx"
              />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                The AI voice agent will handle the entire pitch conversation.
                Configure the agent script in{" "}
                <a href="/#/calls/agents" className="text-[var(--color-accent)] hover:underline">AI agent settings</a>.
              </p>
            </div>
          )}
        </Card>

        {/* Lead picker */}
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-[var(--color-text)]">Select a lead (optional)</p>
          <select
            value={selectedLeadId}
            onChange={e => {
              setSelectedLeadId(e.target.value);
              const lead = leads.find(l => l.clientId === e.target.value);
              if (lead?.phoneNumber) setNumber(lead.phoneNumber);
            }}
            className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="">— enter number manually —</option>
            {leads.filter(l => l.phoneNumber).map(l => (
              <option key={l.clientId} value={l.clientId}>
                {l.businessName} · {l.phoneNumber}
              </option>
            ))}
          </select>
          {selectedLead && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">✓</span>
              {selectedLead.businessName} · Score: {selectedLead.siteScore ?? "—"}
            </div>
          )}
        </Card>

        {/* Dial pad */}
        <Card className="space-y-4">
          {/* Number display */}
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="+44 7700 900000"
              className="flex-1 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-xl font-mono text-[var(--color-text)] text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            {number && (
              <button
                onClick={handleBackspace}
                className="p-3 rounded-[var(--radius-xl)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <Delete size={18} />
              </button>
            )}
          </div>

          {/* Dial grid */}
          <div className="grid grid-cols-3 gap-2">
            {dialPadKeys.map(key => (
              <button
                key={key}
                onClick={() => handleDial(key)}
                disabled={callState !== "idle" && callState !== "failed"}
                className="h-14 rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] text-lg font-bold text-[var(--color-text)] hover:bg-[var(--color-surface-3)] active:scale-95 transition-all disabled:opacity-40"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Call / End button */}
          <div className="flex gap-3">
            {callState === "idle" || callState === "failed" ? (
              <Button
                className="flex-1 h-14 text-lg gap-3"
                variant="primary"
                onClick={startCall}
                disabled={!number.trim()}
              >
                <Phone size={20} />
                {mode === "ai-agent" ? "Start AI call" : "Call"}
              </Button>
            ) : callState === "calling" ? (
              <button className="flex-1 h-14 rounded-[var(--radius-xl)] bg-[var(--color-accent)] text-white text-lg font-bold flex items-center justify-center gap-3 cursor-not-allowed opacity-80">
                <Loader2 size={20} className="animate-spin" />
                Connecting…
              </button>
            ) : callState === "active" ? (
              <button
                onClick={endCall}
                className="flex-1 h-14 rounded-[var(--radius-xl)] bg-red-500 text-white text-lg font-bold flex items-center justify-center gap-3 hover:bg-red-600 transition-colors"
              >
                <PhoneOff size={20} />
                End call
              </button>
            ) : callState === "completed" ? (
              <button className="flex-1 h-14 rounded-[var(--radius-xl)] bg-green-500/10 text-green-400 text-lg font-bold flex items-center justify-center gap-3 cursor-default">
                <CheckCircle2 size={20} />
                Call ended
              </button>
            ) : null}
          </div>

          {/* Status / error */}
          {errorMsg && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-xl px-4 py-3">
              <XCircle size={15} />
              {errorMsg}
            </div>
          )}
          {callSid && callState === "active" && (
            <p className="text-xs text-center text-[var(--color-text-muted)]">
              Call SID: <code className="text-[var(--color-accent)]">{callSid}</code>
            </p>
          )}
        </Card>

        {/* AI mode info */}
        {mode === "ai-agent" && (
          <Card className="bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)]">
              <Bot size={15} />
              AI agent mode active
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              ElevenLabs will speak your pitch using a real-time voice model. The agent handles the entire
              conversation — qualifying, objection handling, and booking follow-ups. You can monitor
              live transcripts in the conversation history.
            </p>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
