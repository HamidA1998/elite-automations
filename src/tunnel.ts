/**
 * Tunnel management — public webhook bridge for local development
 *
 * Spawns a Cloudflare quick tunnel, validates that the public URL reaches
 * this dashboard server, then auto-configures Twilio and ElevenLabs webhooks.
 */

import { type ChildProcess, spawn } from "node:child_process";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TunnelState {
  status: "stopped" | "starting" | "running" | "error";
  url: string | null;
  startedAt: string | null;
  twilioConfigured: boolean;
  elevenLabsConfigured: boolean;
  error: string | null;
}

// ─── Module-level state ────────────────────────────────────────────────────────

let state: TunnelState = {
  status: "stopped",
  url: null,
  startedAt: null,
  twilioConfigured: false,
  elevenLabsConfigured: false,
  error: null,
};

let tunnelProcess: ChildProcess | null = null;

// ─── Accessors ─────────────────────────────────────────────────────────────────

export function getTunnelState(): TunnelState {
  return { ...state };
}

export function getTunnelUrl(): string | null {
  return state.url;
}

// ─── Webhook configurators ─────────────────────────────────────────────────────

async function configureTwilioWebhooks(baseUrl: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const agentId = process.env.ELEVENLABS_AGENT_ID ?? "";
  if (!sid || !auth || !phoneNumber) return false;

  try {
    const creds = Buffer.from(`${sid}:${auth}`).toString("base64");

    // Find phone number SID
    const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Basic ${creds}` },
    });
    if (!searchRes.ok) return false;

    const searchData = (await searchRes.json()) as {
      incoming_phone_numbers?: Array<{ sid: string }>;
    };
    const phoneSid = searchData.incoming_phone_numbers?.[0]?.sid;
    if (!phoneSid) return false;

    // Update webhooks
    const updateUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${phoneSid}.json`;
    const voiceUrl = new URL("/api/calls/twiml", baseUrl);
    if (agentId) {
      voiceUrl.searchParams.set("mode", "ai-agent");
      voiceUrl.searchParams.set("agentId", agentId);
    }
    const body = new URLSearchParams({
      VoiceUrl: voiceUrl.toString(),
      VoiceMethod: "POST",
      StatusCallback: `${baseUrl}/api/calls/status`,
      StatusCallbackMethod: "POST",
      SmsUrl: `${baseUrl}/api/sms/webhook`,
      SmsMethod: "POST",
    });
    const updateRes = await fetch(updateUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    return updateRes.ok;
  } catch {
    return false;
  }
}

async function configureElevenLabsWebhook(baseUrl: string): Promise<boolean> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId =
    process.env.ELEVENLABS_AGENT_ID ?? "agent_1201kp6qhf3zfz9actd3d8k7dv1q";
  if (!apiKey) return false;

  try {
    const personalizationUrl = `${baseUrl}/api/voice/elevenlabs/personalization`;
    const postCallUrl = `${baseUrl}/api/voice/elevenlabs/post-call`;
    const headers = {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    };

    const webhooksRes = await fetch("https://api.elevenlabs.io/v1/workspace/webhooks", {
      headers,
    });
    if (!webhooksRes.ok) return false;

    const webhooksData = (await webhooksRes.json()) as {
      webhooks?: Array<{ webhook_id: string; webhook_url: string }>;
    };
    let postCallWebhookId = webhooksData.webhooks?.find((webhook) => webhook.webhook_url === postCallUrl)?.webhook_id ?? null;

    if (!postCallWebhookId) {
      const createWebhookRes = await fetch("https://api.elevenlabs.io/v1/workspace/webhooks", {
        method: "POST",
        headers,
        body: JSON.stringify({
          settings: {
            auth_type: "hmac",
            name: "EliteAutomationsPostCall",
            webhook_url: postCallUrl,
          },
        }),
      });
      if (!createWebhookRes.ok) return false;
      const created = (await createWebhookRes.json()) as { webhook_id?: string };
      postCallWebhookId = created.webhook_id ?? null;
    }

    if (!postCallWebhookId) return false;

    const settingsRes = await fetch("https://api.elevenlabs.io/v1/convai/settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        conversation_initiation_client_data_webhook: {
          url: personalizationUrl,
          request_headers: {},
        },
        webhooks: {
          post_call_webhook_id: postCallWebhookId,
          events: ["transcript", "call_initiation_failure"],
          send_audio: false,
        },
      }),
    });
    if (!settingsRes.ok) return false;

    const agentRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        platform_settings: {
          overrides: {
            enable_conversation_initiation_client_data_from_webhook: true,
          },
        },
      }),
    });
    return agentRes.ok;
  } catch {
    return false;
  }
}

async function validatePublicBackend(baseUrl: string): Promise<boolean> {
  const healthUrl = new URL("/api/health", baseUrl);
  const twimlUrl = new URL("/api/calls/twiml", baseUrl);
  twimlUrl.searchParams.set("mode", "manual");

  await new Promise((resolve) => setTimeout(resolve, 12_000));

  for (let attempt = 0; attempt < 36; attempt += 1) {
    try {
      const healthRes = await fetch(healthUrl, { signal: AbortSignal.timeout(4_000) });
      if (!healthRes.ok) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        continue;
      }

      const twimlRes = await fetch(twimlUrl, { signal: AbortSignal.timeout(4_000) });
      const contentType = twimlRes.headers.get("content-type") ?? "";
      const body = await twimlRes.text();

      if (
        healthRes.ok &&
        twimlRes.ok &&
        contentType.includes("text/xml") &&
        body.trim().startsWith("<?xml")
      ) {
        return true;
      }
    } catch {
      // Cloudflare quick tunnels can take a few seconds to route globally.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  return false;
}

// ─── Start / Stop ──────────────────────────────────────────────────────────────

export async function startTunnel(): Promise<TunnelState> {
  if (state.status === "running" || state.status === "starting") {
    return { ...state };
  }

  state = { ...state, status: "starting", error: null };

  return new Promise((resolve) => {
    const proc = spawn("cloudflared", ["tunnel", "--config", "/dev/null", "--url", "http://127.0.0.1:3007", "--no-autoupdate"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    tunnelProcess = proc;

    let urlFound = false;
    let startupTimer: ReturnType<typeof setTimeout>;

    const onData = async (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !urlFound) {
        urlFound = true;
        clearTimeout(startupTimer);
        const url = match[0];

        const publicBackendReady = await validatePublicBackend(url);
        if (!publicBackendReady) {
          proc.kill("SIGTERM");
          state = {
            ...state,
            status: "error",
            url: null,
            error: `Tunnel URL was allocated but did not route to the dashboard API: ${url}`,
          };
          resolve({ ...state });
          return;
        }

        const [twilio, eleven] = await Promise.all([
          configureTwilioWebhooks(url),
          configureElevenLabsWebhook(url),
        ]);

        state = {
          status: "running",
          url,
          startedAt: new Date().toISOString(),
          twilioConfigured: twilio,
          elevenLabsConfigured: eleven,
          error: null,
        };
        resolve({ ...state });
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    proc.on("error", (err) => {
      state = { ...state, status: "error", error: err.message };
      if (!urlFound) resolve({ ...state });
    });

    proc.on("exit", () => {
      if (state.status !== "error") {
        state = { ...state, status: "stopped", url: null };
      }
      tunnelProcess = null;
    });

    // 30-second timeout
    startupTimer = setTimeout(() => {
      if (!urlFound) {
        state = {
          ...state,
          status: "error",
          error:
            "Tunnel did not start within 30s - Cloudflare did not allocate a public URL.",
        };
        resolve({ ...state });
      }
    }, 30_000);
  });
}

export function stopTunnel(): void {
  tunnelProcess?.kill("SIGTERM");
  tunnelProcess = null;
  state = {
    status: "stopped",
    url: null,
    startedAt: null,
    twilioConfigured: false,
    elevenLabsConfigured: false,
    error: null,
  };
}
