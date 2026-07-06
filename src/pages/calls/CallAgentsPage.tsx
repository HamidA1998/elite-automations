import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, CheckCircle2, Link2, Mic, PhoneCall, RadioTower, ShieldCheck, Sparkles } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiUrl } from "@/services/api";

interface CallsConfigResponse {
  configured: boolean;
  elevenLabsConfigured: boolean;
  phoneNumber: string;
  accountSid: string;
  elevenLabsAgentId: string;
  streamUrl: string;
  publicBaseUrl: string;
  publicWebhookReady: boolean;
  phoneNumbers: Array<{
    sid: string;
    phoneNumber: string;
    friendlyName: string;
    capabilities: { voice: boolean; sms: boolean; mms: boolean };
  }>;
  agents: Array<{
    id: string;
    name: string;
    voiceId: string | null;
    firstMessage: string;
  }>;
  voices: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  selectedAgent: {
    id: string;
    name: string;
    firstMessage: string;
    prompt: string;
    voiceId: string;
    language: string;
  } | null;
}

async function fetchCallsConfig(): Promise<CallsConfigResponse> {
  const res = await fetch(apiUrl("/api/calls/config"));
  if (!res.ok) throw new Error("Failed to load call configuration");
  return res.json() as Promise<CallsConfigResponse>;
}

async function placeTestCall(params: { to: string; agentId?: string }) {
  const res = await fetch(apiUrl("/api/calls/outbound"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: params.to,
      mode: "ai-agent",
      agentId: params.agentId,
    }),
  });
  if (!res.ok) {
    const data = await res.json() as { error?: string };
    throw new Error(data.error ?? "Unable to start test call");
  }
  return res.json() as Promise<{ callSid: string; status: string }>;
}

const responsibilities = [
  {
    name: "JARVIS / CEO agent",
    role: "Owns decision quality, call strategy, escalation logic, and booking confidence.",
    systems: ["Lead scoring", "Call scripts", "Follow-up planning", "Executive summaries"],
  },
  {
    name: "OPS agent",
    role: "Monitors live call runs, retries failed touches, and raises stuck or missed callbacks.",
    systems: ["Call queue", "Follow-up tasks", "Error routing", "Missed-call recovery"],
  },
  {
    name: "OUTREACH agent",
    role: "Shapes the opening pitch, objection handling, and SMS or email continuation after each call.",
    systems: ["Cold call prompts", "SMS continuation", "Email handoff", "Reply handling"],
  },
  {
    name: "SUPPORT agent",
    role: "Takes inbound bookings and service questions once clients are live.",
    systems: ["Inbound calls", "Appointment capture", "Aftercare updates", "Customer records"],
  },
];

export function CallAgentsPage() {
  const [agentIdOverride, setAgentIdOverride] = useState("");
  const [testNumber, setTestNumber] = useState("");

  const configQuery = useQuery({
    queryKey: ["calls-config"],
    queryFn: fetchCallsConfig,
    staleTime: 60_000,
  });

  const testCallMutation = useMutation({
    mutationFn: placeTestCall,
  });

  const effectiveAgentId = useMemo(
    () => agentIdOverride.trim() || configQuery.data?.elevenLabsAgentId || import.meta.env.VITE_ELEVENLABS_AGENT_ID || "",
    [agentIdOverride, configQuery.data?.elevenLabsAgentId],
  );

  return (
    <PageWrapper
      eyebrow="Calls"
      title="Voice agent control"
      description="Operate the Twilio and ElevenLabs calling stack as one clean system inside the main app."
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Orchestration</p>
                <h2 className="display-title !text-[var(--text-lg)]">Twilio voice runtime</h2>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${configQuery.data?.configured ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-300"}`}>
                <RadioTower size={13} />
                {configQuery.data?.configured ? "Connected" : "Needs setup"}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <p className="section-kicker">Twilio line</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                  {configQuery.data?.phoneNumber || "No sending number configured"}
                </p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  The live number that ElevenLabs uses for outbound and inbound conversations.
                </p>
              </div>
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <p className="section-kicker">Gateway base</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text)] break-all">
                  {configQuery.data?.publicBaseUrl || "PUBLIC_BASE_URL missing"}
                </p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  Twilio reaches your voice webhook here before calls are streamed into the agent.
                </p>
                <p className={`mt-3 text-xs font-medium ${configQuery.data?.publicWebhookReady ? "text-green-400" : "text-amber-300"}`}>
                  {configQuery.data?.publicWebhookReady ? "Public webhook ready for live Twilio traffic." : "Still local-only. Use a public tunnel or production domain before expecting live inbound/outbound webhooks."}
                </p>
              </div>
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 md:col-span-2">
                <p className="section-kicker">Realtime stream</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text)] break-all">
                  {configQuery.data?.streamUrl || "ELEVENLABS_TWILIO_STREAM_URL missing"}
                </p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  This is the websocket stream that carries audio between Twilio and the ElevenLabs voice agent.
                </p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="section-kicker">Agent topology</p>
              <h2 className="display-title !text-[var(--text-lg)]">Who owns what</h2>
            </div>
            <div className="grid gap-4">
              {responsibilities.map((item) => (
                <div key={item.name} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] shrink-0">
                      <Bot size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text)]">{item.name}</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.role}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.systems.map((system) => (
                          <span key={system} className="rounded-full bg-[var(--color-surface-3)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                            {system}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <p className="section-kicker">Control room</p>
              <h2 className="display-title !text-[var(--text-lg)]">Run a live agent test</h2>
            </div>

            <Input
              label="ElevenLabs agent ID"
              value={effectiveAgentId}
              onChange={(event) => setAgentIdOverride(event.target.value)}
              placeholder="agent_xxxxx"
            />
            <Input
              label="Destination number"
              value={testNumber}
              onChange={(event) => setTestNumber(event.target.value)}
              placeholder="+44 7..."
            />

            <Button
              variant="primary"
              className="w-full gap-2"
              onClick={() => testCallMutation.mutate({ to: testNumber, agentId: effectiveAgentId })}
              disabled={!testNumber.trim() || !effectiveAgentId.trim() || testCallMutation.isPending}
            >
              <PhoneCall size={16} />
              {testCallMutation.isPending ? "Starting test call..." : "Start voice-agent call"}
            </Button>

            {testCallMutation.isSuccess && (
              <div className="rounded-[var(--radius-xl)] bg-green-500/10 px-4 py-3 text-sm text-green-300">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={15} />
                  Test call live
                </div>
                <p className="mt-1 text-xs text-green-200/80">
                  Call SID {testCallMutation.data.callSid} is running with status {testCallMutation.data.status}.
                </p>
              </div>
            )}
            {testCallMutation.isError && (
              <div className="rounded-[var(--radius-xl)] bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {testCallMutation.error instanceof Error ? testCallMutation.error.message : "Unable to start test call"}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="section-kicker">ElevenLabs runtime</p>
              <h2 className="display-title !text-[var(--text-lg)]">Selected agent</h2>
            </div>
            {configQuery.data?.selectedAgent ? (
              <div className="space-y-4 text-sm text-[var(--color-text-muted)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{configQuery.data.selectedAgent.name}</p>
                  <p className="mt-1">Language: {configQuery.data.selectedAgent.language} · Voice: {configQuery.data.selectedAgent.voiceId || "none set"}</p>
                </div>
                <div>
                  <p className="section-kicker">First message</p>
                  <p className="mt-2 leading-relaxed">{configQuery.data.selectedAgent.firstMessage || "No first message configured yet."}</p>
                </div>
                <div>
                  <p className="section-kicker">Prompt</p>
                  <div className="mt-2 max-h-40 overflow-auto rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-3 text-xs leading-6 text-[var(--color-text-muted)]">
                    {configQuery.data.selectedAgent.prompt || "No prompt loaded yet."}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                No ElevenLabs agent is selected yet. Add `ELEVENLABS_AGENT_ID` once you’ve chosen or created the live sales agent.
              </p>
            )}
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="section-kicker">Runtime contract</p>
              <h2 className="display-title !text-[var(--text-lg)]">How the call loop works</h2>
            </div>
            <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
              <div className="flex gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-accent)] shrink-0">
                  <PhoneCall size={14} />
                </span>
                <p>Twilio places or receives the call and hits the dashboard webhook.</p>
              </div>
              <div className="flex gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-accent)] shrink-0">
                  <Link2 size={14} />
                </span>
                <p>The server responds with TwiML that either speaks directly or streams audio into ElevenLabs.</p>
              </div>
              <div className="flex gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-accent)] shrink-0">
                  <Mic size={14} />
                </span>
                <p>The agent speaks, qualifies, books, and hands context back into the CRM timeline and follow-up system.</p>
              </div>
              <div className="flex gap-3">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[var(--color-accent)] shrink-0">
                  <ShieldCheck size={14} />
                </span>
                <p>Twilio records, statuses, and SMS follow-ups stay observable inside the same Ops workspace.</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="section-kicker">What to configure</p>
              <h2 className="display-title !text-[var(--text-lg)]">Required environment keys</h2>
            </div>
            <div className="grid gap-3 text-xs text-[var(--color-text-muted)]">
              {[
                "TWILIO_ACCOUNT_SID",
                "TWILIO_AUTH_TOKEN",
                "TWILIO_PHONE_NUMBER",
                "PUBLIC_BASE_URL",
                "ELEVENLABS_API_KEY",
                "ELEVENLABS_AGENT_ID",
                "ELEVENLABS_TWILIO_STREAM_URL",
              ].map((key) => (
                <div key={key} className="flex items-center justify-between rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] px-3 py-2">
                  <span className="font-medium text-[var(--color-text)]">{key}</span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={12} />
                    live runtime
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="section-kicker">Connected inventory</p>
              <h2 className="display-title !text-[var(--text-lg)]">Numbers, agents, voices</h2>
            </div>
            <div className="grid gap-4 text-sm text-[var(--color-text-muted)]">
              <div>
                <p className="section-kicker">Twilio numbers</p>
                <div className="mt-2 space-y-2">
                  {(configQuery.data?.phoneNumbers ?? []).map((item) => (
                    <div key={item.sid} className="rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] px-3 py-2">
                      <div className="font-medium text-[var(--color-text)]">{item.phoneNumber}</div>
                      <div className="text-xs">{item.friendlyName || "Active line"} · voice {item.capabilities.voice ? "on" : "off"} · sms {item.capabilities.sms ? "on" : "off"}</div>
                    </div>
                  ))}
                  {!configQuery.data?.phoneNumbers?.length ? <div className="text-xs">No Twilio numbers returned yet.</div> : null}
                </div>
              </div>
              <div>
                <p className="section-kicker">ElevenLabs agents</p>
                <div className="mt-2 space-y-2">
                  {(configQuery.data?.agents ?? []).slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] px-3 py-2">
                      <div className="font-medium text-[var(--color-text)]">{item.name}</div>
                      <div className="text-xs">{item.id} · voice {item.voiceId || "none"} </div>
                    </div>
                  ))}
                  {!configQuery.data?.agents?.length ? <div className="text-xs">No ElevenLabs agents loaded yet.</div> : null}
                </div>
              </div>
              <div>
                <p className="section-kicker">Voices</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(configQuery.data?.voices ?? []).slice(0, 12).map((voice) => (
                    <span key={voice.id} className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
                      {voice.name}
                    </span>
                  ))}
                  {!configQuery.data?.voices?.length ? <span className="text-xs">No voices loaded yet.</span> : null}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
