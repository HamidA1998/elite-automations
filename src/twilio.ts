/**
 * Twilio REST API wrapper — pure fetch, no SDK dependency.
 * Covers: outbound calls, call logs, recordings, SMS, phone numbers, webhooks.
 */

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

function twilioAuth(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured");
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

function accountSid(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  if (!sid) throw new Error("TWILIO_ACCOUNT_SID not configured");
  return sid;
}

async function twilioFetch<T>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, string>,
): Promise<T> {
  const url = `${TWILIO_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: twilioAuth(),
    Accept: "application/json",
  };
  let bodyStr: string | undefined;
  if (body && method !== "GET") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    bodyStr = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, { method, headers, body: bodyStr });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Twilio ${method} ${path} → ${res.status}: ${txt}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwilioCall {
  sid: string;
  to: string;
  from: string;
  status: string; // queued, ringing, in-progress, completed, failed, busy, no-answer, canceled
  direction: string; // inbound | outbound-api | outbound-dial
  duration: string; // seconds as string
  start_time: string;
  end_time: string;
  price: string | null;
  price_unit: string;
  answered_by: string | null;
  caller_name: string | null;
  forwarded_from: string | null;
  to_formatted: string;
  from_formatted: string;
  uri: string;
}

export interface TwilioMessage {
  sid: string;
  to: string;
  from: string;
  body: string;
  status: string; // queued, sent, delivered, read, failed, undelivered
  direction: string; // inbound | outbound-api
  date_sent: string;
  date_created: string;
  price: string | null;
  price_unit: string;
  num_segments: string;
  error_code: string | null;
  error_message: string | null;
}

export interface TwilioRecording {
  sid: string;
  call_sid: string;
  duration: string;
  date_created: string;
  status: string;
  source: string;
  channels: number;
  uri: string;
}

export interface TwilioPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  status: string;
}

export interface TwilioConference {
  sid: string;
  friendly_name: string;
  status: string;
  date_created: string;
  region: string;
}

// ─── Calls ───────────────────────────────────────────────────────────────────

/**
 * Initiate an outbound call.
 * twimlUrl should point to your /api/calls/twiml endpoint.
 */
export async function makeCall(params: {
  to: string;
  from?: string;
  twimlUrl: string;
  statusCallbackUrl?: string;
  record?: boolean;
  machineDetection?: "Enable" | "DetectMessageEnd";
  timeout?: number;
  callerId?: string;
}): Promise<TwilioCall> {
  const from = params.from ?? process.env.TWILIO_PHONE_NUMBER ?? "";
  if (!from) throw new Error("No Twilio phone number configured (TWILIO_PHONE_NUMBER)");

  const body: Record<string, string> = {
    To: params.to,
    From: from,
    Url: params.twimlUrl,
  };
  if (params.statusCallbackUrl) body.StatusCallback = params.statusCallbackUrl;
  if (params.statusCallbackUrl) body.StatusCallbackMethod = "POST";
  if (params.record) body.Record = "true";
  if (params.machineDetection) body.MachineDetection = params.machineDetection;
  if (params.timeout) body.Timeout = String(params.timeout);

  return twilioFetch<TwilioCall>(`/Accounts/${accountSid()}/Calls.json`, "POST", body);
}

/** Fetch call logs, most recent first */
export async function getCallLogs(limit = 50, page = 0): Promise<{ calls: TwilioCall[]; nextPage: string | null }> {
  const params = new URLSearchParams({ PageSize: String(limit), Page: String(page) });
  const data = await twilioFetch<{ calls: TwilioCall[]; next_page_uri: string | null }>(
    `/Accounts/${accountSid()}/Calls.json?${params}`,
  );
  return { calls: data.calls ?? [], nextPage: data.next_page_uri ?? null };
}

/** Get a single call by SID */
export async function getCall(callSid: string): Promise<TwilioCall> {
  return twilioFetch<TwilioCall>(`/Accounts/${accountSid()}/Calls/${callSid}.json`);
}

export async function endCall(callSid: string): Promise<TwilioCall> {
  return twilioFetch<TwilioCall>(`/Accounts/${accountSid()}/Calls/${callSid}.json`, "POST", {
    Status: "completed",
  });
}

/** Fetch recordings for a specific call, or all recordings */
export async function getRecordings(callSid?: string, limit = 50): Promise<TwilioRecording[]> {
  const base = callSid
    ? `/Accounts/${accountSid()}/Calls/${callSid}/Recordings.json`
    : `/Accounts/${accountSid()}/Recordings.json`;
  const data = await twilioFetch<{ recordings: TwilioRecording[] }>(`${base}?PageSize=${limit}`);
  return data.recordings ?? [];
}

/** Build the public MP3 URL for a recording */
export function recordingMp3Url(recordingSid: string): string {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  // Basic auth embedded in URL for direct browser download
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  return `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${recordingSid}.mp3`;
}

// ─── SMS / Messages ───────────────────────────────────────────────────────────

/** Send an SMS message */
export async function sendSMS(params: {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string;
  statusCallbackUrl?: string;
}): Promise<TwilioMessage> {
  const from = params.from ?? process.env.TWILIO_PHONE_NUMBER ?? "";
  if (!from) throw new Error("No Twilio phone number configured");

  const body: Record<string, string> = {
    To: params.to,
    From: from,
    Body: params.body,
  };
  if (params.mediaUrl) body.MediaUrl = params.mediaUrl;
  if (params.statusCallbackUrl) body.StatusCallback = params.statusCallbackUrl;

  return twilioFetch<TwilioMessage>(`/Accounts/${accountSid()}/Messages.json`, "POST", body);
}

/** Fetch messages (inbox + sent), most recent first */
export async function getMessages(params: {
  limit?: number;
  to?: string;
  from?: string;
  page?: number;
} = {}): Promise<{ messages: TwilioMessage[]; nextPage: string | null }> {
  const qs = new URLSearchParams({ PageSize: String(params.limit ?? 50), Page: String(params.page ?? 0) });
  if (params.to)   qs.set("To",   params.to);
  if (params.from) qs.set("From", params.from);

  const data = await twilioFetch<{ messages: TwilioMessage[]; next_page_uri: string | null }>(
    `/Accounts/${accountSid()}/Messages.json?${qs}`,
  );
  return { messages: data.messages ?? [], nextPage: data.next_page_uri ?? null };
}

/** Fetch a single SMS thread (conversation) with a specific number */
export async function getSMSThread(remoteNumber: string): Promise<TwilioMessage[]> {
  const localNumber = process.env.TWILIO_PHONE_NUMBER ?? "";

  const [inbound, outbound] = await Promise.all([
    getMessages({ to: localNumber, from: remoteNumber, limit: 100 }),
    getMessages({ from: localNumber, to: remoteNumber, limit: 100 }),
  ]);

  const combined = [...inbound.messages, ...outbound.messages];
  combined.sort((a, b) => new Date(a.date_sent ?? a.date_created).getTime() - new Date(b.date_sent ?? b.date_created).getTime());
  return combined;
}

// ─── Phone Numbers ────────────────────────────────────────────────────────────

export async function getPhoneNumbers(): Promise<TwilioPhoneNumber[]> {
  const data = await twilioFetch<{ incoming_phone_numbers: TwilioPhoneNumber[] }>(
    `/Accounts/${accountSid()}/IncomingPhoneNumbers.json`,
  );
  return data.incoming_phone_numbers ?? [];
}

// ─── Account summary ──────────────────────────────────────────────────────────

export interface TwilioSummary {
  configured: boolean;
  accountSid: string;
  phoneNumber: string;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  totalMessages: number;
  totalRecordings: number;
  recentCalls: TwilioCall[];
  recentMessages: TwilioMessage[];
}

export async function getTwilioSummary(): Promise<TwilioSummary> {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER ?? "";

  if (!sid || !token) {
    return {
      configured: false,
      accountSid: "",
      phoneNumber: "",
      totalCalls: 0,
      answeredCalls: 0,
      failedCalls: 0,
      totalMessages: 0,
      totalRecordings: 0,
      recentCalls: [],
      recentMessages: [],
    };
  }

  const [callData, msgData, recData] = await Promise.allSettled([
    getCallLogs(20),
    getMessages({ limit: 20 }),
    getRecordings(undefined, 5),
  ]);

  const calls = callData.status === "fulfilled" ? callData.value.calls : [];
  const msgs  = msgData.status === "fulfilled"  ? msgData.value.messages : [];
  const recs  = recData.status === "fulfilled"  ? recData.value : [];

  return {
    configured: true,
    accountSid: sid,
    phoneNumber,
    totalCalls:      calls.length,
    answeredCalls:   calls.filter(c => c.status === "completed").length,
    failedCalls:     calls.filter(c => ["failed", "busy", "no-answer"].includes(c.status)).length,
    totalMessages:   msgs.length,
    totalRecordings: recs.length,
    recentCalls:     calls.slice(0, 10),
    recentMessages:  msgs.slice(0, 10),
  };
}

// ─── TwiML helpers ────────────────────────────────────────────────────────────

/** Build TwiML for a simple text-to-speech call */
export function buildSayTwiML(message: string, voice = "Polly.Joanna-Neural"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(message)}</Say>
</Response>`;
}

/** Build TwiML for media stream (for ElevenLabs AI voice agent) */
export function buildStreamTwiML(streamWsUrl: string, leadName?: string, businessName?: string): string {
  const params = [
    leadName     ? `<Parameter name="leadName" value="${escapeXml(leadName)}" />` : "",
    businessName ? `<Parameter name="businessName" value="${escapeXml(businessName)}" />` : "",
  ].filter(Boolean).join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamWsUrl}">
    ${params}
    </Stream>
  </Connect>
</Response>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function isTwilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}
