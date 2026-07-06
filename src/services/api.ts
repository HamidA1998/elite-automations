import type {
  AccountSummary,
  Client360Response,
  LeadDetail,
  LeadPipelineItem,
  LeadSearchStatus,
  MetricsResponse,
  AssetTextResponse,
  DashboardStateResponse,
  PipelineSnapshotResponse,
  CreateAccountRequest,
  OpenClawAgent,
  OpenClawSessionSummary,
  OpenClawSessionDetail,
  OpenClawAgentConfig,
  OpenClawMemorySection,
  OpenClawApprovalsSnapshot,
  OpenClawSystemStats,
  OpenClawSendResponse,
  FirecrawlBusinessSearchReport,
  FirecrawlScrapeResponse,
  KieImageGenerationResponse,
  KieModelsResponse,
  KieVideoGenerationResponse,
  MailInboxResponse,
  MailStatusResponse,
  GmailOAuthUrlResponse,
  AiCommandResponse,
  OpenAiVoiceStatusResponse,
  OpenAiVoiceTranscriptionResponse,
  VoiceToolResponse,
  OperatorApprovalsResponse,
  OperatorCommandResponse,
  OperatorSessionsResponse,
  OperatorStatusResponse,
  ToolForgeResponse,
  ReplyRadarResponse,
  ReplyRadarSyncResponse,
  OwnedVoiceAgentResponse,
  OwnedVoiceAgentTurnResponse,
  DealRoomResponse,
  DealRoomGenerateResponse,
  FinanceGuardResponse,
  WarRoomResponse,
  OpportunityEngineResponse,
  RevenueRadarResponse,
  RevenueRadarScanResponse,
  LeadEvidenceDossierResponse,
  ProofVaultResponse,
  DesignLabResponse,
  MarketWatchlistResponse,
  ApifyActorsResponse,
  ApifyRunResponse,
  ApifyStatusResponse,
  IntegrationsStatusResponse,
  IntegrationsSyncResponse,
} from "@/types/frontend";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:3007";

export function apiUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  if (!url.startsWith("/api")) return url;
  return `${API_BASE_URL}${url}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }
  return (await response.json()) as T;
}

async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(url), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }
  return (await response.json()) as T;
}

export function fetchDashboardState(): Promise<DashboardStateResponse> {
  return getJson<DashboardStateResponse>("/api/state");
}

export function fetchMetrics(): Promise<MetricsResponse> {
  return getJson<MetricsResponse>("/api/metrics");
}

export function fetchAccounts(): Promise<{accounts: AccountSummary[]}> {
  return getJson<{accounts: AccountSummary[]}>("/api/accounts");
}

export function fetchClient360(): Promise<Client360Response> {
  return getJson<Client360Response>("/api/client-360");
}

export function fetchMailStatus(): Promise<MailStatusResponse> {
  return getJson<MailStatusResponse>("/api/mail/status");
}

export function fetchMailInbox(options?: {q?: string; maxResults?: number}): Promise<MailInboxResponse> {
  const params = new URLSearchParams();
  if (options?.q) params.set("q", options.q);
  if (options?.maxResults) params.set("maxResults", String(options.maxResults));
  const query = params.toString();
  return getJson<MailInboxResponse>(`/api/mail/inbox${query ? `?${query}` : ""}`);
}

export function fetchGmailOAuthUrl(): Promise<GmailOAuthUrlResponse> {
  return getJson<GmailOAuthUrlResponse>("/api/mail/oauth/url");
}

export function sendAiCommand(payload: {
  message: string;
  clientId?: string;
  mode?: "operator" | "sales" | "technical" | "strategy";
}): Promise<AiCommandResponse> {
  return sendJson<AiCommandResponse>("/api/ai/command", "POST", payload);
}

export function fetchOpenAiVoiceStatus(): Promise<OpenAiVoiceStatusResponse> {
  return getJson<OpenAiVoiceStatusResponse>("/api/voice/openai/status");
}

export function transcribeOpenAiVoiceAudio(payload: {
  audioBase64: string;
  mimeType: string;
}): Promise<OpenAiVoiceTranscriptionResponse> {
  return sendJson<OpenAiVoiceTranscriptionResponse>("/api/voice/openai/transcribe", "POST", payload);
}

export async function createOpenAiRealtimeAnswer(offerSdp: string): Promise<string> {
  const response = await fetch(apiUrl("/api/voice/openai/realtime-sdp"), {
    method: "POST",
    headers: {
      Accept: "application/sdp",
      "Content-Type": "application/sdp",
    },
    body: offerSdp,
  });
  if (!response.ok) {
    let message = "Realtime voice request failed.";
    try {
      const payload = await response.json() as {error?: string};
      message = payload.error ?? message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }
  return response.text();
}

export function runOpenAiVoiceTool(payload: {
  name: "get_dashboard_context" | "get_visible_app_snapshot" | "navigate" | "run_acquisition" | "ask_dashboard_ai" | "open_highest_priority_lead";
  arguments?: Record<string, unknown>;
}): Promise<VoiceToolResponse> {
  return sendJson<VoiceToolResponse>("/api/voice/openai/tool", "POST", payload);
}

export function fetchOperatorStatus(): Promise<OperatorStatusResponse> {
  return getJson<OperatorStatusResponse>("/api/operator/status");
}

export function fetchOperatorSessions(): Promise<OperatorSessionsResponse> {
  return getJson<OperatorSessionsResponse>("/api/operator/sessions");
}

export function fetchOperatorApprovals(): Promise<OperatorApprovalsResponse> {
  return getJson<OperatorApprovalsResponse>("/api/operator/approvals");
}

export function fetchToolForge(): Promise<ToolForgeResponse> {
  return getJson<ToolForgeResponse>("/api/operator/tool-forge");
}

export function fetchReplyRadar(): Promise<ReplyRadarResponse> {
  return getJson<ReplyRadarResponse>("/api/tools/reply-radar");
}

export function syncReplyRadar(): Promise<ReplyRadarSyncResponse> {
  return sendJson<ReplyRadarSyncResponse>("/api/tools/reply-radar/sync", "POST", {});
}

export function fetchOwnedVoiceAgent(): Promise<OwnedVoiceAgentResponse> {
  return getJson<OwnedVoiceAgentResponse>("/api/tools/voice-agent");
}

export function runOwnedVoiceAgentTurn(payload: {
  transcript: string;
  callerPhone?: string;
  clientId?: string;
}): Promise<OwnedVoiceAgentTurnResponse> {
  return sendJson<OwnedVoiceAgentTurnResponse>("/api/tools/voice-agent/respond", "POST", payload);
}

export function fetchDealRoom(clientId?: string): Promise<DealRoomResponse> {
  return getJson<DealRoomResponse>(clientId ? `/api/tools/deal-room/${encodeURIComponent(clientId)}` : "/api/tools/deal-room");
}

export function generateDealRoomProposal(clientId?: string): Promise<DealRoomGenerateResponse> {
  return sendJson<DealRoomGenerateResponse>("/api/tools/deal-room/generate", "POST", clientId ? {clientId} : {});
}

export function fetchFinanceGuard(): Promise<FinanceGuardResponse> {
  return getJson<FinanceGuardResponse>("/api/tools/finance-guard");
}

export function fetchWarRoom(): Promise<WarRoomResponse> {
  return getJson<WarRoomResponse>("/api/tools/war-room");
}

export function fetchOpportunityEngine(): Promise<OpportunityEngineResponse> {
  return getJson<OpportunityEngineResponse>("/api/tools/opportunity-engine");
}

export function fetchRevenueRadar(): Promise<RevenueRadarResponse> {
  return getJson<RevenueRadarResponse>("/api/tools/revenue-radar");
}

export function runRevenueRadarScan(payload: {
  query: string;
  location: string;
  maxLeads: number;
}): Promise<RevenueRadarScanResponse> {
  return sendJson<RevenueRadarScanResponse>("/api/tools/revenue-radar/scan", "POST", payload);
}

export function fetchLeadEvidenceDossier(clientId?: string): Promise<LeadEvidenceDossierResponse> {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  return getJson<LeadEvidenceDossierResponse>(`/api/tools/evidence-dossier${query}`);
}

export function fetchProofVault(): Promise<ProofVaultResponse> {
  return getJson<ProofVaultResponse>("/api/tools/proof-vault");
}

export function fetchDesignLab(): Promise<DesignLabResponse> {
  return getJson<DesignLabResponse>("/api/tools/design-lab");
}

export function runOperatorCommand(payload: {
  message: string;
  source?: "voice" | "text" | "system";
  route?: string;
  visibleText?: string;
}): Promise<OperatorCommandResponse> {
  return sendJson<OperatorCommandResponse>("/api/operator/command", "POST", payload);
}

export function resolveOperatorApproval(approvalId: string, decision: "approved" | "rejected") {
  return sendJson<{approval: unknown; result: unknown}>(
    `/api/operator/approvals/${encodeURIComponent(approvalId)}/resolve`,
    "POST",
    {decision},
  );
}

export function fetchMarketWatchlist(): Promise<MarketWatchlistResponse> {
  return getJson<MarketWatchlistResponse>("/api/markets/watchlist");
}

export function createAccount(payload: CreateAccountRequest): Promise<{clientId: string; state: DashboardStateResponse}> {
  return sendJson<{clientId: string; state: DashboardStateResponse}>("/api/accounts", "POST", payload);
}

export function fetchLeadPipeline(): Promise<{leads: LeadPipelineItem[]}> {
  return getJson<{leads: LeadPipelineItem[]}>("/api/leads");
}

export function fetchLeadDetail(clientId: string): Promise<LeadDetail> {
  return getJson<LeadDetail>(`/api/leads/${encodeURIComponent(clientId)}`);
}

export function fetchLeadSearchStatus(): Promise<LeadSearchStatus> {
  return getJson<LeadSearchStatus>("/api/leads/search/status");
}

export function triggerLeadSearch(input?: {
  maxQualified?: number;
  maxPerQuery?: number;
}): Promise<LeadSearchStatus> {
  return sendJson<LeadSearchStatus>("/api/leads/search", "POST", input ?? {});
}

export function updateLeadStatus(clientId: string, status: string) {
  return sendJson<DashboardStateResponse>(
    `/api/leads/${encodeURIComponent(clientId)}/status`,
    "PATCH",
    {status},
  );
}

export function queueLeadDemo(clientId: string) {
  return sendJson<DashboardStateResponse>(`/api/leads/${encodeURIComponent(clientId)}/demo`, "POST");
}

export function queueLeadEmail(clientId: string) {
  return sendJson<DashboardStateResponse>(`/api/leads/${encodeURIComponent(clientId)}/email`, "POST");
}

export function queueLeadVideo(clientId: string) {
  return sendJson<DashboardStateResponse>(`/api/leads/${encodeURIComponent(clientId)}/video`, "POST");
}

export function runLeadBrowserAudit(clientId: string) {
  return sendJson<DashboardStateResponse>(`/api/leads/${encodeURIComponent(clientId)}/browser-audit`, "POST");
}

export function fetchAssetText(filePath: string): Promise<AssetTextResponse> {
  return getJson<AssetTextResponse>(`/api/output/text?path=${encodeURIComponent(filePath)}`);
}

export function fetchPipelineSnapshot(): Promise<PipelineSnapshotResponse> {
  return getJson<PipelineSnapshotResponse>("/api/pipeline/results");
}

export function createLeadNote(clientId: string, body: string) {
  return sendJson<DashboardStateResponse>(`/api/accounts/${encodeURIComponent(clientId)}/notes`, "POST", {
    body,
  });
}

export function createLeadContact(
  clientId: string,
  payload: {
    fullName: string;
    role: string;
    email?: string | null;
    phone?: string | null;
    linkedin?: string | null;
    isPrimary?: boolean;
    notes?: string;
    status?: "reachable" | "needs-research" | "decision-maker" | "gatekeeper";
    bestTime?: "Morning 9–12" | "Afternoon 12–5" | "Evening 5–7" | "Any time";
    contactPreference?: "Email first" | "Call first" | "Both";
  },
) {
  return sendJson<DashboardStateResponse>(`/api/accounts/${encodeURIComponent(clientId)}/contacts`, "POST", payload);
}

export function createLeadTimelineEvent(
  clientId: string,
  payload: {
    eventType: string;
    timestamp: string;
    contactName?: string | null;
    notes?: string;
    duration?: number | null;
    followUpDate?: string | null;
    loggedBy?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return sendJson<DashboardStateResponse>(`/api/accounts/${encodeURIComponent(clientId)}/timeline`, "POST", payload);
}

export function createLeadTask(
  clientId: string,
  payload: {
    title: string;
    description?: string;
    status?: "todo" | "doing" | "done" | "blocked";
    priority?: "high" | "medium" | "low";
    dueDate: string;
    owner?: string;
    lane?: string;
    taskType?: string;
  },
) {
  return sendJson<DashboardStateResponse>(`/api/accounts/${encodeURIComponent(clientId)}/tasks`, "POST", payload);
}

export function saveLeadProposal(
  clientId: string,
  payload: {
    title: string;
    status?: "draft" | "sent" | "negotiating" | "accepted" | "lost";
    packageName: string;
    price: number;
    probability: number;
    nextStep: string;
    scope?: string[];
    setupFee?: number;
    monthlyRetainer?: number | null;
    contractLength?: string;
    estimatedDelivery?: string;
    sentDate?: string | null;
    responseDate?: string | null;
    notes?: string;
  },
) {
  return sendJson<DashboardStateResponse>(`/api/accounts/${encodeURIComponent(clientId)}/proposal`, "POST", payload);
}

export function saveLeadMemory(
  clientId: string,
  payload: {
    personality?: string;
    painPoints?: string;
    whatResonates?: string;
    whatToAvoid?: string;
    decisionProcess?: string;
    bestWindow?: string;
    conversationHighlights?: Array<{ date: string; note: string }>;
    objections?: Array<{ objection: string; handled: string }>;
    internalNotes?: string;
  },
) {
  return sendJson<DashboardStateResponse>(`/api/accounts/${encodeURIComponent(clientId)}/memory`, "PATCH", payload);
}

export function fetchOpenClawAgents(): Promise<{agents: OpenClawAgent[]}> {
  return getJson<{agents: OpenClawAgent[]}>("/api/openclaw/agents");
}

export function fetchOpenClawAgent(agentId: string): Promise<OpenClawAgentConfig> {
  return getJson<OpenClawAgentConfig>(`/api/openclaw/agents/${encodeURIComponent(agentId)}`);
}

export function fetchOpenClawSessions(): Promise<{sessions: OpenClawSessionSummary[]}> {
  return getJson<{sessions: OpenClawSessionSummary[]}>("/api/openclaw/sessions");
}

export function fetchOpenClawSession(sessionId: string): Promise<OpenClawSessionDetail> {
  return getJson<OpenClawSessionDetail>(`/api/openclaw/sessions/${encodeURIComponent(sessionId)}`);
}

export function fetchOpenClawSystem(): Promise<OpenClawSystemStats> {
  return getJson<OpenClawSystemStats>("/api/openclaw/system");
}

export function fetchOpenClawMemory(query = ""): Promise<{sections: OpenClawMemorySection[]}> {
  return getJson<{sections: OpenClawMemorySection[]}>(`/api/openclaw/memory?q=${encodeURIComponent(query)}`);
}

export function fetchOpenClawApprovals(): Promise<OpenClawApprovalsSnapshot> {
  return getJson<OpenClawApprovalsSnapshot>("/api/openclaw/approvals");
}

export function sendOpenClawCommand(agentId: string, body: {
  message: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<OpenClawSendResponse> {
  return sendJson<OpenClawSendResponse>(`/api/openclaw/agents/${encodeURIComponent(agentId)}/send`, "POST", body);
}

export function resolveOpenClawApproval(
  approvalId: string,
  decision: "allow-once" | "allow-always" | "deny",
) {
  return sendJson<{ok: boolean}>(`/api/openclaw/approvals/${encodeURIComponent(approvalId)}/resolve`, "POST", {decision});
}

export function runFirecrawlSearch(payload: {
  query: string;
  location?: string;
  limit?: number;
}): Promise<FirecrawlBusinessSearchReport> {
  return sendJson<FirecrawlBusinessSearchReport>("/api/ai/search", "POST", payload);
}

export function runFirecrawlScrape(payload: {
  url: string;
}): Promise<FirecrawlScrapeResponse> {
  return sendJson<FirecrawlScrapeResponse>("/api/ai/scrape", "POST", payload);
}

export function fetchApifyStatus(): Promise<ApifyStatusResponse> {
  return getJson<ApifyStatusResponse>("/api/ai/apify/status");
}

export function fetchIntegrationsStatus(): Promise<IntegrationsStatusResponse> {
  return getJson<IntegrationsStatusResponse>("/api/integrations/status");
}

export function syncIntegration(provider?: "gmail" | "plaid" | "revenuecat" | "appstore"): Promise<IntegrationsSyncResponse> {
  return sendJson<IntegrationsSyncResponse>("/api/integrations/sync", "POST", provider ? {provider} : {});
}

export function searchApifyActors(payload?: {
  query?: string;
  limit?: number;
}): Promise<ApifyActorsResponse> {
  const params = new URLSearchParams();
  if (payload?.query) params.set("q", payload.query);
  if (payload?.limit) params.set("limit", String(payload.limit));
  const query = params.toString();
  return getJson<ApifyActorsResponse>(`/api/ai/apify/actors${query ? `?${query}` : ""}`);
}

export function runApifyActor(actorId: string, payload: {
  input?: Record<string, unknown>;
  waitForFinishSeconds?: number;
  clientId?: string;
  purpose?: string;
}): Promise<ApifyRunResponse> {
  return sendJson<ApifyRunResponse>(`/api/ai/apify/actors/${encodeURIComponent(actorId)}/run`, "POST", payload);
}

export function fetchKieModels(): Promise<KieModelsResponse> {
  return getJson<KieModelsResponse>("/api/ai/kie/models");
}

export function generateKieImage(payload: {
  prompt: string;
  title?: string;
  subtitle?: string;
  clientId?: string;
  modelId?: string;
  aspectRatio?: string;
  inputImageUrls?: string[];
  maskUrl?: string | null;
  variants?: number;
}): Promise<KieImageGenerationResponse> {
  return sendJson<KieImageGenerationResponse>("/api/ai/images/generate", "POST", payload);
}

export function generateKieVideo(payload: {
  prompt: string;
  clientId?: string;
  modelId: string;
  inputImageUrls?: string[];
  duration?: string;
  resolution?: string;
  audio?: boolean;
  cameraFixed?: boolean;
}): Promise<KieVideoGenerationResponse> {
  return sendJson<KieVideoGenerationResponse>("/api/ai/videos/generate", "POST", payload);
}
