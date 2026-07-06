import type {DashboardAppState, StripeSummary} from "@/types";

export type OwnedToolTone = "success" | "warning" | "danger" | "info" | "neutral";

export type OwnedMailMessage = {
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
  tag: string;
};

export type OwnedAccount = {
  clientId: string;
  businessName: string;
  businessType: string;
  area: string;
  websiteUrl: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  address?: string | null;
  sourceNotes?: string;
  accountStatus: string;
  priority: string;
  siteScore: number;
  dealValue: number;
  closeProbability: number;
  nextActionNotes: string;
  lastTimelineEventAt: string | null;
};

export type OwnedContact = {
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export type OwnedTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
};

export type OwnedProposal = {
  id: string;
  packageName: string;
  services: string;
  setupFee: number;
  monthlyRetainer: number | null;
  status: string;
  closeProbability: number;
  notes: string;
  updatedAt: string;
};

export type OwnedTimeline = {
  id: string;
  eventType: string;
  timestamp: string;
  notes: string;
  loggedBy: string;
};

export type OwnedBrowserAudit = {
  id: string;
  websiteUrl?: string;
  summary: string;
  flaws: string[];
  opportunities: string[];
  plan: string[];
  scores?: Record<string, number>;
  evidence?: {
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
};

export type OwnedClientMemory = {
  painPoints: string;
  whatResonates: string;
  decisionProcess: string;
  conversationHighlights: Array<{date: string; note: string}>;
  objections: Array<{objection: string; handled: string}>;
  internalNotes: string;
} | null;

export type OwnedAccountContext = {
  account: OwnedAccount;
  contacts: OwnedContact[];
  tasks: OwnedTask[];
  proposals: OwnedProposal[];
  timeline: OwnedTimeline[];
  browserAudits: OwnedBrowserAudit[];
  memory: OwnedClientMemory;
};

export type ReplyRadarSentiment = "hot" | "warm" | "objection" | "admin" | "unknown";
export type ReplyRadarUrgency = "now" | "today" | "this-week" | "monitor";

export type ReplyRadarItem = {
  id: string;
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: string | null;
  read: boolean;
  sentiment: ReplyRadarSentiment;
  urgency: ReplyRadarUrgency;
  evidence: string[];
  linkedClient: {
    clientId: string;
    businessName: string;
    route: string;
    confidence: number;
  } | null;
  suggestedAction: {
    label: string;
    reason: string;
    taskTitle: string;
    priority: "high" | "medium" | "low";
  };
};

export type ReplyRadarPayload = {
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
  messages: ReplyRadarItem[];
};

export type OwnedVoiceAgentProfile = {
  id: "owned-voice-agent";
  name: "Owned Voice Agent";
  tone: string;
  operatingRules: string[];
  tools: Array<{name: string; purpose: string; approvalRequired: boolean}>;
  connectedSystems: string[];
};

export type OwnedVoiceAgentTurn = {
  generatedAt: string;
  intent: "booking" | "pricing" | "project_status" | "support" | "sales" | "unknown";
  confidence: number;
  reply: string;
  matchedClient: {
    clientId: string;
    businessName: string;
    route: string;
    reason: string;
  } | null;
  actions: Array<{
    type: "create_task" | "write_memory" | "open_client" | "handoff";
    label: string;
    detail: string;
    approvalRequired: boolean;
  }>;
};

export type DealRoomPayload = {
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
  blockers: Array<{label: string; detail: string; severity: OwnedToolTone}>;
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
  proposals: OwnedProposal[];
};

export type FinanceGuardPayload = {
  generatedAt: string;
  summary: {
    stripeConfigured: boolean;
    stripeConnected: boolean;
    mode: StripeSummary["mode"];
    availableBalance: number;
    pendingBalance: number;
    recentCollected: number;
    recentChargeCount: number;
    weightedPipeline: number;
    revenueCollected: number;
    openRevenueAtRisk: number;
  };
  alerts: Array<{
    id: string;
    tone: OwnedToolTone;
    title: string;
    detail: string;
    route: string;
  }>;
  guardrails: Array<{
    area: string;
    dailyCap: number;
    approvalRequiredAbove: number;
    currentKnownSpend: number | null;
    status: "active" | "needs-ledger";
  }>;
  reconciliation: Array<{
    label: string;
    source: string;
    status: "connected" | "blocked" | "needs-setup";
    detail: string;
  }>;
};

export type WarRoomPayload = {
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
    severity: OwnedToolTone;
    diagnostic: string;
    counterMove: string;
  }>;
};

export type ProofVaultPayload = {
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
};

export type DesignLabPayload = {
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
};

export type OpportunityEnginePayload = {
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
    blockers: Array<{label: string; severity: OwnedToolTone}>;
    owner: "JARVIS" | "OPS" | "LEADGEN" | "OUTREACH" | "BUILDER";
  }>;
};

export type RevenueRadarPayload = {
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
};

export type LeadEvidenceDossierPayload = {
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
  facts: Array<{label: string; value: string; tone: OwnedToolTone}>;
  proof: Array<{label: string; detail: string; source: string; route: string | null}>;
  conversionGaps: Array<{label: string; evidence: string; severity: OwnedToolTone; fix: string}>;
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
};

function nowIso() {
  return new Date().toISOString();
}

function dateToTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function lower(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function emailDomain(email: string | null | undefined) {
  const [, domain] = (email ?? "").toLowerCase().split("@");
  return domain?.trim() || null;
}

function websiteDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const disposableDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "yahoo.com",
  "aol.com",
  "live.com",
]);

function classifyReply(message: OwnedMailMessage): Pick<ReplyRadarItem, "sentiment" | "urgency" | "evidence" | "suggestedAction"> {
  const text = `${message.subject} ${message.preview}`.toLowerCase();
  const evidence: string[] = [];
  const capture = (label: string, regex: RegExp) => {
    if (regex.test(text)) evidence.push(label);
  };

  capture("explicit interest", /\b(interested|sounds good|yes|go ahead|send (it|over)|book|demo|call me|let'?s talk)\b/i);
  capture("price conversation", /\b(price|cost|quote|budget|how much|retainer|invoice)\b/i);
  capture("timing objection", /\b(later|not now|next month|busy|after|already have|not interested|no thanks)\b/i);
  capture("admin/noise", /\b(unsubscribe|mailer-daemon|delivery status|auto.?reply|out of office|undeliverable)\b/i);

  if (evidence.includes("admin/noise")) {
    return {
      sentiment: "admin",
      urgency: "monitor",
      evidence,
      suggestedAction: {
        label: "Archive noise",
        reason: "This looks operational rather than a buying reply.",
        taskTitle: "Review admin reply",
        priority: "low",
      },
    };
  }

  if (evidence.includes("explicit interest") || (evidence.includes("price conversation") && /^re:/i.test(message.subject))) {
    return {
      sentiment: "hot",
      urgency: "now",
      evidence,
      suggestedAction: {
        label: "Move to booking",
        reason: "The reply shows active buying intent. Respond with a simple next step and a call/payment route.",
        taskTitle: `Reply now: ${message.subject}`,
        priority: "high",
      },
    };
  }

  if (evidence.includes("price conversation")) {
    return {
      sentiment: "warm",
      urgency: "today",
      evidence,
      suggestedAction: {
        label: "Answer with proof and price anchor",
        reason: "Pricing language means the prospect is evaluating value.",
        taskTitle: `Price reply: ${message.subject}`,
        priority: "high",
      },
    };
  }

  if (evidence.includes("timing objection")) {
    return {
      sentiment: "objection",
      urgency: "today",
      evidence,
      suggestedAction: {
        label: "Handle objection",
        reason: "The reply needs a short human response or scheduled follow-up.",
        taskTitle: `Handle objection: ${message.subject}`,
        priority: "medium",
      },
    };
  }

  return {
    sentiment: /^re:/i.test(message.subject) ? "warm" : "unknown",
    urgency: /^re:/i.test(message.subject) ? "today" : "monitor",
    evidence: evidence.length ? evidence : ["no strong buying phrase detected"],
    suggestedAction: {
      label: /^re:/i.test(message.subject) ? "Review reply" : "Monitor",
      reason: /^re:/i.test(message.subject) ? "It is a reply but the intent needs human judgement." : "No buying signal was detected.",
      taskTitle: `Review message: ${message.subject}`,
      priority: /^re:/i.test(message.subject) ? "medium" : "low",
    },
  };
}

function matchClient(message: OwnedMailMessage, contexts: OwnedAccountContext[]) {
  const fromDomain = emailDomain(message.fromEmail);
  const text = `${message.fromName} ${message.fromEmail} ${message.subject} ${message.preview}`.toLowerCase();

  const scored = contexts.map((context) => {
    const account = context.account;
    let score = 0;
    const reasons: string[] = [];
    if (account.emailAddress && lower(account.emailAddress) === lower(message.fromEmail)) {
      score += 70;
      reasons.push("account email matched");
    }
    for (const contact of context.contacts) {
      if (contact.email && lower(contact.email) === lower(message.fromEmail)) {
        score += contact.isPrimary ? 80 : 65;
        reasons.push(`${contact.isPrimary ? "primary " : ""}contact email matched`);
      }
      if (contact.fullName && text.includes(lower(contact.fullName))) {
        score += 15;
        reasons.push("contact name appeared in message");
      }
    }
    const website = websiteDomain(account.websiteUrl);
    if (fromDomain && website && !disposableDomains.has(fromDomain) && (fromDomain === website || fromDomain.endsWith(`.${website}`))) {
      score += 55;
      reasons.push("business domain matched");
    }
    if (account.businessName && text.includes(lower(account.businessName))) {
      score += 35;
      reasons.push("business name matched");
    }
    return {context, score, reasons};
  }).sort((left, right) => right.score - left.score)[0];

  if (!scored || scored.score < 30) return null;
  return {
    clientId: scored.context.account.clientId,
    businessName: scored.context.account.businessName,
    route: `/leads/${scored.context.account.clientId}`,
    confidence: clampScore(scored.score),
  };
}

export function buildReplyRadar(input: {
  provider: "gmail";
  configured: boolean;
  connected: boolean;
  account: string;
  error: string | null;
  resultSizeEstimate: number;
  messages: OwnedMailMessage[];
  contexts: OwnedAccountContext[];
}): ReplyRadarPayload {
  const items = input.messages
    .filter((message) => !message.labels.includes("SENT") && message.tag !== "outreach")
    .map((message) => {
      const classification = classifyReply(message);
      return {
        ...message,
        ...classification,
        linkedClient: matchClient(message, input.contexts),
      };
    })
    .sort((left, right) => {
      const weight: Record<ReplyRadarSentiment, number> = {hot: 5, warm: 4, objection: 3, unknown: 2, admin: 1};
      return weight[right.sentiment] - weight[left.sentiment] || dateToTime(right.receivedAt) - dateToTime(left.receivedAt);
    });

  const hotReplies = items.filter((item) => item.sentiment === "hot").length;
  const objections = items.filter((item) => item.sentiment === "objection").length;
  const linkedReplies = items.filter((item) => item.linkedClient).length;
  const actionsDue = items.filter((item) => ["hot", "warm", "objection"].includes(item.sentiment)).length;
  const unmatched = items.filter((item) => !item.linkedClient && item.sentiment !== "admin").length;
  const gaps: string[] = [];
  if (!input.configured) gaps.push("Gmail is not fully configured, so Reply Radar can only inspect local drafts.");
  if (unmatched > 0) gaps.push(`${unmatched} message${unmatched === 1 ? "" : "s"} need a client match or new lead record.`);
  if (hotReplies > 0) gaps.push(`${hotReplies} hot repl${hotReplies === 1 ? "y" : "ies"} should be handled before more acquisition.`);

  return {
    generatedAt: nowIso(),
    provider: input.provider,
    configured: input.configured,
    connected: input.connected,
    account: input.account,
    error: input.error,
    resultSizeEstimate: input.resultSizeEstimate,
    summary: {
      inboxRead: input.messages.length,
      linkedReplies,
      hotReplies,
      objections,
      actionsDue,
      unmatched,
    },
    gaps,
    messages: items,
  };
}

function detectVoiceIntent(transcript: string): OwnedVoiceAgentTurn["intent"] {
  const text = transcript.toLowerCase();
  if (/\b(book|booking|appointment|call|meeting|schedule|available)\b/.test(text)) return "booking";
  if (/\b(price|cost|quote|pay|invoice|budget|retainer)\b/.test(text)) return "pricing";
  if (/\b(status|progress|update|reference|where are we|project)\b/.test(text)) return "project_status";
  if (/\b(issue|problem|broken|help|support|not working)\b/.test(text)) return "support";
  if (/\b(website|automation|lead|demo|interested|business)\b/.test(text)) return "sales";
  return "unknown";
}

export function buildOwnedVoiceAgentProfile(input: {connectedSystems: string[]}): OwnedVoiceAgentProfile {
  return {
    id: "owned-voice-agent",
    name: "Owned Voice Agent",
    tone: "Low-energy, human, calm, British, concise. No overexcited opener. Ask one useful question at a time.",
    operatingRules: [
      "Identify the caller and match them to a client file before making claims.",
      "If the caller wants to book, capture preferred time, need, and decision-maker details.",
      "If the caller asks for project status, use stored CRM/timeline facts only.",
      "Never promise a delivery date, payment action, outbound email, or external change without approval.",
    ],
    tools: [
      {name: "client_lookup", purpose: "Find a client by phone, email, name, or reference.", approvalRequired: false},
      {name: "write_memory", purpose: "Store call highlights, objections, and useful sales context.", approvalRequired: false},
      {name: "create_follow_up", purpose: "Create internal tasks for Hamid or an agent.", approvalRequired: false},
      {name: "send_message_or_call", purpose: "Text, call, or email a customer.", approvalRequired: true},
      {name: "create_payment_or_invoice", purpose: "Create Stripe money actions.", approvalRequired: true},
    ],
    connectedSystems: input.connectedSystems,
  };
}

export function buildOwnedVoiceAgentTurn(input: {
  transcript: string;
  callerPhone?: string | null;
  context: OwnedAccountContext | null;
}): OwnedVoiceAgentTurn {
  const intent = detectVoiceIntent(input.transcript);
  const client = input.context?.account ?? null;
  const primaryContact = input.context?.contacts.find((contact) => contact.isPrimary) ?? input.context?.contacts[0] ?? null;
  const confidence = client ? 85 : input.callerPhone ? 45 : 30;
  const name = primaryContact?.fullName || client?.businessName || "there";
  const actions: OwnedVoiceAgentTurn["actions"] = [
    {
      type: "write_memory",
      label: "Log conversation context",
      detail: "Save the transcript summary and intent into the client memory/timeline.",
      approvalRequired: false,
    },
  ];

  if (intent === "booking") {
    actions.push({
      type: "create_task",
      label: "Create booking follow-up",
      detail: "Ask Hamid/JARVIS to confirm time and send booking confirmation.",
      approvalRequired: false,
    });
  }

  if (intent === "pricing") {
    actions.push({
      type: "open_client",
      label: "Open Deal Room",
      detail: "Use proof, proposal, and payment readiness before quoting.",
      approvalRequired: false,
    });
  }

  const replyByIntent: Record<OwnedVoiceAgentTurn["intent"], string> = {
    booking: `Hi ${name}, I can help with that. I’ll take the details and make sure Hamid has the right context. What day and rough time works best for you?`,
    pricing: `Hi ${name}, I can help. Pricing depends on the website, automation, and follow-up work needed. I’ll check the file and make sure the next reply includes the right proof and scope.`,
    project_status: client
      ? `Hi ${name}. I can see the file for ${client.businessName}. I’ll use the latest timeline and tasks rather than guessing, then give you the current status clearly.`
      : "I can help with a status update. Could you give me the business name or reference so I can pull up the right file?",
    support: "I can help. Tell me what is happening, what you expected to happen, and the best contact details. I’ll log it properly so the right agent can act on it.",
    sales: "I can help with that. Tell me what kind of business you run and what you want the website or automation to improve first: more calls, bookings, follow-up, or payments?",
    unknown: "I can help. Give me the business name and what you need done, and I’ll route it into the right part of Hamid’s system.",
  };

  return {
    generatedAt: nowIso(),
    intent,
    confidence,
    reply: replyByIntent[intent],
    matchedClient: client
      ? {
          clientId: client.clientId,
          businessName: client.businessName,
          route: `/leads/${client.clientId}`,
          reason: input.callerPhone ? "Matched from caller/client context." : "Matched from selected client context.",
        }
      : null,
    actions,
  };
}

export function buildDealRoom(input: {
  context: OwnedAccountContext;
  stripeConnected: boolean;
}): DealRoomPayload {
  const {account} = input.context;
  const primaryContact = input.context.contacts.find((contact) => contact.isPrimary) ?? input.context.contacts[0] ?? null;
  const latestAudit = input.context.browserAudits[0] ?? null;
  const hasProposal = input.context.proposals.length > 0;
  const hasDemo = Boolean(latestAudit || account.websiteUrl);
  const hasContact = Boolean(primaryContact?.email || primaryContact?.phone || account.emailAddress || account.phoneNumber);
  const hasProof = input.context.browserAudits.length > 0 || account.siteScore > 0;
  const readinessScore = clampScore(
    (hasContact ? 18 : 0) +
    (hasProof ? 20 : 0) +
    (hasDemo ? 16 : 0) +
    (hasProposal ? 22 : 0) +
    (input.stripeConnected ? 12 : 0) +
    Math.min(12, Math.round(account.closeProbability / 8)),
  );
  const setupFee = Math.max(800, Math.round((account.dealValue || 1500) / 100) * 100);
  const blockers: DealRoomPayload["blockers"] = [];
  if (!hasContact) blockers.push({label: "No reliable contact", detail: "Find an email or phone before pushing the deal.", severity: "warning"});
  if (!hasProof) blockers.push({label: "Proof gap", detail: "Run a browser audit or add evidence before sending a proposal.", severity: "warning"});
  if (!hasProposal) blockers.push({label: "Proposal not generated", detail: "Create a draft proposal from the Deal Room before sending payment links.", severity: "info"});
  if (!input.stripeConnected) blockers.push({label: "Stripe not connected", detail: "Payment links and invoices need Stripe configured first.", severity: "danger"});

  const proof: DealRoomPayload["proof"] = [];
  if (latestAudit) {
    proof.push({label: "Latest audit", detail: latestAudit.summary || "Browser audit completed.", source: latestAudit.createdAt});
    for (const flaw of latestAudit.flaws.slice(0, 3)) proof.push({label: "Website flaw", detail: flaw, source: "Playwright audit"});
  }
  if (account.nextActionNotes) proof.push({label: "Next action", detail: account.nextActionNotes, source: "CRM"});
  if (account.siteScore) proof.push({label: "Site score", detail: `${account.siteScore}/100 readiness score`, source: "Audit scoring"});

  return {
    generatedAt: nowIso(),
    roomId: `DEAL-${account.clientId}`,
    client: {
      clientId: account.clientId,
      businessName: account.businessName,
      businessType: account.businessType,
      area: account.area,
      status: account.accountStatus,
      route: `/leads/${account.clientId}`,
      websiteUrl: account.websiteUrl,
    },
    readinessScore,
    blockers,
    offer: {
      packageName: "Elite Growth Sprint",
      setupFee,
      monthlyRetainer: setupFee >= 1800 ? 350 : 150,
      timeline: "7-14 days from signed scope and content access",
      scope: [
        "Premium website/demo rebuild focused on conversion and trust proof",
        "Lead capture, booking, and follow-up workflow",
        "Basic CRM handover with calls/emails/tasks logged",
        "Launch support and first performance review",
      ],
      proofAngle: latestAudit?.opportunities[0] ?? account.nextActionNotes ?? "Make it easier for customers to trust, enquire, book, and pay.",
      paymentStatus: input.stripeConnected ? (hasProposal ? "ready" : "needs-proposal") : "needs-stripe",
    },
    proof,
    assets: [
      {label: "Website/audit evidence", status: hasProof ? "ready" : "missing", route: `/leads/${account.clientId}`, detail: `${input.context.browserAudits.length} browser audit${input.context.browserAudits.length === 1 ? "" : "s"}`},
      {label: "Proposal", status: hasProposal ? "ready" : "missing", route: `/ops/tools/deal-room`, detail: `${input.context.proposals.length} proposal${input.context.proposals.length === 1 ? "" : "s"}`},
      {label: "Payment path", status: input.stripeConnected ? "ready" : "missing", route: "/pay/links", detail: input.stripeConnected ? "Stripe connector available" : "Stripe setup needed"},
    ],
    closePlan: [
      {step: "Confirm the pain in one sentence", owner: "JARVIS", outcome: "Prospect feels understood."},
      {step: "Show proof and the upgraded path", owner: "BUILDER", outcome: "Demo/proof makes the value tangible."},
      {step: "Send scoped proposal with one price", owner: "OPS", outcome: "Decision is simple."},
      {step: "Collect payment and open delivery", owner: "FINANCE", outcome: "Project becomes paid work."},
    ],
    proposals: input.context.proposals,
  };
}

export function buildFinanceGuard(input: {
  state: DashboardAppState;
  stripe: StripeSummary;
  integrationStatuses: Array<{provider: string; connected?: boolean; configured?: boolean; status?: string; label?: string}>;
}): FinanceGuardPayload {
  const metrics = input.state.metrics;
  const stripe = input.stripe;
  const openRevenueAtRisk = Math.max(0, metrics.weightedPipeline - metrics.revenueCollected);
  const alerts: FinanceGuardPayload["alerts"] = [];

  if (!stripe.configured) {
    alerts.push({
      id: "stripe-not-configured",
      tone: "danger",
      title: "Stripe is not configured",
      detail: "Payment links, invoices, and revenue proof cannot be automated until Stripe keys are live.",
      route: "/settings",
    });
  } else if (!stripe.connected) {
    alerts.push({
      id: "stripe-not-connected",
      tone: "warning",
      title: "Stripe configured but not responding",
      detail: stripe.error ?? "Check restricted key permissions and account mode.",
      route: "/pay",
    });
  }

  if (metrics.highPriorityFollowUps > 0) {
    alerts.push({
      id: "follow-up-pressure",
      tone: "warning",
      title: `${metrics.highPriorityFollowUps} high-priority follow-up${metrics.highPriorityFollowUps === 1 ? "" : "s"}`,
      detail: "Money is most likely to leak through missed replies and stale proposals.",
      route: "/crm/activity",
    });
  }

  if (metrics.weightedPipeline > 0 && stripe.recentCollected === 0) {
    alerts.push({
      id: "pipeline-no-cash",
      tone: "info",
      title: "Pipeline exists but no recent Stripe cash",
      detail: "Use Deal Room to turn interest into a proposal and payment path.",
      route: "/ops/tools/deal-room",
    });
  }

  if (stripe.pendingBalance > 0) {
    alerts.push({
      id: "pending-balance",
      tone: "success",
      title: "Stripe has pending balance",
      detail: `Pending balance: ${stripe.currency.toUpperCase()} ${stripe.pendingBalance.toLocaleString("en-GB")}.`,
      route: "/pay",
    });
  }

  const byProvider = new Map(input.integrationStatuses.map((status) => [status.provider, status]));
  const statusFor = (provider: string) => {
    const entry = byProvider.get(provider);
    if (!entry) return "needs-setup" as const;
    if (entry.connected || entry.status === "connected" || entry.status === "ready") return "connected" as const;
    return entry.configured ? "blocked" as const : "needs-setup" as const;
  };

  return {
    generatedAt: nowIso(),
    summary: {
      stripeConfigured: stripe.configured,
      stripeConnected: stripe.connected,
      mode: stripe.mode,
      availableBalance: stripe.availableBalance,
      pendingBalance: stripe.pendingBalance,
      recentCollected: stripe.recentCollected,
      recentChargeCount: stripe.recentChargeCount,
      weightedPipeline: metrics.weightedPipeline,
      revenueCollected: metrics.revenueCollected,
      openRevenueAtRisk,
    },
    alerts,
    guardrails: [
      {area: "Acquisition APIs", dailyCap: 25, approvalRequiredAbove: 10, currentKnownSpend: null, status: "needs-ledger"},
      {area: "Image and video generation", dailyCap: 20, approvalRequiredAbove: 5, currentKnownSpend: null, status: "needs-ledger"},
      {area: "Voice calls and SMS", dailyCap: 15, approvalRequiredAbove: 3, currentKnownSpend: null, status: "needs-ledger"},
      {area: "Model/tool execution", dailyCap: 20, approvalRequiredAbove: 5, currentKnownSpend: null, status: "needs-ledger"},
    ],
    reconciliation: [
      {label: "Stripe", source: "Payments, invoices, customers", status: stripe.connected ? "connected" : stripe.configured ? "blocked" : "needs-setup", detail: stripe.error ?? `${stripe.recentChargeCount} recent charge${stripe.recentChargeCount === 1 ? "" : "s"}`},
      {label: "Plaid", source: "Bank cashflow", status: statusFor("plaid"), detail: "Used for bank account cash-in/cash-out once linked."},
      {label: "RevenueCat", source: "Subscriptions and app revenue", status: statusFor("revenuecat"), detail: "Used for subscription revenue once connected."},
      {label: "App Store Connect", source: "App metrics and proceeds", status: statusFor("appstore"), detail: "Used for Apple app reporting once private key is configured."},
    ],
  };
}

function openTasks(contexts: OwnedAccountContext[]) {
  return contexts.reduce((total, context) => total + context.tasks.filter((task) => task.status !== "done").length, 0);
}

function contextsWithProof(contexts: OwnedAccountContext[]) {
  return contexts.filter((context) =>
    context.browserAudits.length > 0 ||
    context.account.siteScore > 0 ||
    context.account.nextActionNotes.trim().length > 0 ||
    context.proposals.length > 0,
  );
}

export function buildWarRoom(input: {
  state: DashboardAppState;
  contexts: OwnedAccountContext[];
  toolForge: {summary: {live: number; partial: number; total: number; pendingApprovals: number}};
  connectors: Array<{provider: string; connected: boolean; label: string}>;
}): WarRoomPayload {
  const metrics = input.state.metrics;
  const proofClients = contextsWithProof(input.contexts);
  const connected = input.connectors.filter((connector) => connector.connected).length;
  const connectorScore = clampScore((connected / Math.max(1, input.connectors.length)) * 100);
  const toolScore = clampScore(((input.toolForge.summary.live + input.toolForge.summary.partial * 0.65) / Math.max(1, input.toolForge.summary.total)) * 100);
  const proofScore = clampScore((proofClients.length / Math.max(1, input.contexts.length)) * 100);
  const pipelineScore = clampScore(metrics.weightedPipeline > 0 ? 80 : 25);
  const irreplaceabilityScore = clampScore((toolScore * 0.35) + (connectorScore * 0.2) + (proofScore * 0.25) + (pipelineScore * 0.2));
  const highFollowUps = metrics.highPriorityFollowUps ?? 0;
  const openTaskCount = openTasks(input.contexts);

  return {
    generatedAt: nowIso(),
    irreplaceabilityScore,
    doctrine: [
      "Own the memory, proof, workflow, and decision log. APIs are adapters.",
      "Show state, threat, owner, next action, and route on every command surface.",
      "Diagnosis before action: the system must explain why a move matters.",
      "Guard anything that sends, spends, deletes, calls, or commits Hamid externally.",
    ],
    operatingLoops: [
      {
        id: "acquire",
        label: "Acquire",
        score: clampScore((metrics.qualifiedLeads / Math.max(1, metrics.totalProspects)) * 100),
        status: metrics.qualifiedLeads > 0 ? "strong" : "watch",
        currentTruth: `${metrics.qualifiedLeads} qualified from ${metrics.totalProspects} stored prospects.`,
        nextMove: "Keep Lead Radar and Proof Auditor feeding useful client files.",
        route: "/leads",
      },
      {
        id: "convert",
        label: "Convert",
        score: clampScore(metrics.repliedAccounts > 0 ? 70 + Math.min(20, metrics.proposalStage * 5) : 35),
        status: highFollowUps > 0 ? "watch" : "strong",
        currentTruth: `${highFollowUps} high-priority follow-up${highFollowUps === 1 ? "" : "s"} waiting.`,
        nextMove: "Use Reply Radar and Deal Room before running more acquisition.",
        route: "/ops/tools/reply-radar",
      },
      {
        id: "deliver",
        label: "Deliver",
        score: clampScore(metrics.demosBuilt > 0 ? 60 + Math.min(30, metrics.demosBuilt * 4) : 30),
        status: metrics.demosBuilt > 0 ? "strong" : "watch",
        currentTruth: `${metrics.demosBuilt} demos built and ${metrics.videosPrepared} videos prepared.`,
        nextMove: "Turn strongest proof into client-ready demos and proposals.",
        route: "/ops/tools/proof-vault",
      },
      {
        id: "collect",
        label: "Collect",
        score: clampScore(metrics.revenueCollected > 0 ? 85 : metrics.weightedPipeline > 0 ? 55 : 25),
        status: metrics.revenueCollected > 0 ? "strong" : "watch",
        currentTruth: `${new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP", maximumFractionDigits: 0}).format(metrics.weightedPipeline)} weighted pipeline.`,
        nextMove: "Move proof-backed prospects into Deal Room and payment path.",
        route: "/ops/tools/finance-guard",
      },
    ],
    decisions: [
      {
        label: highFollowUps > 0 ? "Clear hot follow-ups before new scraping" : "Select the next five proof-backed leads",
        why: highFollowUps > 0 ? "Warm replies decay faster than cold lists compound." : "The fastest money path is focused conversion, not more noise.",
        impact: "high",
        owner: "JARVIS",
        route: highFollowUps > 0 ? "/crm/activity" : "/ops/tools/proof-vault",
      },
      {
        label: "Make every demo pass the Design Lab gates",
        why: "The client will judge Elite Automations by the visible craft before they understand the backend.",
        impact: "high",
        owner: "BUILDER",
        route: "/ops/tools/design-lab",
      },
      {
        label: "Turn connector gaps into setup tasks",
        why: "Irreplaceable systems do not hide missing truth sources.",
        impact: "medium",
        owner: "OPS",
        route: "/ops/health",
      },
    ],
    commandRisks: [
      {
        label: "Open task pressure",
        severity: openTaskCount > 20 ? "warning" : "info",
        diagnostic: `${openTaskCount} open client tasks are in the local CRM.`,
        counterMove: "Batch by money impact and owner, then collapse anything non-revenue.",
      },
      {
        label: "Proof density",
        severity: proofScore < 50 ? "warning" : "success",
        diagnostic: `${proofClients.length}/${input.contexts.length} client files have usable proof.`,
        counterMove: "Run browser audits and screenshots for high-value clients only.",
      },
      {
        label: "Tool maturity",
        severity: toolScore < 70 ? "warning" : "success",
        diagnostic: `${input.toolForge.summary.live} live and ${input.toolForge.summary.partial} partial owned tools.`,
        counterMove: "Ship narrow custom tools until the operating loops are owned end-to-end.",
      },
    ],
  };
}

function proofScoreFor(context: OwnedAccountContext) {
  const audit = context.browserAudits.length ? 28 : 0;
  const score = context.account.siteScore > 0 ? Math.min(22, Math.round(context.account.siteScore / 5)) : 0;
  const notes = context.account.nextActionNotes.trim() ? 14 : 0;
  const proposal = context.proposals.length ? 18 : 0;
  const contacts = context.contacts.some((contact) => contact.email || contact.phone) ? 10 : 0;
  const memory = context.memory?.painPoints || context.memory?.whatResonates ? 8 : 0;
  return clampScore(audit + score + notes + proposal + contacts + memory);
}

function hasReliableContact(context: OwnedAccountContext) {
  return Boolean(
    context.account.emailAddress ||
    context.account.phoneNumber ||
    context.contacts.some((contact) => contact.email || contact.phone),
  );
}

function contextOpenTasks(context: OwnedAccountContext) {
  return context.tasks.filter((task) => task.status !== "done");
}

function contextOverdueTasks(context: OwnedAccountContext) {
  const today = new Date().toISOString().slice(0, 10);
  return contextOpenTasks(context).filter((task) => task.dueDate && task.dueDate < today);
}

function daysSince(value: string | null | undefined) {
  const time = dateToTime(value);
  if (!time) return 999;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function statusWeight(status: string) {
  const normalized = lower(status).replace(/[_-]/g, " ");
  if (/\b(won|closed)\b/.test(normalized)) return 0;
  if (/\b(proposal|payment|quote|invoice)\b/.test(normalized)) return 34;
  if (/\b(replied|booked|call)\b/.test(normalized)) return 30;
  if (/\b(email|contacted|follow)\b/.test(normalized)) return 24;
  if (/\b(demo|built|ready)\b/.test(normalized)) return 20;
  if (/\b(audited|research|qualified)\b/.test(normalized)) return 16;
  return 10;
}

function opportunityLane(context: OwnedAccountContext, proofScore: number): OpportunityEnginePayload["opportunities"][number]["lane"] {
  const status = lower(context.account.accountStatus);
  const hasContact = hasReliableContact(context);
  if ((/\b(proposal|payment|replied|booked|call)\b/.test(status) || context.account.closeProbability >= 65) && hasContact && proofScore >= 45) {
    return "close";
  }
  if (!hasContact) return "research";
  if (proofScore < 45 || !context.browserAudits.length) return "prove";
  return "nurture";
}

function opportunityOwner(lane: OpportunityEnginePayload["opportunities"][number]["lane"], context: OwnedAccountContext) {
  if (lane === "research") return "LEADGEN" as const;
  if (lane === "prove") return context.browserAudits.length ? "BUILDER" as const : "OPS" as const;
  if (lane === "close") return "JARVIS" as const;
  return "OUTREACH" as const;
}

function opportunityNextMove(lane: OpportunityEnginePayload["opportunities"][number]["lane"], context: OwnedAccountContext) {
  if (lane === "close") return context.proposals.length
    ? "Open the Deal Room, tighten the offer, then send one clear payment/booking path."
    : "Generate a Deal Room proposal before asking for a decision.";
  if (lane === "research") return "Find a reliable decision-maker email or phone before spending more build time.";
  if (lane === "prove") return context.browserAudits.length
    ? "Convert the audit into a visible demo/proof pack."
    : "Run a browser audit and capture proof before outreach.";
  return "Send a short proof-led follow-up or book the next conversation.";
}

function opportunityReason(context: OwnedAccountContext, lane: OpportunityEnginePayload["opportunities"][number]["lane"], proofScore: number) {
  const value = context.account.dealValue > 0
    ? new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP", maximumFractionDigits: 0}).format(context.account.dealValue)
    : "unpriced";
  if (lane === "close") return `${value} opportunity, ${context.account.closeProbability}% close probability, and ${proofScore}/100 proof readiness.`;
  if (lane === "research") return "The file has revenue potential but cannot move until contact data is complete.";
  if (lane === "prove") return `${value} opportunity, but the proof pack is only ${proofScore}/100.`;
  return `${context.account.closeProbability}% close probability with enough context for a controlled follow-up.`;
}

export function buildOpportunityEngine(input: {
  state: DashboardAppState;
  contexts: OwnedAccountContext[];
}): OpportunityEnginePayload {
  const opportunities = input.contexts
    .map((context) => {
      const proofScore = proofScoreFor(context);
      const lane = opportunityLane(context, proofScore);
      const overdue = contextOverdueTasks(context).length;
      const staleDays = daysSince(context.account.lastTimelineEventAt);
      const hasContact = hasReliableContact(context);
      const hasProposal = context.proposals.length > 0;
      const hasAudit = context.browserAudits.length > 0;
      const proof = [
        context.browserAudits[0]?.summary,
        context.account.siteScore > 0 ? `${context.account.siteScore}/100 website score` : null,
        context.account.nextActionNotes || null,
        hasProposal ? `${context.proposals.length} proposal${context.proposals.length === 1 ? "" : "s"} on file` : null,
        context.memory?.painPoints ? `Pain: ${context.memory.painPoints}` : null,
      ].filter(Boolean) as string[];
      const blockers: Array<{label: string; severity: OwnedToolTone}> = [];
      if (!hasContact) blockers.push({label: "missing contact", severity: "danger"});
      if (!hasAudit) blockers.push({label: "no browser audit", severity: "warning"});
      if (!hasProposal && lane === "close") blockers.push({label: "proposal needed", severity: "warning"});
      if (staleDays > 7 && staleDays < 999) blockers.push({label: `${staleDays} days stale`, severity: "warning"});
      if (overdue > 0) blockers.push({label: `${overdue} overdue task${overdue === 1 ? "" : "s"}`, severity: "danger"});
      const score = clampScore(
        statusWeight(context.account.accountStatus) +
        Math.min(22, Math.round(context.account.dealValue / 100)) +
        Math.round(context.account.closeProbability * 0.18) +
        Math.round(proofScore * 0.16) +
        (hasContact ? 8 : -10) +
        (overdue ? 6 : 0) +
        (staleDays > 7 && staleDays < 999 ? 4 : 0),
      );

      return {
        clientId: context.account.clientId,
        businessName: context.account.businessName,
        area: context.account.area,
        businessType: context.account.businessType,
        route: `/leads/${context.account.clientId}`,
        rank: 0,
        score,
        dealValue: context.account.dealValue,
        closeProbability: context.account.closeProbability,
        status: context.account.accountStatus,
        lane,
        reason: opportunityReason(context, lane, proofScore),
        nextMove: opportunityNextMove(lane, context),
        proof: proof.length ? proof.slice(0, 4) : ["No usable proof yet. Build evidence before selling."],
        blockers,
        owner: opportunityOwner(lane, context),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.dealValue - left.dealValue)
    .slice(0, 50)
    .map((item, index) => ({...item, rank: index + 1}));

  const laneMeta: Record<OpportunityEnginePayload["lanes"][number]["id"], {label: string; route: string; brief: string}> = {
    close: {
      label: "Close",
      route: "/ops/tools/deal-room",
      brief: "Proof-backed files that deserve a proposal, payment path, or booked call.",
    },
    prove: {
      label: "Prove",
      route: "/ops/tools/proof-vault",
      brief: "Good opportunities that need stronger audit/demo evidence before outreach.",
    },
    research: {
      label: "Research",
      route: "/crm/contacts",
      brief: "Revenue potential blocked by missing email, phone, or decision-maker context.",
    },
    nurture: {
      label: "Nurture",
      route: "/mail/campaigns",
      brief: "Qualified files that need disciplined follow-up rather than heavy build work.",
    },
  };

  const lanes = (Object.keys(laneMeta) as OpportunityEnginePayload["lanes"][number]["id"][]).map((id) => {
    const laneItems = opportunities.filter((item) => item.lane === id);
    return {
      id,
      label: laneMeta[id].label,
      count: laneItems.length,
      value: laneItems.reduce((total, item) => total + item.dealValue, 0),
      route: laneMeta[id].route,
      brief: laneMeta[id].brief,
    };
  });

  return {
    generatedAt: nowIso(),
    summary: {
      ranked: opportunities.length,
      readyToClose: opportunities.filter((item) => item.lane === "close").length,
      needsResearch: opportunities.filter((item) => item.lane === "research").length,
      totalPotential: opportunities.reduce((total, item) => total + item.dealValue, 0),
      topAction: opportunities[0]?.nextMove ?? "Create or enrich client files so the engine can rank the next money move.",
    },
    lanes,
    opportunities,
  };
}

function connectorAccessStatus(input: {provider: string; connected: boolean; status?: string}): RevenueRadarPayload["internetAccess"][number]["status"] {
  if (["gmail", "stripe", "twilio", "elevenlabs"].includes(input.provider) && input.connected) return "approval-gated";
  if (input.connected) return "live";
  if (input.status === "error") return "blocked";
  return "blocked";
}

function revenueRadarOwner(lane: OpportunityEnginePayload["opportunities"][number]["lane"]): RevenueRadarPayload["opportunities"][number]["owner"] {
  if (lane === "close") return "JARVIS";
  if (lane === "research") return "LEADGEN";
  if (lane === "prove") return "BUILDER";
  return "OUTREACH";
}

function revenueRadarGaps(context: OwnedAccountContext, proofScore: number) {
  const gaps: string[] = [];
  if (!context.account.websiteUrl) gaps.push("website missing");
  if (!hasReliableContact(context)) gaps.push("contact gap");
  if (!context.browserAudits.length) gaps.push("no browser audit");
  if (proofScore < 45) gaps.push("proof thin");
  if (!context.proposals.length && /replied|booked|proposal|payment/i.test(context.account.accountStatus)) gaps.push("proposal needed");
  const stale = daysSince(context.account.lastTimelineEventAt);
  if (stale > 7 && stale < 999) gaps.push(`${stale} days stale`);
  if (contextOverdueTasks(context).length) gaps.push(`${contextOverdueTasks(context).length} overdue task${contextOverdueTasks(context).length === 1 ? "" : "s"}`);
  return gaps.slice(0, 5);
}

function estimatedOwnedDealValue(context: OwnedAccountContext) {
  if (context.account.dealValue > 0) return context.account.dealValue;
  const type = `${context.account.businessType} ${context.account.businessName}`.toLowerCase();
  const base = type.includes("dent") || type.includes("estate")
    ? 2800
    : type.includes("construction") || type.includes("builder") || type.includes("legal")
      ? 2400
      : type.includes("restaurant") || type.includes("beauty") || type.includes("salon")
        ? 1800
        : 1500;
  const proofLift = Math.min(450, proofScoreFor(context) * 5);
  const contactLift = hasReliableContact(context) ? 250 : 0;
  return Math.round(base + proofLift + contactLift);
}

function nicheScoreFor(contexts: OwnedAccountContext[], query: string, base: number) {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 3);
  const matches = contexts.filter((context) => {
    const haystack = `${context.account.businessName} ${context.account.businessType} ${context.account.area}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
  const weakContact = matches.filter((context) => !hasReliableContact(context)).length;
  const weakProof = matches.filter((context) => !context.browserAudits.length).length;
  return clampScore(base + Math.min(18, matches.length * 3) + Math.min(14, weakContact * 4) + Math.min(10, weakProof * 2));
}

export function buildRevenueRadar(input: {
  state: DashboardAppState;
  contexts: OwnedAccountContext[];
  connectors: Array<{
    provider: string;
    label: string;
    connected: boolean;
    status?: string;
    enables?: string;
  }>;
  approvals?: number;
  nextRunAt?: string | null;
}): RevenueRadarPayload {
  const opportunityEngine = buildOpportunityEngine({state: input.state, contexts: input.contexts});
  const opportunities = opportunityEngine.opportunities
    .map((opportunity) => {
      const context = input.contexts.find((item) => item.account.clientId === opportunity.clientId);
      const proofScore = context ? proofScoreFor(context) : 0;
      const gaps = context ? revenueRadarGaps(context, proofScore) : ["client file unavailable"];
      const dealValue = context ? estimatedOwnedDealValue(context) : opportunity.dealValue;
      const moneyScore = clampScore(
        opportunity.score +
        Math.min(20, Math.round(dealValue / 150)) +
        Math.round(opportunity.closeProbability * 0.12) +
        (gaps.length ? 0 : 8),
      );
      return {
        clientId: opportunity.clientId,
        businessName: opportunity.businessName,
        area: opportunity.area,
        businessType: opportunity.businessType,
        websiteUrl: context?.account.websiteUrl ?? null,
        score: opportunity.score,
        moneyScore,
        dealValue,
        closeProbability: opportunity.closeProbability,
        status: opportunity.status,
        owner: revenueRadarOwner(opportunity.lane),
        gaps,
        nextAction: opportunity.nextMove,
        route: opportunity.route,
        dossierRoute: `/ops/tools/evidence-dossier?clientId=${encodeURIComponent(opportunity.clientId)}`,
      };
    })
    .sort((left, right) => right.moneyScore - left.moneyScore)
    .slice(0, 30);

  const readyToClose = opportunities.filter((item) => item.owner === "JARVIS").length;
  const researchBacklog = input.contexts.filter((context) => !hasReliableContact(context)).length;
  const proofBacklog = input.contexts.filter((context) => !context.browserAudits.length && context.account.websiteUrl).length;
  const pipeline = input.contexts.reduce((sum, context) => sum + Math.max(0, estimatedOwnedDealValue(context)), 0);
  const connectedCount = input.connectors.filter((connector) => connector.connected).length;
  const score = clampScore(
    30 +
    Math.min(20, connectedCount * 3) +
    Math.min(18, opportunities.length * 2) +
    Math.min(14, readyToClose * 4) +
    Math.min(10, input.contexts.filter((context) => context.browserAudits.length).length) -
    Math.min(12, researchBacklog),
  );

  const connectorCopy: Record<string, {job: string; guardrail: string; route: string}> = {
    firecrawl: {
      job: "Search, scrape, and turn business websites into evidence-backed lead files.",
      guardrail: "Allowed automatically for research and audits; heavy runs stay capped by max leads.",
      route: "/ai/scraper",
    },
    apify: {
      job: "Run actors for maps, reviews, directory enrichment, and market data.",
      guardrail: "Allowed for enrichment; paid actors should stay inside rate limits and run history.",
      route: "/ai/scraper",
    },
    gmail: {
      job: "Read replies, classify buying intent, draft outreach, and log conversations.",
      guardrail: "Sending remains approval-gated unless the explicit autopilot send flag is enabled.",
      route: "/mail",
    },
    stripe: {
      job: "Create payment links, reconcile revenue, and prove cash collected.",
      guardrail: "Money movement and customer-facing links require Hamid approval.",
      route: "/pay",
    },
    twilio: {
      job: "Place calls, receive calls, collect recordings, and log call intelligence.",
      guardrail: "Outbound calls and SMS are approval-gated and logged into the call centre.",
      route: "/calls",
    },
    elevenlabs: {
      job: "Power voice-agent conversations, booking capture, and post-call summaries.",
      guardrail: "Voice handoffs and public webhooks stay visible in logs before scale-up.",
      route: "/calls/agents",
    },
    kie: {
      job: "Generate demo hero images, video assets, and high-converting proof visuals.",
      guardrail: "Creative generation is capped by per-run automation limits.",
      route: "/ai/imagegen",
    },
    openclaw: {
      job: "Coordinate JARVIS, OPS, LEADGEN, OUTREACH, BUILDER, CONTENT, and FINANCE agents.",
      guardrail: "Outside-world tools still route through approvals and observability.",
      route: "/agents",
    },
  };

  const internetAccess = input.connectors.map((connector) => {
    const copy = connectorCopy[connector.provider] ?? {
      job: connector.enables ?? "Connected operating data source.",
      guardrail: "Visible in integrations and run logs before autonomous use.",
      route: "/settings",
    };
    return {
      provider: connector.provider,
      label: connector.label,
      status: connectorAccessStatus(connector),
      ...copy,
    };
  });

  const knownAccess = new Set(internetAccess.map((item) => item.provider));
  for (const provider of ["firecrawl", "apify", "gmail", "stripe", "twilio", "elevenlabs", "kie", "openclaw"]) {
    if (knownAccess.has(provider)) continue;
    const copy = connectorCopy[provider];
    internetAccess.push({
      provider,
      label: provider.toUpperCase(),
      status: "blocked",
      ...copy,
    });
  }

  const niches = [
    {
      id: "dentists",
      label: "Dental clinics",
      query: "private dentist practices outdated website booking reviews",
      location: "Greater Manchester",
      base: 78,
      reason: "High trust requirement, high lifetime value, and obvious booking friction when websites are dated.",
      offer: "Website rebuild, missed-call recovery, online booking, review capture, and recall automation.",
    },
    {
      id: "builders",
      label: "Builders and trades",
      query: "builders contractors Greater Manchester old website no quote form",
      location: "Greater Manchester",
      base: 74,
      reason: "They often leak enquiries through weak proof, slow quoting, and untracked inbound calls.",
      offer: "Proof-led site, quote intake, photo gallery, call tracking, and follow-up automation.",
    },
    {
      id: "beauty",
      label: "Beauty and clinics",
      query: "beauty salon aesthetics clinic Manchester booking website reviews",
      location: "Greater Manchester",
      base: 70,
      reason: "Visual proof and bookings directly affect revenue; demos can show instant uplift.",
      offer: "Premium booking site, automated reminders, review engine, and seasonal campaigns.",
    },
    {
      id: "restaurants",
      label: "Restaurants and takeaways",
      query: "local restaurant Manchester online booking weak website reviews",
      location: "Greater Manchester",
      base: 67,
      reason: "Menus, bookings, calls, and reviews create measurable missed revenue opportunities.",
      offer: "Modern site, booking funnel, review response workflow, and missed-call recovery.",
    },
    {
      id: "estate-agents",
      label: "Estate agents",
      query: "estate agents Manchester outdated website valuation form automation",
      location: "Greater Manchester",
      base: 66,
      reason: "Lead value is high and valuation/callback workflows are easy to demonstrate.",
      offer: "Valuation landing pages, lead routing, appointment reminders, and content engine.",
    },
  ].map((niche) => ({
    id: niche.id,
    label: niche.label,
    query: niche.query,
    location: niche.location,
    score: nicheScoreFor(input.contexts, niche.query, niche.base),
    reason: niche.reason,
    offer: niche.offer,
    route: `/ops/automation?query=${encodeURIComponent(niche.query)}&location=${encodeURIComponent(niche.location)}`,
  })).sort((left, right) => right.score - left.score);

  const moneyLoops: RevenueRadarPayload["moneyLoops"] = [
    {
      stage: "Discover",
      owner: "LEADGEN",
      status: internetAccess.some((item) => item.provider === "firecrawl" && item.status === "live") ? "live" : "blocked",
      output: "New local business files with URLs, reviews, contact hints, and source evidence.",
      route: "/ops/automation",
    },
    {
      stage: "Audit",
      owner: "OPS",
      status: "live",
      output: "Human-style browser inspection, screenshots, conversion gaps, and proof notes.",
      route: "/ops/tools/proof-vault",
    },
    {
      stage: "Demo",
      owner: "BUILDER",
      status: internetAccess.some((item) => item.provider === "kie" && item.status === "live") ? "live" : "blocked",
      output: "Demo proof assets, hero images, videos, and client-ready build brief.",
      route: "/ai/imagegen",
    },
    {
      stage: "Outreach",
      owner: "OUTREACH",
      status: "approval-gated",
      output: "Drafts are automatic; real sends are logged and approval/transport gated.",
      route: "/mail/campaigns",
    },
    {
      stage: "Close",
      owner: "JARVIS",
      status: "approval-gated",
      output: "Proposal, call, payment link, and handoff plan with every decision visible.",
      route: "/ops/tools/deal-room",
    },
    {
      stage: "Collect",
      owner: "FINANCE",
      status: internetAccess.some((item) => item.provider === "stripe" && item.status !== "blocked") ? "approval-gated" : "blocked",
      output: "Payment links, invoices, subscriptions, and revenue proof.",
      route: "/pay",
    },
  ];

  const nextActions: RevenueRadarPayload["nextActions"] = [
    input.approvals
      ? {
          label: `Review ${input.approvals} approval${input.approvals === 1 ? "" : "s"}`,
          owner: "JARVIS",
          priority: "high",
          reason: "The machine is deliberately pausing before touching the outside world.",
          route: "/ops/approvals",
        }
      : null,
    readyToClose
      ? {
          label: "Open the top closeable account",
          owner: "JARVIS",
          priority: "high",
          reason: `${readyToClose} file${readyToClose === 1 ? " is" : "s are"} closer than raw prospecting.`,
          route: opportunities[0]?.route ?? "/ops/tools/opportunity-engine",
        }
      : null,
    researchBacklog
      ? {
          label: "Clear contact gaps",
          owner: "LEADGEN",
          priority: "high",
          reason: `${researchBacklog} account${researchBacklog === 1 ? "" : "s"} cannot be sold until email or phone evidence is captured.`,
          route: "/crm/contacts",
        }
      : null,
    proofBacklog
      ? {
          label: "Run browser proof pass",
          owner: "OPS",
          priority: "medium",
          reason: `${proofBacklog} website-backed account${proofBacklog === 1 ? "" : "s"} need screenshots and audit evidence before outreach.`,
          route: "/ops/tools/proof-vault",
        }
      : null,
    {
      label: "Run a web money scan",
      owner: "LEADGEN",
      priority: opportunities.length ? "medium" : "high",
      reason: "Top up the pipeline with live market data, but keep outreach and calls approval-gated.",
      route: "/ops/revenue-radar",
    },
  ].filter(Boolean) as RevenueRadarPayload["nextActions"];

  return {
    generatedAt: nowIso(),
    score,
    thesis: "Find under-served local businesses, capture evidence like a human, build visible proof, then only contact or charge people through approved gates.",
    moneyToday: {
      pipeline,
      readyToClose,
      researchBacklog,
      proofBacklog,
      approvals: input.approvals ?? 0,
      nextRun: input.nextRunAt ?? "Manual run only",
    },
    internetAccess,
    moneyLoops,
    niches,
    opportunities,
    nextActions,
  };
}

function auditEvidenceRoute(audit: OwnedBrowserAudit | null) {
  if (!audit?.screenshotPath) return null;
  return audit.screenshotPath;
}

function contactScoreFor(context: OwnedAccountContext) {
  const accountContact = Number(Boolean(context.account.emailAddress)) * 35 + Number(Boolean(context.account.phoneNumber)) * 25;
  const contactRecord = context.contacts.some((contact) => contact.email || contact.phone) ? 30 : 0;
  const primary = context.contacts.some((contact) => contact.isPrimary && (contact.email || contact.phone)) ? 10 : 0;
  return clampScore(accountContact + contactRecord + primary);
}

function commercialScoreFor(context: OwnedAccountContext) {
  const proposal = context.proposals.length ? 35 : 0;
  const value = context.account.dealValue > 0 ? 25 : 0;
  const probability = Math.min(30, Math.round(context.account.closeProbability * 0.3));
  const stage = /proposal|replied|booked|won|payment/i.test(context.account.accountStatus) ? 10 : 0;
  return clampScore(proposal + value + probability + stage);
}

function urgencyScoreFor(context: OwnedAccountContext) {
  const overdue = contextOverdueTasks(context).length;
  const stale = daysSince(context.account.lastTimelineEventAt);
  return clampScore((overdue ? 35 : 0) + (stale > 7 && stale < 999 ? 20 : 0) + (context.account.priority === "high" ? 25 : 0) + (context.account.accountStatus === "ready-to-send" ? 15 : 0));
}

function dossierBand(proofScore: number, contactScore: number, commercialScore: number): LeadEvidenceDossierPayload["scorecard"]["band"] {
  if (proofScore >= 60 && contactScore >= 55 && commercialScore >= 35) return "ready-to-sell";
  if (contactScore < 35) return "needs-contact";
  if (proofScore < 45) return "needs-proof";
  return "raw-lead";
}

export function buildLeadEvidenceDossier(input: {context: OwnedAccountContext}): LeadEvidenceDossierPayload {
  const {context} = input;
  const {account} = context;
  const latestAudit = context.browserAudits[0] ?? null;
  const latestEvidence = latestAudit?.evidence;
  const proofScore = proofScoreFor(context);
  const contactScore = contactScoreFor(context);
  const commercialScore = commercialScoreFor(context);
  const urgencyScore = urgencyScoreFor(context);
  const dossierScore = clampScore((proofScore * 0.38) + (contactScore * 0.24) + (commercialScore * 0.22) + (urgencyScore * 0.16));
  const band = dossierBand(proofScore, contactScore, commercialScore);
  const hasContact = hasReliableContact(context);
  const hasForms = (latestEvidence?.forms ?? 0) > 0;
  const hasButtons = (latestEvidence?.buttons?.length ?? 0) > 0;
  const hasReviews = (account.reviewCount ?? 0) > 0 || /review|testimonial|rated|stars/i.test(`${latestEvidence?.headings?.join(" ") ?? ""} ${latestEvidence?.metaDescription ?? ""}`);
  const loadSeconds = latestEvidence?.loadMs ? `${Math.round(latestEvidence.loadMs / 100) / 10}s` : "unknown";

  const facts: LeadEvidenceDossierPayload["facts"] = [
    {label: "Website score", value: `${account.siteScore}/100`, tone: account.siteScore >= 70 ? "success" : account.siteScore >= 45 ? "warning" : "danger"},
    {label: "Contact path", value: hasContact ? "reachable" : "missing", tone: hasContact ? "success" : "danger"},
    {label: "Google proof", value: account.googleRating ? `${account.googleRating} rating · ${account.reviewCount ?? 0} reviews` : "not captured", tone: account.googleRating ? "success" : "warning"},
    {label: "Commercial value", value: knownAccountValue(account.dealValue), tone: account.dealValue > 0 ? "success" : "warning"},
    {label: "Browser audit", value: latestAudit ? `${context.browserAudits.length} saved` : "not run", tone: latestAudit ? "success" : "warning"},
    {label: "Load speed", value: loadSeconds, tone: latestEvidence?.loadMs && latestEvidence.loadMs < 3500 ? "success" : "warning"},
  ];

  const proof: LeadEvidenceDossierPayload["proof"] = [];
  if (latestAudit) {
    proof.push({label: "Browser audit summary", detail: latestAudit.summary, source: latestAudit.createdAt, route: auditEvidenceRoute(latestAudit)});
    for (const opportunity of latestAudit.opportunities.slice(0, 3)) {
      proof.push({label: "Improvement opportunity", detail: opportunity, source: "Playwright audit", route: auditEvidenceRoute(latestAudit)});
    }
  }
  if (account.nextActionNotes) proof.push({label: "CRM next action", detail: account.nextActionNotes, source: "CRM", route: `/leads/${account.clientId}`});
  if (account.sourceNotes) proof.push({label: "Source notes", detail: account.sourceNotes, source: "Discovery", route: account.websiteUrl});
  if (context.memory?.painPoints) proof.push({label: "Pain point memory", detail: context.memory.painPoints, source: "Client memory", route: `/leads/${account.clientId}`});
  if (!proof.length) proof.push({label: "No proof captured", detail: "Run a browser audit and enrich reviews/contact data before sending outreach.", source: "HAMID.OS", route: `/leads/${account.clientId}`});

  const conversionGaps: LeadEvidenceDossierPayload["conversionGaps"] = [];
  if (!hasContact) conversionGaps.push({label: "No reliable contact", evidence: "No email, phone, or contact record is attached.", severity: "danger", fix: "Research owner/manager contact before outreach or demo spend."});
  if (!latestAudit) conversionGaps.push({label: "No human browser audit", evidence: "No Playwright evidence has been saved.", severity: "warning", fix: "Run browser audit to inspect pages, CTAs, forms, errors, and screenshots."});
  if (latestAudit) {
    for (const flaw of latestAudit.flaws.slice(0, 4)) {
      conversionGaps.push({label: "Website friction", evidence: flaw, severity: "warning", fix: latestAudit.plan[0] ?? "Build a clearer proof-led website section around this issue."});
    }
  }
  if (!hasForms) conversionGaps.push({label: "Weak enquiry capture", evidence: "No obvious form/input count was detected in the latest audit.", severity: "warning", fix: "Demo should include a short enquiry/booking form and clear call route."});
  if (!hasButtons) conversionGaps.push({label: "CTA proof missing", evidence: "No clear CTA buttons were detected in the audit evidence.", severity: "warning", fix: "Create above-fold call, quote, and booking CTAs."});
  if (!hasReviews) conversionGaps.push({label: "Trust proof gap", evidence: "Reviews/testimonials are not visible in captured data.", severity: "info", fix: "Add review strip, trust badges, and recent customer proof to the demo."});

  const mainProblem = conversionGaps[0]?.evidence ?? account.nextActionNotes ?? "their current website may not make the next step obvious enough";
  const proofLine = latestAudit?.summary ?? `${account.siteScore}/100 current website score`;
  const offer = `I can show a compact demo that fixes the biggest conversion leak: ${mainProblem}`;

  return {
    generatedAt: nowIso(),
    client: {
      clientId: account.clientId,
      businessName: account.businessName,
      businessType: account.businessType,
      area: account.area,
      status: account.accountStatus,
      route: `/leads/${account.clientId}`,
      websiteUrl: account.websiteUrl,
      address: account.address ?? null,
    },
    scorecard: {dossierScore, proofScore, contactScore, commercialScore, urgencyScore, band},
    facts,
    proof: proof.slice(0, 8),
    conversionGaps: conversionGaps.slice(0, 8),
    outreachAngles: [
      {
        subject: `${account.businessName} - quick website improvement idea`,
        opener: `I was looking at ${account.businessName} in ${account.area} and noticed a few places where the site could make enquiries easier.`,
        offer,
        evidence: proofLine,
      },
      {
        subject: `Free demo idea for ${account.businessName}`,
        opener: `I put together notes on how ${account.businessName} could turn more website visitors into calls, bookings, or quote requests.`,
        offer: "I can build a small visual demo so you can see the improvement before deciding anything.",
        evidence: conversionGaps[0]?.label ?? "Website conversion review",
      },
    ],
    demoBlueprint: {
      heroAngle: `Make ${account.businessName} feel instantly trustworthy, local, and easy to contact.`,
      sections: [
        {name: "Hero", purpose: "State the main service, area, proof, and one clear enquiry action.", proof: proofLine},
        {name: "Trust bar", purpose: "Show reviews, years, areas served, and guarantees if available.", proof: hasReviews ? "Review data captured" : "Trust proof needs enrichment"},
        {name: "Service cards", purpose: "Explain the three services most likely to convert.", proof: account.businessType},
        {name: "Before/after proof", purpose: "Show what Elite Automations would improve and why.", proof: mainProblem},
        {name: "Booking/contact", purpose: "Reduce friction for calls, quote requests, and booking.", proof: hasForms ? "Existing form detected" : "No strong form detected"},
      ],
      automations: [
        {name: "Missed-call capture", value: "Turns missed enquiries into callbacks and CRM tasks.", trigger: "Inbound Twilio call missed or after-hours"},
        {name: "Quote follow-up", value: "Follows up unconverted enquiries with proof and booking prompts.", trigger: "Form submitted or call logged"},
        {name: "Review request loop", value: "Improves visible trust proof over time.", trigger: "Job marked complete"},
      ],
    },
    nextActions: [
      {
        label: latestAudit ? "Build proof-led demo" : "Run browser audit",
        owner: latestAudit ? "BUILDER" : "OPS",
        route: latestAudit ? `/leads/${account.clientId}` : `/leads/${account.clientId}`,
        priority: "high",
        reason: latestAudit ? "The dossier has enough audit evidence to shape a client-specific demo." : "The pitch needs visual evidence before outreach.",
      },
      {
        label: hasContact ? "Draft personalised outreach" : "Research decision-maker contact",
        owner: hasContact ? "OUTREACH" : "LEADGEN",
        route: hasContact ? "/mail/compose" : "/crm/contacts",
        priority: hasContact ? "high" : "medium",
        reason: hasContact ? "The lead has a send path." : "No outside-world action should happen without a real recipient.",
      },
      {
        label: context.proposals.length ? "Open Deal Room" : "Create proposal when interest appears",
        owner: "JARVIS",
        route: "/ops/tools/deal-room",
        priority: context.proposals.length ? "high" : "low",
        reason: context.proposals.length ? "Commercial scope already exists." : "Do not rush payment flow before proof/contact are ready.",
      },
    ],
    sourceHealth: [
      {label: "Website crawl", status: latestAudit ? "strong" : account.websiteUrl ? "thin" : "missing", detail: latestAudit ? `${latestEvidence?.pagesVisited?.length ?? 0} pages inspected` : account.websiteUrl ? "Website URL exists but no browser audit is saved" : "No website URL"},
      {label: "Contacts", status: hasContact ? "strong" : "missing", detail: hasContact ? `${context.contacts.length} contact record${context.contacts.length === 1 ? "" : "s"} plus account fields` : "No email/phone/contact found"},
      {label: "Reviews", status: hasReviews ? "strong" : "thin", detail: account.googleRating ? `${account.googleRating} rating, ${account.reviewCount ?? 0} reviews` : "Review data not enriched yet"},
      {label: "Commercial", status: context.proposals.length ? "strong" : account.dealValue > 0 ? "thin" : "missing", detail: context.proposals.length ? `${context.proposals.length} proposal${context.proposals.length === 1 ? "" : "s"}` : account.dealValue > 0 ? knownAccountValue(account.dealValue) : "No proposal/value yet"},
    ],
  };
}

function knownAccountValue(value: number) {
  return value > 0 ? new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP", maximumFractionDigits: 0}).format(value) : "unpriced";
}

export function buildProofVault(input: {contexts: OwnedAccountContext[]}): ProofVaultPayload {
  const scored = input.contexts
    .map((context) => {
      const missingProof: string[] = [];
      if (!context.browserAudits.length) missingProof.push("browser audit");
      if (!context.contacts.some((contact) => contact.email || contact.phone)) missingProof.push("decision-maker contact");
      if (!context.proposals.length) missingProof.push("proposal");
      if (!context.memory?.painPoints && !context.memory?.whatResonates) missingProof.push("client memory");
      const strongestProof = context.browserAudits[0]?.summary || context.account.nextActionNotes || `${context.account.siteScore}/100 website score`;
      return {
        clientId: context.account.clientId,
        businessName: context.account.businessName,
        area: context.account.area,
        businessType: context.account.businessType,
        proofScore: proofScoreFor(context),
        route: `/leads/${context.account.clientId}`,
        strongestProof,
        missingProof,
      };
    })
    .sort((left, right) => right.proofScore - left.proofScore);

  const clientsWithAudits = input.contexts.filter((context) => context.browserAudits.length > 0).length;
  const clientsWithProof = scored.filter((client) => client.proofScore >= 45).length;
  const readyForDemo = scored.filter((client) => client.proofScore >= 70).length;
  const evidenceItems = input.contexts.reduce((total, context) => total + context.browserAudits.length + context.timeline.length + context.proposals.length, 0);

  return {
    generatedAt: nowIso(),
    summary: {clientsWithAudits, clientsWithProof, readyForDemo, evidenceItems},
    proofLeaders: scored.slice(0, 30),
    evidenceStreams: [
      {
        label: "Browser audits",
        count: clientsWithAudits,
        quality: clientsWithAudits > 10 ? "strong" : clientsWithAudits > 0 ? "thin" : "missing",
        nextMove: "Audit only high-value leads where proof can support an email or proposal.",
      },
      {
        label: "Proposal proof",
        count: input.contexts.filter((context) => context.proposals.length > 0).length,
        quality: input.contexts.some((context) => context.proposals.length > 0) ? "thin" : "missing",
        nextMove: "Use Deal Room to attach proof to scope and payment path.",
      },
      {
        label: "Conversation memory",
        count: input.contexts.filter((context) => context.memory?.conversationHighlights.length).length,
        quality: input.contexts.some((context) => context.memory?.conversationHighlights.length) ? "thin" : "missing",
        nextMove: "Log voice/email highlights so every agent has context.",
      },
    ],
  };
}

export function buildDesignLab(): DesignLabPayload {
  return {
    generatedAt: nowIso(),
    philosophy:
      "HAMID.OS should feel like a realistic command suit: fast diagnosis, visible state, restrained power, and precise controls. It should not copy fictional UI; it should translate the useful principles into a sober business operating system.",
    principles: [
      {
        name: "Situation before action",
        source: "NASA human factors / mission control",
        translation: "Every screen must show current state, threat, owner, and next action before visual decoration.",
        rule: "If a card does not help Hamid decide or act, remove it or turn it into a drilldown.",
      },
      {
        name: "Hierarchy and harmony",
        source: "Apple Human Interface Guidelines",
        translation: "Use clear hierarchy, balanced spacing, and stable interaction patterns so power feels calm.",
        rule: "One dominant decision per surface, then supporting proof, then actions.",
      },
      {
        name: "Foundations, components, patterns",
        source: "Atlassian Design System",
        translation: "Design tokens are not enough; repeatable patterns keep the system scalable.",
        rule: "Every new tool should reuse page shell, stats, evidence rows, action cards, and guarded actions.",
      },
      {
        name: "Local-first suit brain",
        source: "Stark/Batcomputer-inspired principle",
        translation: "The system must work from local memory and evidence even when an API fails.",
        rule: "External API failure should degrade gracefully into local truth, never a blank page.",
      },
    ],
    qualityGates: [
      {area: "Information", passCondition: "The first screen answers what changed, what matters, and what to do next.", failureSignal: "The user has to read every card to find the priority."},
      {area: "Evidence", passCondition: "Every recommendation links to proof, source, or client record.", failureSignal: "The UI makes claims without routeable evidence."},
      {area: "Control", passCondition: "Sensitive work is approval-gated and visibly logged.", failureSignal: "The app appears to send, spend, call, or delete without human control."},
      {area: "Craft", passCondition: "Spacing, typography, state colors, and responsive layout feel deliberate.", failureSignal: "Cards overlap, numbers clip, or visual effects compete with the data."},
    ],
    interfaceModes: [
      {
        mode: "Command",
        job: "See the whole business and choose the next move.",
        mustShow: ["money pressure", "blocked systems", "hot opportunities", "agent ownership"],
        mustNeverDo: ["hide stale data", "mix fake and live metrics", "make every card equal"],
      },
      {
        mode: "Investigation",
        job: "Understand a client or lead deeply.",
        mustShow: ["proof", "screenshots/audits", "contact path", "timeline"],
        mustNeverDo: ["summarise without sources", "bury missing contact details"],
      },
      {
        mode: "Execution",
        job: "Draft, build, approve, and ship work.",
        mustShow: ["task owner", "cost/risk", "approval state", "output"],
        mustNeverDo: ["pretend work ran", "let buttons be decorative"],
      },
    ],
  };
}
