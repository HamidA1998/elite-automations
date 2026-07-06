/**
 * ElevenLabs API wrapper — pure fetch, no SDK.
 * Covers: TTS (text-to-speech), voices list, conversational AI agent management.
 * The real-time agent voice-call bridge uses Twilio Media Streams → WebSocket → ElevenLabs.
 */

const EL_BASE = "https://api.elevenlabs.io/v1";

function elHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.ELEVENLABS_API_KEY ?? "";
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");
  return { "xi-api-key": key, ...extra };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ELVoice {
  voice_id: string;
  name: string;
  category: string; // "premade" | "cloned" | "generated"
  labels: Record<string, string>;
  preview_url: string | null;
  description: string | null;
}

export interface ELAgent {
  agent_id: string;
  name: string;
  conversation_config: {
    agent: {
      prompt: { prompt: string };
      first_message: string;
      language: string;
    };
    tts: { voice_id: string; model_id: string };
    asr: { quality: string };
  };
  metadata: {
    created_at_unix_secs: number;
  };
}

export interface ELConversation {
  conversation_id: string;
  agent_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  status: string;
  transcript: Array<{ role: "agent" | "user"; message: string; time_in_call_secs: number }>;
  metadata: Record<string, unknown>;
}

export interface ELTwilioRegisterCallParams {
  agentId: string;
  fromNumber: string;
  toNumber: string;
  direction: "inbound" | "outbound";
  conversationInitiationClientData?: Record<string, unknown>;
}

// ─── Voices ───────────────────────────────────────────────────────────────────

export async function getVoices(): Promise<ELVoice[]> {
  const res = await fetch(`${EL_BASE}/voices`, { headers: elHeaders() });
  if (!res.ok) throw new Error(`ElevenLabs getVoices → ${res.status}`);
  const data = await res.json() as { voices: ELVoice[] };
  return data.voices ?? [];
}

export async function getVoice(voiceId: string): Promise<ELVoice> {
  const res = await fetch(`${EL_BASE}/voices/${voiceId}`, { headers: elHeaders() });
  if (!res.ok) throw new Error(`ElevenLabs getVoice → ${res.status}`);
  return res.json() as Promise<ELVoice>;
}

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

export async function textToSpeech(params: {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}): Promise<Buffer> {
  const voiceId = params.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
  const modelId = params.modelId ?? "eleven_turbo_v2_5";

  const res = await fetch(`${EL_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      ...elHeaders({ "Content-Type": "application/json" }),
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: modelId,
      voice_settings: {
        stability: params.stability ?? 0.5,
        similarity_boost: params.similarityBoost ?? 0.75,
        style: params.style ?? 0.0,
        use_speaker_boost: params.useSpeakerBoost ?? true,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ElevenLabs TTS → ${res.status}: ${txt}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Conversational AI Agents ─────────────────────────────────────────────────

export async function getAgents(): Promise<ELAgent[]> {
  const res = await fetch(`${EL_BASE}/convai/agents`, { headers: elHeaders() });
  if (!res.ok) throw new Error(`ElevenLabs getAgents → ${res.status}`);
  const data = await res.json() as { agents: ELAgent[] };
  return data.agents ?? [];
}

export async function getAgent(agentId: string): Promise<ELAgent> {
  const res = await fetch(`${EL_BASE}/convai/agents/${agentId}`, { headers: elHeaders() });
  if (!res.ok) throw new Error(`ElevenLabs getAgent → ${res.status}`);
  return res.json() as Promise<ELAgent>;
}

export async function createAgent(config: {
  name: string;
  prompt: string;
  firstMessage: string;
  voiceId?: string;
  language?: string;
  modelId?: string;
}): Promise<ELAgent> {
  const voiceId = config.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

  const body = {
    name: config.name,
    conversation_config: {
      agent: {
        prompt: { prompt: config.prompt },
        first_message: config.firstMessage,
        language: config.language ?? "en",
      },
      tts: {
        voice_id: voiceId,
        model_id: config.modelId ?? "eleven_turbo_v2_5",
      },
      asr: { quality: "high" },
    },
  };

  const res = await fetch(`${EL_BASE}/convai/agents/create`, {
    method: "POST",
    headers: elHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ElevenLabs createAgent → ${res.status}: ${txt}`);
  }
  return res.json() as Promise<ELAgent>;
}

export async function updateAgent(agentId: string, config: {
  name?: string;
  prompt?: string;
  firstMessage?: string;
  voiceId?: string;
  language?: string;
}): Promise<ELAgent> {
  const res = await fetch(`${EL_BASE}/convai/agents/${agentId}`, {
    method: "PATCH",
    headers: elHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      ...(config.name ? { name: config.name } : {}),
      conversation_config: {
        ...(config.prompt ? { agent: { prompt: { prompt: config.prompt } } } : {}),
        ...(config.firstMessage ? { agent: { first_message: config.firstMessage } } : {}),
        ...(config.voiceId ? { tts: { voice_id: config.voiceId } } : {}),
        ...(config.language ? { agent: { language: config.language } } : {}),
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ElevenLabs updateAgent → ${res.status}: ${txt}`);
  }
  return res.json() as Promise<ELAgent>;
}

/** Get a signed WebSocket URL to start a conversation with an agent */
export async function getAgentSignedUrl(agentId: string): Promise<string> {
  const res = await fetch(`${EL_BASE}/convai/conversation/get_signed_url?agent_id=${agentId}`, {
    headers: elHeaders(),
  });
  if (!res.ok) throw new Error(`ElevenLabs getAgentSignedUrl → ${res.status}`);
  const data = await res.json() as { signed_url: string };
  return data.signed_url;
}

/** Get agent's conversation history */
export async function getAgentConversations(agentId: string, limit = 50): Promise<ELConversation[]> {
  const res = await fetch(
    `${EL_BASE}/convai/conversations?agent_id=${agentId}&page_size=${limit}`,
    { headers: elHeaders() },
  );
  if (!res.ok) throw new Error(`ElevenLabs getAgentConversations → ${res.status}`);
  const data = await res.json() as { conversations: ELConversation[] };
  return data.conversations ?? [];
}

export async function getConversation(conversationId: string): Promise<ELConversation> {
  const res = await fetch(`${EL_BASE}/convai/conversations/${conversationId}`, {
    headers: elHeaders(),
  });
  if (!res.ok) throw new Error(`ElevenLabs getConversation → ${res.status}`);
  return res.json() as Promise<ELConversation>;
}

export async function registerTwilioCall(params: ELTwilioRegisterCallParams): Promise<string> {
  const res = await fetch(`${EL_BASE}/convai/twilio/register-call`, {
    method: "POST",
    headers: elHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      agent_id: params.agentId,
      from_number: params.fromNumber,
      to_number: params.toNumber,
      direction: params.direction,
      conversation_initiation_client_data: params.conversationInitiationClientData ?? {},
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs registerTwilioCall → ${res.status}: ${text}`);
  }
  return text;
}

// ─── Default sales agent config ───────────────────────────────────────────────

export function buildSalesPitch(businessName: string, ownerName: string): string {
  return `You are an AI sales agent calling on behalf of ${ownerName ?? "Hamid"} from Elite Automations, a digital marketing and automation agency based in Greater Manchester.

Your goal is to have a natural, confident conversation with the business owner of ${businessName}.

Your pitch:
- Introduce yourself professionally
- Mention you've done some research on their business and noticed opportunities to improve their online presence
- Offer a free website audit and demo showing how automation can bring them more leads
- Ask qualifying questions about their current marketing setup
- Try to book a 15-minute discovery call or video walkthrough

Be conversational, not robotic. Listen actively. If they're busy, offer to call back at a better time.
If they say yes to a meeting, confirm their best contact details and time slot.

Key phrases to use naturally:
- "We help businesses like yours generate consistent leads online"
- "I can show you exactly what your competitors are doing that you're not"
- "The demo takes 10 minutes and it's completely free"

Never be pushy. If they're not interested, thank them and ask if you can send an email with more information.`;
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}
