import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Save, RefreshCw, Play, Mic, ChevronDown, ChevronUp, Clock, MessageSquare } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl } from "@/services/api";

interface Agent {
  agent_id: string;
  name: string;
  conversation_config: {
    agent: { prompt: { prompt: string }; first_message: string; language: string };
    tts: { voice_id: string; model_id: string };
  };
  metadata: { created_at_unix_secs: number };
}

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string | null;
}

interface Conversation {
  conversation_id: string;
  agent_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  status: string;
}

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(apiUrl("/api/elevenlabs/agents"));
  if (!res.ok) throw new Error("Failed");
  const d = await res.json() as { agents: Agent[] };
  return d.agents ?? [];
}

async function fetchVoices(): Promise<Voice[]> {
  const res = await fetch(apiUrl("/api/elevenlabs/voices"));
  if (!res.ok) throw new Error("Failed");
  const d = await res.json() as { voices: Voice[] };
  return d.voices ?? [];
}

async function fetchConversations(agentId: string): Promise<Conversation[]> {
  const res = await fetch(apiUrl(`/api/elevenlabs/conversations?agentId=${agentId}`));
  if (!res.ok) return [];
  const d = await res.json() as { conversations: Conversation[] };
  return d.conversations ?? [];
}

async function saveAgent(body: {
  agentId?: string;
  name: string;
  prompt: string;
  firstMessage: string;
  voiceId: string;
  language: string;
}): Promise<Agent> {
  const res = await fetch(apiUrl("/api/elevenlabs/agents/save"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Failed");
  }
  return res.json() as Promise<Agent>;
}

const DEFAULT_AGENT_ID = "agent_1201kp6qhf3zfz9actd3d8k7dv1q";

const DEFAULT_PROMPT = `You are an AI sales agent calling on behalf of Hamid from Elite Automations, a digital marketing and automation agency based in Greater Manchester.

Your goal is to have a natural, confident conversation with the business owner and:
1. Introduce yourself professionally
2. Mention you've researched their business and spotted opportunities to grow their online presence
3. Offer a free website audit and demo
4. Ask qualifying questions about their current marketing
5. Try to book a 15-minute discovery call

Be conversational, not robotic. Never be pushy. If they're not interested, ask to send information by email.`;

const DEFAULT_FIRST_MSG = "Hi there! This is an AI assistant calling on behalf of Elite Automations. Have I caught you at a good time? I've been looking at your business online and I'd love to share something that could bring you more customers.";

function fmtDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function AgentConfigPage() {
  const qc = useQueryClient();

  const agentsQuery  = useQuery({ queryKey: ["el-agents"],  queryFn: fetchAgents,  staleTime: 60_000 });
  const voicesQuery  = useQuery({ queryKey: ["el-voices"],  queryFn: fetchVoices,  staleTime: 300_000 });

  const agents = agentsQuery.data ?? [];
  const voices = voicesQuery.data ?? [];

  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [expandedConvs, setExpandedConvs] = useState(false);

  // Find selected agent or build default form
  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);

  const [name,         setName]         = useState(selectedAgent?.name ?? "Elite Automations Sales Agent");
  const [prompt,       setPrompt]       = useState(selectedAgent?.conversation_config.agent.prompt.prompt ?? DEFAULT_PROMPT);
  const [firstMessage, setFirstMessage] = useState(selectedAgent?.conversation_config.agent.first_message ?? DEFAULT_FIRST_MSG);
  const [voiceId,      setVoiceId]      = useState(selectedAgent?.conversation_config.tts.voice_id ?? "");
  const [language,     setLanguage]     = useState(selectedAgent?.conversation_config.agent.language ?? "en");

  const convsQuery = useQuery({
    queryKey: ["el-conversations", selectedAgentId],
    queryFn:  () => fetchConversations(selectedAgentId),
    enabled:  Boolean(selectedAgentId) && expandedConvs,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: saveAgent,
    onSuccess: (agent) => {
      setSelectedAgentId(agent.agent_id);
      qc.invalidateQueries({ queryKey: ["el-agents"] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      agentId: selectedAgentId !== "new" ? selectedAgentId : undefined,
      name, prompt, firstMessage, voiceId, language,
    });
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgentId(agent.agent_id);
    setName(agent.name);
    setPrompt(agent.conversation_config.agent.prompt.prompt);
    setFirstMessage(agent.conversation_config.agent.first_message);
    setVoiceId(agent.conversation_config.tts.voice_id);
    setLanguage(agent.conversation_config.agent.language ?? "en");
  };

  const isConfigured = agents.length > 0 || !agentsQuery.isError;

  return (
    <PageWrapper
      eyebrow="Calls"
      title="AI voice agent"
      description="Configure your ElevenLabs AI agent. It handles outbound pitches, qualification, and booking — all in a natural voice."
    >
      {/* ElevenLabs not configured */}
      {agentsQuery.isError && (
        <Card className="py-10 flex flex-col items-center gap-4 text-center mb-6">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-yellow-500/10">
            <Bot size={24} className="text-yellow-400" />
          </span>
          <div>
            <h3 className="font-semibold text-[var(--color-text)] mb-1">ElevenLabs not connected</h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
              Add <code className="text-[var(--color-accent)]">ELEVENLABS_API_KEY</code> to your{" "}
              <code>.env.local</code> to unlock the AI voice agent.
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">

        {/* Agent list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-kicker">Your agents</p>
            <button
              onClick={() => { setSelectedAgentId("new"); setName(""); setPrompt(DEFAULT_PROMPT); setFirstMessage(DEFAULT_FIRST_MSG); setVoiceId(""); }}
              className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
            >
              <Plus size={12} /> New
            </button>
          </div>

          {agentsQuery.isLoading ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
            </div>
          ) : agents.length === 0 ? (
            <Card className="py-6 text-center">
              <Bot size={24} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
              <p className="text-xs text-[var(--color-text-muted)]">No agents yet. Create one.</p>
            </Card>
          ) : (
            agents.map(agent => (
              <button
                key={agent.agent_id}
                onClick={() => handleSelectAgent(agent)}
                className={`w-full text-left rounded-[var(--radius-xl)] border px-4 py-3 transition-all hover:border-[var(--color-accent)] ${
                  selectedAgentId === agent.agent_id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                    <Bot size={13} className="text-[var(--color-accent)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">{agent.name}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">{agent.agent_id}</p>
                  </div>
                </div>
                {agent.metadata?.created_at_unix_secs && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
                    Created {fmtDate(agent.metadata.created_at_unix_secs)}
                  </p>
                )}
              </button>
            ))
          )}

          {/* Default agent quickset */}
          {!agents.some(a => a.agent_id === DEFAULT_AGENT_ID) && (
            <button
              onClick={() => setSelectedAgentId(DEFAULT_AGENT_ID)}
              className={`w-full text-left rounded-[var(--radius-xl)] border px-4 py-3 transition-all hover:border-[var(--color-accent)] ${
                selectedAgentId === DEFAULT_AGENT_ID
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
                  : "border-[var(--color-border)] border-dashed"
              }`}
            >
              <p className="text-xs font-semibold text-[var(--color-text-muted)]">Your saved agent</p>
              <p className="text-[10px] font-mono text-[var(--color-accent)] truncate mt-0.5">{DEFAULT_AGENT_ID}</p>
            </button>
          )}
        </div>

        {/* Agent config form */}
        <div className="space-y-5">
          <Card className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
                  <Mic size={18} className="text-[var(--color-accent)]" />
                </span>
                <div>
                  <p className="section-kicker">Agent configuration</p>
                  <h2 className="display-title !text-[var(--text-lg)]">{name || "New agent"}</h2>
                </div>
              </div>
              {selectedAgentId && selectedAgentId !== "new" && (
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-3)] px-2 py-1 rounded-lg">
                  {selectedAgentId}
                </span>
              )}
            </div>

            <Input
              label="Agent name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Elite Automations Sales Agent"
            />

            {/* Voice picker */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Voice</label>
              <select
                value={voiceId}
                onChange={e => setVoiceId(e.target.value)}
                className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">— select a voice —</option>
                {voicesQuery.isLoading && <option disabled>Loading voices…</option>}
                {voices.map(v => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} ({v.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="en">English</option>
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>

            {/* First message */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Opening message
              </label>
              <textarea
                value={firstMessage}
                onChange={e => setFirstMessage(e.target.value)}
                rows={3}
                className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="What the agent says when the call connects…"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">The first thing the agent says when someone picks up.</p>
            </div>

            {/* System prompt */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                Agent system prompt
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={12}
                className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-mono"
                placeholder="You are an AI agent calling on behalf of…"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Full instructions for how the agent handles the conversation, objections, and closing.
              </p>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saveMutation.isPending || !name || !prompt}
                className="gap-2"
              >
                {saveMutation.isPending
                  ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
                  : <><Save size={14} /> Save agent</>
                }
              </Button>
              {saveMutation.isSuccess && (
                <span className="text-xs text-green-400 flex items-center gap-1">✓ Saved</span>
              )}
              {saveMutation.isError && (
                <span className="text-xs text-red-400">{String(saveMutation.error)}</span>
              )}
            </div>
          </Card>

          {/* Usage tip */}
          <Card className="bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20 flex gap-3">
            <Play size={15} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)] mb-1">How to use your agent</p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Go to <strong>Outbound call</strong>, switch to <strong>AI agent mode</strong>, and this agent
                will handle the entire conversation — pitch, objections, qualification, and booking.
                All transcripts are saved automatically under Conversation history below.
              </p>
            </div>
          </Card>

          {/* Conversation history */}
          {selectedAgentId && selectedAgentId !== "new" && (
            <Card className="space-y-3">
              <button
                onClick={() => setExpandedConvs(v => !v)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[var(--color-text-muted)]" />
                  <span className="text-sm font-semibold text-[var(--color-text)]">Conversation history</span>
                </div>
                {expandedConvs ? <ChevronUp size={14} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={14} className="text-[var(--color-text-muted)]" />}
              </button>

              {expandedConvs && (
                <>
                  {convsQuery.isLoading ? (
                    <div className="space-y-2">
                      {[1,2].map(i => <div key={i} className="h-12 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
                    </div>
                  ) : (convsQuery.data ?? []).length === 0 ? (
                    <div className="py-6 text-center text-[var(--color-text-muted)]">
                      <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No conversations yet. Start an AI call to see transcripts here.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)]">
                      {(convsQuery.data ?? []).map(conv => (
                        <div key={conv.conversation_id} className="flex items-center gap-3 py-3">
                          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-3)] shrink-0">
                            <MessageSquare size={12} className="text-[var(--color-text-muted)]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[var(--color-text)] truncate">
                              {conv.conversation_id}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              {fmtDate(conv.start_time_unix_secs)} · {fmtDur(conv.call_duration_secs)}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${conv.status === "done" ? "bg-green-500/10 text-green-400" : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"}`}>
                            {conv.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
