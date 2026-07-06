// ── Core CRM types (mirror backend) ────────────────────────────

export type AccountStatus =
  | "researched" | "ready-to-send" | "contacted"
  | "in-follow-up" | "replied" | "proposal" | "won" | "lost";

export type Priority = "high" | "medium" | "low";
export type HealthBand = "critical" | "weak" | "workable" | "stable";

export interface AuditScores {
  designQuality: number;
  mobileResponsiveness: number;
  pageSpeed: number;
  clearHeadline: number;
  callToAction: number;
  contactVisibility: number;
  trustSignals: number;
  seoBasics: number;
  contentQuality: number;
  googleReviewsOnWebsite: number;
}

export interface LeadAudit {
  leadId: string;
  websiteUrl: string | null;
  scores: AuditScores;
  totalScore: number;
  topProblems: string[];
  notes: string[];
  scrapeMarkdown: string | null;
  scrapeHtml: string | null;
  metadata: Record<string, unknown>;
}

export interface ClientContact {
  id: string;
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  isPrimary: boolean;
  notes: string;
  status: "reachable" | "needs-research" | "decision-maker" | "gatekeeper";
}

export interface ClientTask {
  id: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "done" | "blocked";
  priority: Priority;
  dueDate: string;
  owner: string;
  lane: string;
  createdAt: string;
}

export interface ClientMemory {
  id: string;
  clientId: string | null;
  kind: "context" | "objection" | "playbook" | "follow-up" | "intel";
  title: string;
  note: string;
  tags: string[];
  source: "manual" | "pipeline" | "ai";
  createdAt: string;
  updatedAt: string;
}

export interface ClientProposal {
  id: string;
  title: string;
  status: "draft" | "sent" | "negotiating" | "accepted" | "lost";
  packageName: string;
  price: number;
  probability: number;
  nextStep: string;
  scope: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  type: "note" | "system" | "decision";
}

export interface OutreachActivity {
  id: string;
  type: "audit" | "demo" | "video" | "email" | "cold-call" | "follow-up" | "note";
  status: "prepared" | "queued" | "sent" | "delivered" | "replied" | "booked" | "won" | "lost";
  title: string;
  summary: string;
  owner: string;
  createdAt: string;
  scheduledFor: string | null;
  completedAt: string | null;
  linkedFiles: string[];
  linkedChannels: string[];
  eventSource?: "manual" | "pipeline" | "email" | "call" | "ai";
  metadata?: Record<string, unknown>;
}

export interface ClientRecord {
  id: string;
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
  sourceUrl: string | null;
  audit: LeadAudit;
  imageAssets: { hero: string; services: string };
  demoFile: string;
  videoFile: string;
  emailFile: string;
  accountStatus: AccountStatus;
  strengths: string[];
  weaknesses: string[];
  recommendedActions: string[];
  outreachActivities: OutreachActivity[];
  followUp: { priority: Priority; nextStep: string; dueDate: string };
  contacts: ClientContact[];
  tasks: ClientTask[];
  memories: ClientMemory[];
  proposals: ClientProposal[];
  comments: ClientComment[];
  owner: string;
  lastContactedAt: string | null;
  closeProbability: number;
  valueEstimate: number;
  healthBand: HealthBand;
  objections: string[];
  aiSummary: {
    headline: string;
    nextBestAction: string;
    risk: string;
    talkingPoint: string;
    momentum: string;
  };
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
  liveActivityCount: number;
  avgScore: number;
  bookedRate: number;
}

export interface DashboardAppState {
  version: number;
  generatedAt: string;
  owner: string;
  brand: string;
  metrics: DashboardMetrics;
  clients: ClientRecord[];
  globalMemories: ClientMemory[];
  sync: {
    databasePath: string;
    lastPipelineSync: unknown;
    emailConnectorReady: boolean;
    callConnectorReady: boolean;
    stripeConnectorReady: boolean;
  };
  suggestions: Array<{ id: string; title: string; body: string; tone: "info" | "warning" | "positive" }>;
}

// ── Schedule types ──────────────────────────────────────────────

export interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  date: string;
  priority: Priority;
  category: "Outreach" | "Build" | "Research" | "Personal" | "Family";
  completed: boolean;
  createdAt: string;
}

// ── OpenClaw / Agent types ──────────────────────────────────────

export type AgentStatus = "idle" | "thinking" | "running-tool" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  fallbackModel?: string;
  status: AgentStatus;
  lastActivity: string | null;
  tools: string[];
}

export interface AgentSession {
  id: string;
  agentId: string;
  agentName: string;
  channel: string;
  startedAt: string;
  lastActivity: string;
  status: "active" | "idle" | "closed";
  messageCount: number;
  messages: SessionMessage[];
}

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: string;
  toolName?: string;
  toolResult?: string;
  bookmarked?: boolean;
}

export interface LiveEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  type: "message" | "tool_call" | "error" | "system" | "webhook";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SystemStats {
  cpu: number;
  ram: number;
  ramUsed: number;
  ramTotal: number;
  disk: number;
  diskUsed: number;
  diskTotal: number;
  uptime: number;
  history: Array<{ ts: number; cpu: number; ram: number }>;
}

// ── Time theme ──────────────────────────────────────────────────

export type TimeTheme = "dawn" | "day" | "dusk" | "night";
