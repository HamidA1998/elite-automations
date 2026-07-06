export type ThemeMode = "auto" | "dawn" | "day" | "dusk" | "night";

export type TimeMode = "dawn" | "day" | "dusk" | "night";

export type SchedulePriority = "high" | "medium" | "low";

export type ScheduleCategory =
  | "Outreach"
  | "Build"
  | "Research"
  | "Personal"
  | "Family";

export interface ScheduleItem {
  id: string;
  title: string;
  date: string;
  time: string;
  priority: SchedulePriority;
  category: ScheduleCategory;
  completed: boolean;
  createdAt: string;
}

export interface DashboardMetrics {
  totalProspects: number;
  qualifiedLeads: number;
  demosBuilt: number;
  emailDraftsReady: number;
  videosPrepared: number;
  highPriorityFollowUps: number;
  overdueTasks: number;
  repliedAccounts: number;
  proposalStage: number;
  weightedPipeline: number;
  revenueCollected: number;
  liveActivityCount: number;
  avgScore: number;
  bookedRate: number;
}

export interface DashboardSuggestion {
  id: string;
  title: string;
  body: string;
  tone: "info" | "positive" | "warning";
}

export interface DashboardStateResponse {
  version: number;
  generatedAt: string;
  owner: string;
  brand: string;
  metrics: DashboardMetrics;
  clients: Array<{
    clientId: string;
    businessName: string;
    area: string;
    businessType: string;
    accountStatus: string;
    priority: string;
    siteScore: number | null;
  }>;
  sync: {
    databasePath: string;
    emailConnectorReady: boolean;
    callConnectorReady: boolean;
    stripeConnectorReady: boolean;
  };
  suggestions: DashboardSuggestion[];
}

export interface MetricsResponse {
  weightedPipeline: number;
  bookedReadiness: number;
  liveActivityCount: number;
  revenueCollected: number;
  revenuePipeline: number;
  wonDeals: number;
  averageDeal: number;
}

export interface AccountSummary {
  clientId: string;
  businessName: string;
  businessType: string;
  area: string;
  websiteUrl: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  address: string | null;
  accountStatus: string;
  priority: string;
  dueDate: string | null;
  nextActionNotes: string;
  siteScore: number;
  dealValue: number;
  closeProbability: number;
  sourceNotes: string;
  imageHero: string | null;
  imageServices: string | null;
  demoFile: string | null;
  videoFile: string | null;
  emailFile: string | null;
  createdAt: string;
  updatedAt: string;
  lastTimelineEventAt: string | null;
  health: string;
}

export interface Client360PrimaryContact {
  id: string;
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface Client360Account extends AccountSummary {
  lifecycle: string;
  contacts: Array<Client360PrimaryContact & {
    isPrimary: boolean;
    bestTime: string;
    contactPreference: string;
    notes: string;
    createdAt: string;
  }>;
  primaryContact: Client360PrimaryContact | null;
  contactCount: number;
  timelineCount: number;
  callCount: number;
  noteCount: number;
  proposalCount: number;
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  latestActivityAt: string | null;
  daysSinceLastActivity: number;
  relationshipScore: number;
  dossierCompleteness: number;
  relationshipBand: "critical" | "weak" | "workable" | "stable";
  riskFlags: string[];
  nextBestAction: string;
}

export interface Client360TimelineEvent {
  id: string;
  clientId: string;
  businessName: string;
  area: string;
  type: "timeline" | "call" | "task" | "proposal" | "note";
  channel: "crm" | "call" | "email" | "ops" | "proposal";
  label: string;
  body: string;
  at: string;
  actor: string;
  status: string;
  impact: "low" | "medium" | "high";
}

export interface Client360ChartPoint {
  label: string;
  value: number;
}

export interface Client360Response {
  generatedAt: string;
  totals: {
    totalAccounts: number;
    totalContacts: number;
    openTasks: number;
    overdueTasks: number;
    dueToday: number;
    proposalValue: number;
    weightedPipelineValue: number;
    timelineEvents: number;
    staleAccounts: number;
    missingContacts: number;
  };
  signals: {
    staleAccounts: Client360Account[];
    overdueAccounts: Client360Account[];
    hotAccounts: Client360Account[];
    incompleteDossiers: Client360Account[];
  };
  charts: {
    statusDistribution: Client360ChartPoint[];
    priorityDistribution: Client360ChartPoint[];
    lifecycleDistribution: Client360ChartPoint[];
    healthDistribution: Client360ChartPoint[];
    valueByStage: Client360ChartPoint[];
  };
  accounts: Client360Account[];
  timeline: Client360TimelineEvent[];
}

export interface MailDraftAccount extends AccountSummary {
  draftedAt: string;
  mailStatus: "Draft" | "Sent" | "Replied" | string;
  latestMailEventAt: string | null;
  latestMailNotes: string;
}

export interface MailInboxMessage {
  id: string;
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: string | null;
  read: boolean;
  starred: boolean;
  labels: string[];
  tag: "inbox" | "reply" | "outreach" | "lead" | string;
}

export interface MailStatusResponse {
  provider: "gmail";
  configured: boolean;
  connected: boolean | null;
  account: string;
  missingEnv: string[];
  draftsReady: number;
}

export interface MailInboxResponse {
  provider: "gmail";
  configured: boolean;
  connected: boolean;
  account: string;
  missingEnv: string[];
  messages: MailInboxMessage[];
  drafts: MailDraftAccount[];
  resultSizeEstimate: number;
  error: string | null;
}

export interface GmailOAuthUrlResponse {
  configured: boolean;
  missingEnv: string[];
  authUrl: string | null;
  redirectUri: string;
}

export interface AiCommandResponse {
  reply: string;
  model: string;
  usage: Record<string, unknown> | null;
  context: {
    accountsIncluded: number;
    selectedLead: string | null;
    metricsAt: string;
  };
}

export interface OpenAiVoiceStatusResponse {
  provider: "openai";
  configured: boolean;
  transport: "webrtc";
  model: string;
  voice: string;
  missingEnv: string[];
}

export interface OpenAiVoiceTranscriptionResponse {
  text: string;
  model: string;
}

export interface VoiceToolResponse {
  ok: boolean;
  action?: "navigate" | "refresh";
  route?: string;
  message?: string;
  requiresApproval?: boolean;
  suggestedRoute?: string;
  data?: unknown;
  status?: unknown;
  account?: unknown;
}

export type OperatorEventTone = "neutral" | "live" | "warning" | "danger";

export interface OperatorToolDefinition {
  id: string;
  name: string;
  description: string;
  risk: "safe" | "internal-write" | "approval-required";
  owner: string;
}

export interface OperatorAction {
  type: "navigate" | "refresh" | "approval" | "open_record";
  route?: string;
  clientId?: string;
  approvalId?: string;
  label: string;
}

export interface OperatorEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
  tone: OperatorEventTone;
  toolId?: string;
}

export interface OperatorSession {
  id: string;
  source: "voice" | "text" | "system";
  status: "completed" | "needs_approval" | "failed";
  message: string;
  route: string;
  startedAt: string;
  finishedAt: string;
  reply: string;
  events: OperatorEvent[];
  actions: OperatorAction[];
}

export interface OperatorApproval {
  id: string;
  status: "pending" | "approved" | "rejected";
  toolId: string;
  toolName: string;
  agent: "JARVIS";
  what: string;
  why: string;
  estimatedImpact: string;
  args: Record<string, unknown>;
  sessionId: string;
  requestedAt: string;
  resolvedAt: string | null;
}

export interface OperatorStatusResponse {
  generatedAt: string;
  runtime: {
    id: string;
    name: string;
    mode: "local-first";
    description: string;
  };
  tools: OperatorToolDefinition[];
  guardrails: string[];
  sessions: OperatorSession[];
  approvals: OperatorApproval[];
}

export interface OperatorCommandResponse {
  session: OperatorSession;
  reply: string;
  actions: OperatorAction[];
  approvals: OperatorApproval[];
}

export interface OperatorSessionsResponse {
  sessions: OperatorSession[];
}

export interface OperatorApprovalsResponse {
  approvals: OperatorApproval[];
}

export type ToolForgeStatus = "live" | "partial" | "build-next" | "needs-adapter" | "planned";
export type ToolForgeCategory =
  | "acquisition"
  | "outreach"
  | "delivery"
  | "client"
  | "voice"
  | "finance"
  | "personal"
  | "ops";

export interface ToolForgeItem {
  id: string;
  name: string;
  category: ToolForgeCategory;
  status: ToolForgeStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  ownerAgent: "JARVIS" | "OPS" | "LEADGEN" | "OUTREACH" | "BUILDER" | "CONTENT" | "FINANCE" | "SUPPORT" | "HAMID";
  ownedCore: string;
  replaces: string[];
  moneyFunction: string;
  currentCapability: string;
  nextBuild: string;
  routes: string[];
  externalAdapters: string[];
  approvalRequired: boolean;
  risk: "low" | "medium" | "high";
  estimatedValue: string;
}

export interface ToolForgePattern {
  name: string;
  source: string;
  pattern: string;
  localVersion: string;
}

export interface ToolForgeResponse {
  generatedAt: string;
  thesis: string;
  summary: {
    total: number;
    live: number;
    partial: number;
    buildNext: number;
    needsAdapter: number;
    planned: number;
    approvalGated: number;
    revenueLoopCoveragePct: number;
    operatorToolCount: number;
    pendingApprovals: number;
  };
  buildPrinciples: string[];
  categories: Array<{
    id: ToolForgeCategory;
    label: string;
    mission: string;
    liveOrPartial: number;
    total: number;
  }>;
  tools: ToolForgeItem[];
  buildQueue: ToolForgeItem[];
  patterns: ToolForgePattern[];
}

export interface ReplyRadarResponse {
  generatedAt: string;
  provider: "gmail";
  configured: boolean;
  connected: boolean;
  account: string;
  error: string | null;
  resultSizeEstimate: number;
  summary: {
    inboxRead: number;
    linkedReplies: number;
    hotReplies: number;
    objections: number;
    actionsDue: number;
    unmatched: number;
  };
  gaps: string[];
  messages: Array<{
    id: string;
    threadId: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    preview: string;
    receivedAt: string | null;
    read: boolean;
    sentiment: "hot" | "warm" | "objection" | "admin" | "unknown";
    urgency: "now" | "today" | "this-week" | "monitor";
    evidence: string[];
    linkedClient: {clientId: string; businessName: string; route: string; confidence: number} | null;
    suggestedAction: {label: string; reason: string; taskTitle: string; priority: "high" | "medium" | "low"};
  }>;
}

export interface ReplyRadarSyncResponse {
  syncedAt: string;
  synced: Array<{clientId: string; messageId: string; businessName: string; sentiment: string}>;
  radar: ReplyRadarResponse;
}

export interface OwnedVoiceAgentResponse {
  generatedAt: string;
  profile: {
    id: "owned-voice-agent";
    name: string;
    tone: string;
    operatingRules: string[];
    tools: Array<{name: string; purpose: string; approvalRequired: boolean}>;
    connectedSystems: string[];
  };
  recentCalls: Record<string, unknown>;
}

export interface OwnedVoiceAgentTurnResponse {
  generatedAt: string;
  intent: "booking" | "pricing" | "project_status" | "support" | "sales" | "unknown";
  confidence: number;
  reply: string;
  matchedClient: {clientId: string; businessName: string; route: string; reason: string} | null;
  actions: Array<{type: string; label: string; detail: string; approvalRequired: boolean}>;
  profile: OwnedVoiceAgentResponse["profile"];
}

export interface DealRoomResponse {
  generatedAt: string;
  roomId: string;
  client: {
    clientId: string;
    businessName: string;
    businessType: string;
    area: string;
    status: string;
    route: string;
    websiteUrl: string | null;
  };
  readinessScore: number;
  blockers: Array<{label: string; detail: string; severity: "success" | "warning" | "danger" | "info" | "neutral"}>;
  offer: {
    packageName: string;
    setupFee: number;
    monthlyRetainer: number;
    timeline: string;
    scope: string[];
    proofAngle: string;
    paymentStatus: "ready" | "needs-stripe" | "needs-proposal";
  };
  proof: Array<{label: string; detail: string; source: string}>;
  assets: Array<{label: string; status: "ready" | "missing"; route: string; detail: string}>;
  closePlan: Array<{step: string; owner: string; outcome: string}>;
  proposals: Array<{
    id: string;
    packageName: string;
    services: string;
    setupFee: number;
    monthlyRetainer: number | null;
    status: string;
    closeProbability: number;
    notes: string;
    updatedAt: string;
  }>;
}

export interface DealRoomGenerateResponse {
  generatedAt: string;
  proposal: Record<string, unknown>;
  dealRoom: DealRoomResponse;
}

export interface FinanceGuardResponse {
  generatedAt: string;
  summary: {
    stripeConfigured: boolean;
    stripeConnected: boolean;
    mode: "live" | "test" | "unconfigured";
    availableBalance: number;
    pendingBalance: number;
    recentCollected: number;
    recentChargeCount: number;
    weightedPipeline: number;
    revenueCollected: number;
    openRevenueAtRisk: number;
  };
  alerts: Array<{id: string; tone: "success" | "warning" | "danger" | "info" | "neutral"; title: string; detail: string; route: string}>;
  guardrails: Array<{area: string; dailyCap: number; approvalRequiredAbove: number; currentKnownSpend: number | null; status: "active" | "needs-ledger"}>;
  reconciliation: Array<{label: string; source: string; status: "connected" | "blocked" | "needs-setup"; detail: string}>;
}

export interface WarRoomResponse {
  generatedAt: string;
  irreplaceabilityScore: number;
  doctrine: string[];
  operatingLoops: Array<{
    id: string;
    label: string;
    score: number;
    status: "strong" | "watch" | "blocked";
    currentTruth: string;
    nextMove: string;
    route: string;
  }>;
  decisions: Array<{
    label: string;
    why: string;
    impact: "high" | "medium" | "low";
    owner: string;
    route: string;
  }>;
  commandRisks: Array<{
    label: string;
    severity: "success" | "warning" | "danger" | "info" | "neutral";
    diagnostic: string;
    counterMove: string;
  }>;
}

export interface OpportunityEngineResponse {
  generatedAt: string;
  summary: {
    ranked: number;
    readyToClose: number;
    needsResearch: number;
    totalPotential: number;
    topAction: string;
  };
  lanes: Array<{
    id: "close" | "prove" | "research" | "nurture";
    label: string;
    count: number;
    value: number;
    route: string;
    brief: string;
  }>;
  opportunities: Array<{
    clientId: string;
    businessName: string;
    area: string;
    businessType: string;
    route: string;
    rank: number;
    score: number;
    dealValue: number;
    closeProbability: number;
    status: string;
    lane: "close" | "prove" | "research" | "nurture";
    reason: string;
    nextMove: string;
    proof: string[];
    blockers: Array<{label: string; severity: "success" | "warning" | "danger" | "info" | "neutral"}>;
    owner: "JARVIS" | "OPS" | "LEADGEN" | "OUTREACH" | "BUILDER";
  }>;
}

export interface RevenueRadarResponse {
  generatedAt: string;
  score: number;
  thesis: string;
  moneyToday: {
    pipeline: number;
    readyToClose: number;
    researchBacklog: number;
    proofBacklog: number;
    approvals: number;
    nextRun: string;
  };
  internetAccess: Array<{
    provider: string;
    label: string;
    status: "live" | "ready" | "blocked" | "approval-gated";
    job: string;
    guardrail: string;
    route: string;
  }>;
  moneyLoops: Array<{
    stage: string;
    owner: "JARVIS" | "OPS" | "LEADGEN" | "OUTREACH" | "BUILDER" | "FINANCE";
    status: "live" | "blocked" | "approval-gated";
    output: string;
    route: string;
  }>;
  niches: Array<{
    id: string;
    label: string;
    query: string;
    location: string;
    score: number;
    reason: string;
    offer: string;
    route: string;
  }>;
  opportunities: Array<{
    clientId: string;
    businessName: string;
    area: string;
    businessType: string;
    websiteUrl: string | null;
    score: number;
    moneyScore: number;
    dealValue: number;
    closeProbability: number;
    status: string;
    owner: "JARVIS" | "OPS" | "LEADGEN" | "OUTREACH" | "BUILDER" | "FINANCE";
    gaps: string[];
    nextAction: string;
    route: string;
    dossierRoute: string;
  }>;
  nextActions: Array<{
    label: string;
    owner: "JARVIS" | "OPS" | "LEADGEN" | "OUTREACH" | "BUILDER" | "FINANCE";
    priority: "high" | "medium" | "low";
    reason: string;
    route: string;
  }>;
}

export interface RevenueRadarScanResponse {
  generatedAt: string;
  runId: string;
  query: string;
  location: string;
  searched: number;
  created: number;
  existing: number;
  skipped: number;
  results: Array<{
    businessName: string;
    url: string | null;
    score: number;
    clientId: string | null;
    status: "created" | "existing" | "skipped";
    reason: string;
  }>;
  radar: RevenueRadarResponse;
}

export interface LeadEvidenceDossierResponse {
  generatedAt: string;
  client: {
    clientId: string;
    businessName: string;
    businessType: string;
    area: string;
    status: string;
    route: string;
    websiteUrl: string | null;
    address: string | null;
  };
  scorecard: {
    dossierScore: number;
    proofScore: number;
    contactScore: number;
    commercialScore: number;
    urgencyScore: number;
    band: "ready-to-sell" | "needs-proof" | "needs-contact" | "raw-lead";
  };
  facts: Array<{label: string; value: string; tone: "success" | "warning" | "danger" | "info" | "neutral"}>;
  proof: Array<{label: string; detail: string; source: string; route: string | null}>;
  conversionGaps: Array<{label: string; evidence: string; severity: "success" | "warning" | "danger" | "info" | "neutral"; fix: string}>;
  outreachAngles: Array<{subject: string; opener: string; offer: string; evidence: string}>;
  demoBlueprint: {
    heroAngle: string;
    sections: Array<{name: string; purpose: string; proof: string}>;
    automations: Array<{name: string; value: string; trigger: string}>;
  };
  nextActions: Array<{
    label: string;
    owner: "JARVIS" | "OPS" | "LEADGEN" | "OUTREACH" | "BUILDER";
    route: string;
    priority: "high" | "medium" | "low";
    reason: string;
  }>;
  sourceHealth: Array<{label: string; status: "strong" | "thin" | "missing"; detail: string}>;
}

export interface ProofVaultResponse {
  generatedAt: string;
  summary: {
    clientsWithAudits: number;
    clientsWithProof: number;
    readyForDemo: number;
    evidenceItems: number;
  };
  proofLeaders: Array<{
    clientId: string;
    businessName: string;
    area: string;
    businessType: string;
    proofScore: number;
    route: string;
    strongestProof: string;
    missingProof: string[];
  }>;
  evidenceStreams: Array<{
    label: string;
    count: number;
    quality: "strong" | "thin" | "missing";
    nextMove: string;
  }>;
}

export interface DesignLabResponse {
  generatedAt: string;
  philosophy: string;
  principles: Array<{
    name: string;
    source: string;
    translation: string;
    rule: string;
  }>;
  qualityGates: Array<{
    area: string;
    passCondition: string;
    failureSignal: string;
  }>;
  interfaceModes: Array<{
    mode: string;
    job: string;
    mustShow: string[];
    mustNeverDo: string[];
  }>;
}

export interface MarketQuotePoint {
  time: string;
  value: number | null;
}

export interface MarketQuote {
  symbol: string;
  label: string;
  market: "stock" | "crypto" | "fx" | "index";
  note: string;
  status: "live" | "error";
  source: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  exchangeName: string | null;
  regularMarketTime: number | null;
  points: MarketQuotePoint[];
  fetchedAt: string;
  error: string | null;
}

export interface MarketWatchlistResponse {
  generatedAt: string;
  ttlSeconds: number;
  quotes: MarketQuote[];
}

export interface IntegrationConnector {
  provider: string;
  label: string;
  connected: boolean;
  status: "connected" | "not_configured" | "error";
  enables: string;
  missingEnv: string[];
  setupUrl: string;
  syncedAt: string | null;
  summary: Record<string, unknown>;
  error: string | null;
}

export interface IntegrationsStatusResponse {
  generatedAt: string;
  connectors: IntegrationConnector[];
  snapshots: Array<{
    provider: string;
    status: string;
    summary: Record<string, unknown>;
    error: string | null;
    syncedAt: string;
  }>;
}

export interface IntegrationsSyncResponse {
  generatedAt: string;
  results: Array<{
    provider: string;
    status: "connected" | "not_configured" | "error";
    summary: Record<string, unknown>;
    data: unknown;
    error: string | null;
    syncedAt: string;
  }>;
  status: IntegrationsStatusResponse;
}

export interface CreateAccountRequest {
  businessName: string;
  businessType: string;
  area: string;
  websiteUrl?: string | null;
  phoneNumber?: string | null;
  emailAddress?: string | null;
  address?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  accountStatus?: string;
  priority?: string;
  dueDate?: string | null;
  nextActionNotes?: string;
  dealValue?: number;
  siteScore?: number;
  sourceNotes?: string;
}

export interface LeadSearchStatus {
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  message: string;
  output: string[];
}

export interface LeadPipelineItem extends AccountSummary {}

export interface LeadDetail {
  lead: {
    clientId: string;
    businessName: string;
    businessType: string;
    area: string;
    websiteUrl: string | null;
    phoneNumber: string | null;
    emailAddress: string | null;
    googleRating: number | null;
    reviewCount: number | null;
    address: string | null;
    accountStatus: string;
    priority: string;
    dueDate: string | null;
    nextActionNotes: string;
    siteScore: number;
    dealValue: number;
    closeProbability: number;
    sourceNotes: string;
    imageHero: string | null;
    imageServices: string | null;
    demoFile: string | null;
    videoFile: string | null;
    emailFile: string | null;
    createdAt: string;
    updatedAt: string;
  };
  auditScores: Array<{
    criterion: string;
    score: number;
    note: string;
    updatedAt: string;
  }>;
  auditAnalysis: {
    strengths: string[];
    weaknesses: string[];
    topProblems: string[];
    recommendedActions: string;
  };
  contacts: Array<{
    id: string;
    fullName: string;
    role: string;
    email: string | null;
    phone: string | null;
    linkedIn: string | null;
    isPrimary: boolean;
    notes: string;
    status: string;
    bestTime: string;
    contactPreference: string;
    createdAt: string;
  }>;
  timeline: Array<{
    id: string;
    eventType: string;
    timestamp: string;
    contactName: string | null;
    notes: string;
    duration: number | null;
    followUpDate: string | null;
    loggedBy: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    taskType: string;
    assignedTo: string;
    dueDate: string;
    priority: string;
    notes: string;
    status: string;
    completedAt: string | null;
    createdAt: string;
  }>;
  proposals: Array<{
    id: string;
    packageName: string;
    services: string;
    setupFee: number;
    monthlyRetainer: number | null;
    contractLength: string;
    estimatedDelivery: string;
    status: string;
    sentDate: string | null;
    responseDate: string | null;
    closeProbability: number;
    notes: string;
    createdAt: string;
    updatedAt: string;
  }>;
  memory: {
    personality: string;
    painPoints: string;
    whatResonates: string;
    whatToAvoid: string;
    decisionProcess: string;
    bestWindow: string;
    conversationHighlights: Array<{date: string; note: string}>;
    objections: Array<{objection: string; handled: string}>;
    internalNotes: string;
    updatedAt: string;
  } | null;
  notes: Array<{
    id: string;
    body: string;
    pinnedAt: string | null;
    createdAt: string;
  }>;
  calls: Array<{
    id: string;
    calledAt: string;
    outcome: string;
    durationMinutes: number | null;
    contactName: string | null;
    notes: string;
    followUpDate: string | null;
    createdAt: string;
  }>;
  browserAudits: Array<{
    id: string;
    websiteUrl: string;
    summary: string;
    flaws: string[];
    opportunities: string[];
    plan: string[];
    scores: Record<string, number>;
    evidence: {
      title?: string;
      finalUrl?: string;
      screenshotPath?: string;
      loadMs?: number;
      consoleErrors?: string[];
      failedRequests?: Array<{url: string; error: string}>;
      headings?: string[];
      buttons?: string[];
      links?: Array<{text: string; href: string}>;
      forms?: number;
      metaDescription?: string;
      emails?: string[];
      phones?: string[];
      pagesVisited?: Array<{url: string; title: string; textSample: string}>;
    };
    screenshotPath: string | null;
    createdAt: string;
  }>;
}

export interface AssetTextResponse {
  content: string;
  href: string;
}

export interface PipelineSnapshotResponse {
  rawLeads: unknown[];
  qualifiedLeads: unknown[];
  crmSnapshot: Record<string, unknown>;
  files: {
    leadsRaw: string;
    leadsQualified: string;
    crmJson: string;
  };
}

export interface OpenClawAgent {
  id: string;
  name: string;
  role: string;
  workspace: string | null;
  agentDir: string | null;
  primaryModel: string | null;
  fallbackModels: string[];
  status: "idle" | "thinking" | "running-tool" | "error";
  lastActivityAt: string | null;
  description: string;
}

export interface OpenClawSessionSummary {
  id: string;
  sessionKey: string;
  agentId: string;
  agentName: string;
  channel: string;
  startedAt: string | null;
  lastActivityAt: string | null;
  status: string;
  messageCount: number;
  lastMessage: string;
}

export interface OpenClawSessionDetail {
  id: string;
  sessionKey: string;
  agentId: string;
  channel: string;
  startedAt: string | null;
  lastActivityAt: string | null;
  status: string;
  messages: Array<{
    id: string;
    role: string;
    at: string | null;
    text: string;
  }>;
  tools: Array<{
    id: string;
    at: string | null;
    name: string;
    outcome: "success" | "error" | "info";
    summary: string;
  }>;
}

export interface OpenClawAgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  primaryModel: string | null;
  fallbackModels: string[];
  identityFilePath: string | null;
  identityText: string;
  tools: string[];
  skills: Array<{
    name: string;
    description: string;
    enabled: boolean;
    target: string | null;
  }>;
}

export interface OpenClawMemorySection {
  title: string;
  path: string;
  body: string;
}

export interface OpenClawActivityEvent {
  id: string;
  at: string;
  agentId: string | null;
  sessionKey: string | null;
  type: "message" | "tool_call" | "error" | "system" | "approval" | "webhook";
  title: string;
  detail: string;
  impact: string;
}

export interface OpenClawSystemStats {
  cpuLoad: number;
  memoryUsedPct: number;
  diskUsedPct: number;
  temperatureC: number | null;
  status: "Nominal" | "Elevated" | "Critical";
  history: {
    cpuLoad: number[];
    memoryUsedPct: number[];
    diskUsedPct: number[];
  };
}

export interface OpenClawApprovalsSnapshot {
  policyPath: string;
  pending: Array<{
    id: string;
    agentId: string | null;
    command: string;
    rationale: string;
    estimatedImpact: string;
    requestedAt: string;
  }>;
  policyRaw: string | null;
}

export interface OpenClawSendResponse {
  sessionKey: string;
  runId: string | null;
  status: string;
  replyText: string;
}

export interface FirecrawlReviewSource {
  label: string;
  source: "google" | "trustpilot" | "facebook" | "yell" | "tripadvisor" | "other";
  url: string;
  snippet: string;
}

export interface FirecrawlBusinessRecord {
  name: string;
  url: string | null;
  domain: string | null;
  description: string;
  location: string | null;
  trustSignals: string[];
  reviewSources: FirecrawlReviewSource[];
  contactSignals: {
    emailHints: string[];
    phoneHints: string[];
  };
  sourceTitle: string;
  sourceSnippet: string;
}

export interface FirecrawlBusinessSearchReport {
  query: string;
  location: string;
  operatorBrief: {
    headline: string;
    marketView: string;
    recommendation: string;
    reviewCoverage: string;
  };
  businesses: FirecrawlBusinessRecord[];
}

export interface FirecrawlScrapeResponse {
  url: string;
  domain: string | null;
  title: string;
  metadata: Record<string, unknown>;
  text: string;
  markdown: string;
  analysis: {
    headline: string;
    designRead: string;
    trustRead: string;
    conversionRead: string;
    contentRead: string;
    recommendedActions: string[];
    extracted: {
      headings: string[];
      callsToAction: string[];
      emails: string[];
      phones: string[];
      reviewMentions: string[];
      trustSignals: string[];
    };
  };
}

export interface ApifyStatusResponse {
  configured: boolean;
  baseUrl: string;
  missingEnv: string[];
}

export interface ApifyActorSummary {
  id: string;
  name: string;
  title: string;
  username: string | null;
  description: string;
  url: string;
  categories: string[];
}

export interface ApifyActorsResponse {
  status: ApifyStatusResponse;
  actors: ApifyActorSummary[];
  error?: string;
}

export interface ApifyRunResponse {
  run: {
    id: string;
    actId?: string;
    status: string;
    startedAt?: string;
    finishedAt?: string;
    defaultDatasetId?: string;
    buildId?: string;
  };
  datasetItems: Array<Record<string, unknown>>;
}

export interface KieModelDefinition {
  id: string;
  name: string;
  provider: string;
  kind: "image" | "video";
  endpointType: "jobs" | "gpt4o-image" | "flux-kontext";
  supports: Array<"text-to-image" | "image-edit" | "text-to-video" | "image-to-video">;
  description: string;
  defaultAspectRatio: string;
  docsUrl: string;
  supportsDirectGeneration: boolean;
  inputHints: string[];
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "select";
    helper: string;
    required?: boolean;
    options?: string[];
  }>;
}

export interface KieModelsResponse {
  models: KieModelDefinition[];
}

export interface KieImageGenerationResponse {
  imageUrl: string;
  title: string;
  subtitle: string;
  savedPath: string;
  sourceUrl: string | null;
  modelId: string;
  taskId: string | null;
  live: boolean;
}

export interface KieVideoGenerationResponse {
  videoUrl: string;
  savedPath: string;
  sourceUrl: string | null;
  modelId: string;
  taskId: string | null;
  live: boolean;
}
