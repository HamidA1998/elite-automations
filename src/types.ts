export type BusinessType = string;

export type Lead = {
  id: string;
  businessName: string;
  businessType: BusinessType;
  area: string;
  websiteUrl: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  address: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDescription: string | null;
};

export type AuditCategory =
  | "designQuality"
  | "mobileResponsiveness"
  | "pageSpeed"
  | "clearHeadline"
  | "callToAction"
  | "contactVisibility"
  | "trustSignals"
  | "seoBasics"
  | "contentQuality"
  | "googleReviewsOnWebsite";

export type LeadAudit = {
  leadId: string;
  websiteUrl: string | null;
  scores: Record<AuditCategory, number>;
  totalScore: number;
  topProblems: string[];
  notes: string[];
  scrapeMarkdown: string | null;
  scrapeHtml: string | null;
  metadata: Record<string, unknown>;
};

export type QualifiedLead = Lead & {
  audit: LeadAudit;
  imageAssets: {
    hero: string;
    services: string;
  };
  demoFile: string;
  videoFile: string;
  emailFile: string;
};

export type OutreachStatus = "prepared" | "queued" | "sent" | "delivered" | "replied" | "booked" | "won" | "lost";

export type OutreachActivityType = "audit" | "demo" | "video" | "email" | "cold-call" | "follow-up" | "note";

export type OutreachActivity = {
  id: string;
  type: OutreachActivityType;
  status: OutreachStatus;
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
};

export type ClientFollowUp = {
  priority: "high" | "medium" | "low";
  nextStep: string;
  dueDate: string;
};

export type ClientRecord = QualifiedLead & {
  clientId: string;
  accountStatus: "researched" | "ready-to-send" | "contacted" | "in-follow-up" | "replied" | "proposal" | "won" | "lost";
  strengths: string[];
  weaknesses: string[];
  recommendedActions: string[];
  outreachActivities: OutreachActivity[];
  followUp: ClientFollowUp;
  artifacts: {
    demoFile: string;
    emailFile: string;
    videoFile: string;
    heroImage: string;
    servicesImage: string;
  };
  contactSummary: string;
  contacts: ClientContact[];
  tasks: ClientTask[];
  memories: ClientMemory[];
  proposals: ClientProposal[];
  comments: ClientComment[];
  assets: ClientAsset[];
  owner: string;
  lastContactedAt: string | null;
  closeProbability: number;
  valueEstimate: number;
  healthBand: "critical" | "weak" | "workable" | "stable";
  objections: string[];
  enrichment: Record<string, unknown>;
  aiSummary: {
    headline: string;
    nextBestAction: string;
    risk: string;
    talkingPoint: string;
    momentum: string;
  };
};

export type ClientContact = {
  id: string;
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  isPrimary: boolean;
  notes: string;
  status: "reachable" | "needs-research" | "decision-maker" | "gatekeeper";
};

export type ClientTask = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "done" | "blocked";
  priority: "high" | "medium" | "low";
  dueDate: string;
  owner: string;
  lane: string;
  createdAt: string;
};

export type ClientMemory = {
  id: string;
  clientId: string | null;
  kind: "context" | "objection" | "playbook" | "follow-up" | "intel";
  title: string;
  note: string;
  tags: string[];
  source: "manual" | "pipeline" | "ai";
  createdAt: string;
  updatedAt: string;
};

export type ClientProposal = {
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
};

export type ClientComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  type: "note" | "system" | "decision";
};

export type ClientAsset = {
  id: string;
  assetType: "demo" | "email" | "image" | "video";
  label: string;
  filePath: string;
  version: number;
  status: "draft" | "ready" | "sent" | "planned";
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type DashboardMetrics = {
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
  stripe?: StripeSummary;
};

export type StripePaymentRecord = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customerName: string | null;
  description: string | null;
  receiptUrl: string | null;
  createdAt: string;
};

export type StripeSummary = {
  configured: boolean;
  connected: boolean;
  mode: "live" | "test" | "unconfigured";
  keyType: "restricted" | "secret" | "none";
  publishableKeyConfigured: boolean;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  recentCollected: number;
  recentChargeCount: number;
  successfulChargeCount: number;
  recentPayments: StripePaymentRecord[];
  lastSyncedAt: string | null;
  error: string | null;
};

export type DashboardSuggestion = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "positive";
};

export type DashboardAppState = {
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
  suggestions: DashboardSuggestion[];
};

export type DashboardData = {
  generatedAt: string;
  owner: string;
  brand: string;
  metrics: DashboardMetrics;
  clients: ClientRecord[];
};

export type SearchHit = {
  title?: string;
  description?: string;
  url?: string;
  markdown?: string;
  html?: string;
  metadata?: Record<string, unknown>;
};

export type FirecrawlScrapeResult = {
  markdown: string | null;
  html: string | null;
  metadata: Record<string, unknown>;
};
