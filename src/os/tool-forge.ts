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

export interface ToolForgePayload {
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

export interface BuildToolForgePayloadInput {
  operatorToolCount?: number;
  pendingApprovals?: number;
}

const tools: ToolForgeItem[] = [
  {
    id: "elite-operator-runtime",
    name: "Elite Operator Runtime",
    category: "ops",
    status: "live",
    priority: 1,
    ownerAgent: "JARVIS",
    ownedCore: "Local tool planner, memory, guardrails, sessions, approvals, and command execution.",
    replaces: ["generic chatbot", "uncontrolled agent actions"],
    moneyFunction: "Turns commands into safe work without waiting for manual navigation or SaaS glue.",
    currentCapability: "Reads dashboard context, searches client files, creates tasks, drafts emails, checks health, and approval-gates acquisition.",
    nextBuild: "Add more typed business tools and per-agent budget/cost caps.",
    routes: ["/ops/tools", "/ops/approvals"],
    externalAdapters: ["OpenAI voice when enabled", "OpenClaw when running"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Saves operating time every day and prevents expensive mistakes.",
  },
  {
    id: "approval-gate",
    name: "Approval Gate",
    category: "ops",
    status: "live",
    priority: 1,
    ownerAgent: "OPS",
    ownedCore: "Human-in-the-loop decision layer for sends, spends, calls, scrapes, and destructive actions.",
    replaces: ["manual Slack approvals", "blind automations"],
    moneyFunction: "Lets automation move fast without burning API budget or damaging trust.",
    currentCapability: "Real pending approvals appear in OPS and can be approved or rejected.",
    nextBuild: "Add edit-before-approve and tool-level usage policy rules.",
    routes: ["/ops/approvals"],
    externalAdapters: ["Firecrawl", "Apify", "Gmail", "Twilio", "Stripe"],
    approvalRequired: false,
    risk: "medium",
    estimatedValue: "Reduces downside risk while keeping revenue workflows active.",
  },
  {
    id: "lead-radar",
    name: "Lead Radar",
    category: "acquisition",
    status: "partial",
    priority: 1,
    ownerAgent: "LEADGEN",
    ownedCore: "Local lead records, scoring, evidence, enrichment gaps, next-action routing, and pipeline storage.",
    replaces: ["Clay tables", "Apollo lists", "manual Google searches"],
    moneyFunction: "Keeps the top of funnel full with qualified local businesses worth contacting.",
    currentCapability: "Firecrawl/Apify search routes exist and leads write into CRM when acquisition runs complete.",
    nextBuild: "Add multi-source enrichment waterfall, duplicate resolver, and proof confidence scoring.",
    routes: ["/ai/scraper", "/leads", "/crm/contacts"],
    externalAdapters: ["Firecrawl", "Apify", "Playwright"],
    approvalRequired: true,
    risk: "medium",
    estimatedValue: "50 qualified leads per day can become the core outbound engine.",
  },
  {
    id: "revenue-radar",
    name: "Revenue Radar",
    category: "acquisition",
    status: "live",
    priority: 1,
    ownerAgent: "JARVIS",
    ownedCore: "Money-prioritisation layer that maps internet-enabled tools, opportunity ranking, niche attack plans, and next best actions.",
    replaces: ["random prospecting", "manual strategy docs", "blind automation runs"],
    moneyFunction: "Shows exactly where Hamid should spend the next hour to create revenue and gives LEADGEN safe web discovery access.",
    currentCapability: "Ranks live client files, reads integration status, shows tool guardrails, and can run web discovery into CRM records.",
    nextBuild: "Attach per-niche playbooks and automatic schedule insertion for the daily command centre.",
    routes: ["/ops/revenue-radar", "/ops/automation", "/ops/tools/opportunity-engine"],
    externalAdapters: ["Firecrawl", "Apify", "Playwright", "Gmail", "Stripe", "Twilio"],
    approvalRequired: false,
    risk: "medium",
    estimatedValue: "Keeps the whole operating system pointed at money instead of activity.",
  },
  {
    id: "proof-auditor",
    name: "Proof Auditor",
    category: "acquisition",
    status: "partial",
    priority: 1,
    ownerAgent: "OPS",
    ownedCore: "Browser screenshots, UX findings, missing trust proof, booking friction, speed/readability issues, and local audit timeline.",
    replaces: ["manual website audit docs", "generic AI website summaries"],
    moneyFunction: "Creates specific reasons a prospect should care and makes emails feel researched.",
    currentCapability: "Browser audit endpoint stores client evidence and can be triggered from lead files.",
    nextBuild: "Add visual issue clustering, score explanation, screenshot viewer, and recommended demo scope.",
    routes: ["/leads", "/ai/intel"],
    externalAdapters: ["Playwright", "Firecrawl"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Turns cold outreach from generic pitch into proof-led selling.",
  },
  {
    id: "evidence-dossier",
    name: "Lead Evidence Dossier",
    category: "acquisition",
    status: "live",
    priority: 1,
    ownerAgent: "OPS",
    ownedCore: "Single proof file that combines website audit evidence, contacts, reviews, CRM state, memory, demo scope, and next actions.",
    replaces: ["manual audit PDFs", "scattered CRM notes", "generic lead summaries"],
    moneyFunction: "Lets Hamid inspect a lead in one click and know exactly what to sell, what proof exists, and what is still unsafe to send.",
    currentCapability: "Reads local client files and browser audits to produce a scored dossier with proof, gaps, outreach angles, demo blueprint, and source health.",
    nextBuild: "Add screenshot gallery annotations and automatic before/after demo scope generation.",
    routes: ["/ops/tools/evidence-dossier", "/leads"],
    externalAdapters: ["Playwright", "Firecrawl", "Apify", "Gmail"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Cuts research time per lead and makes each cold email/demo specific enough to win trust.",
  },
  {
    id: "demo-factory",
    name: "Demo Factory",
    category: "delivery",
    status: "partial",
    priority: 1,
    ownerAgent: "BUILDER",
    ownedCore: "Local demo site generator, visual assets, copy, SEO metadata, and client-specific proof packs.",
    replaces: ["Lovable/Replit one-off builds", "manual demo folders"],
    moneyFunction: "Shows prospects a tangible upgrade so sales conversations convert faster.",
    currentCapability: "Lead demo, image, and video job routes exist from client files.",
    nextBuild: "Make demos multi-page, responsive, proof-backed, and deployable from a single client file.",
    routes: ["/leads", "/vid", "/ai/imagegen"],
    externalAdapters: ["KIE.ai", "Remotion", "Vercel/Netlify when deployed"],
    approvalRequired: true,
    risk: "medium",
    estimatedValue: "One strong demo can justify a £800-£3,000 first sale.",
  },
  {
    id: "outreach-sequencer",
    name: "Outreach Sequencer",
    category: "outreach",
    status: "partial",
    priority: 1,
    ownerAgent: "OUTREACH",
    ownedCore: "Local drafts, templates, campaign intent, reply tracking, and evidence-backed personalization.",
    replaces: ["Instantly-style starter sequences", "manual Gmail drafts"],
    moneyFunction: "Converts researched leads into booked conversations with follow-up discipline.",
    currentCapability: "Local email drafts and mailbox routes exist; sending is guarded.",
    nextBuild: "Add consent-safe sequence builder, reply classifier, and Gmail thread-to-client memory sync.",
    routes: ["/mail", "/mail/campaigns", "/leads"],
    externalAdapters: ["Gmail", "SMTP"],
    approvalRequired: true,
    risk: "high",
    estimatedValue: "Consistent outreach is the fastest path to first recurring revenue.",
  },
  {
    id: "reply-radar",
    name: "Reply Radar",
    category: "outreach",
    status: "live",
    priority: 1,
    ownerAgent: "OUTREACH",
    ownedCore: "Reply detection, sentiment, buying intent, objection extraction, and next response tasking.",
    replaces: ["manual inbox checking", "spreadsheet follow-up notes"],
    moneyFunction: "Stops warm replies being missed and moves hot prospects into booking/payment.",
    currentCapability: "Gmail replies are classified, matched to client files, and can be synced into CRM timeline/tasks.",
    nextBuild: "Add scheduled background sync and objection-specific draft replies.",
    routes: ["/ops/tools/reply-radar", "/mail", "/crm/activity"],
    externalAdapters: ["Gmail"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Protects every opportunity created by outbound.",
  },
  {
    id: "client-360",
    name: "Client 360 File",
    category: "client",
    status: "partial",
    priority: 1,
    ownerAgent: "OPS",
    ownedCore: "One client record containing contacts, tasks, timeline, proposals, audits, demos, calls, notes, and memory.",
    replaces: ["HubSpot deal record", "Notion client page", "Airtable CRM row"],
    moneyFunction: "Makes every prospect and client easy to understand, close, and deliver for.",
    currentCapability: "Client detail routes, CRM records, contacts, tasks, proposals, and timeline exist.",
    nextBuild: "Add richer dossier tabs, file attachments, call transcripts, screenshots, and payment history.",
    routes: ["/crm", "/leads"],
    externalAdapters: ["Gmail", "Twilio", "Stripe", "Plaid"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Keeps context from leaking across sales, delivery, and support.",
  },
  {
    id: "deal-room",
    name: "Deal Room",
    category: "client",
    status: "partial",
    priority: 2,
    ownerAgent: "JARVIS",
    ownedCore: "Client-facing proposal, scope, proof, payment link, booking, and project status portal.",
    replaces: ["PandaDoc starter proposal", "manual payment link email", "client status calls"],
    moneyFunction: "Turns interest into a clear yes, payment, and delivery timeline.",
    currentCapability: "Local Deal Room now calculates readiness, blockers, proof, scope, and can draft proposals into the client file.",
    nextBuild: "Create a secure client-facing portal route for proposal, demo, invoice, booking, and updates.",
    routes: ["/ops/tools/deal-room", "/pay/links", "/crm/pipeline"],
    externalAdapters: ["Stripe", "Twilio", "Gmail"],
    approvalRequired: true,
    risk: "high",
    estimatedValue: "Directly shortens close time and increases perceived professionalism.",
  },
  {
    id: "voice-desk",
    name: "Voice Desk",
    category: "voice",
    status: "partial",
    priority: 1,
    ownerAgent: "SUPPORT",
    ownedCore: "Call logs, voice-agent config, transcript memory, bookings, and follow-up actions.",
    replaces: ["HighLevel voice receptionist", "manual missed-call follow-up"],
    moneyFunction: "Captures calls, books demos, and keeps prospects warm without Hamid always being available.",
    currentCapability: "Twilio/ElevenLabs pages and webhook plumbing exist; public tunnel controls exist.",
    nextBuild: "Build owned voice agent brain and transcript-to-client memory sync.",
    routes: ["/calls", "/calls/agents", "/ops/tunnel"],
    externalAdapters: ["Twilio", "ElevenLabs", "OpenAI Realtime"],
    approvalRequired: true,
    risk: "high",
    estimatedValue: "Every answered call can become a booked consultation instead of a missed opportunity.",
  },
  {
    id: "owned-voice-agent",
    name: "Owned Voice Agent",
    category: "voice",
    status: "partial",
    priority: 1,
    ownerAgent: "JARVIS",
    ownedCore: "Custom realtime sales/support agent with calm persona, client context, tool calling, and booking workflow.",
    replaces: ["black-box ElevenLabs-only agent", "generic phone bot"],
    moneyFunction: "Creates a repeatable sales and support experience that can later be sold to clients.",
    currentCapability: "First-party voice brain can classify intent, match client files, write memory, and create booking tasks.",
    nextBuild: "Connect realtime transport and Twilio media streams directly into the owned voice-session service.",
    routes: ["/ops/tools/owned-voice-agent", "/calls/agents", "/ai"],
    externalAdapters: ["OpenAI Realtime", "Twilio media streams"],
    approvalRequired: true,
    risk: "high",
    estimatedValue: "Becomes a product, not just an internal assistant.",
  },
  {
    id: "finance-guard",
    name: "Finance Guard",
    category: "finance",
    status: "partial",
    priority: 2,
    ownerAgent: "FINANCE",
    ownedCore: "Usage ledger, per-tool cost caps, invoice chasing, cash runway, Stripe/Plaid/RevenueCat reconciliation.",
    replaces: ["manual bank checks", "Stripe dashboard hopping", "API spend surprises"],
    moneyFunction: "Protects margin and makes sure cash collected matches work delivered.",
    currentCapability: "Finance Guard reads Stripe, pipeline value, connector readiness, cash alerts, and local cost-cap policy.",
    nextBuild: "Create normalized money ledger with per-tool spend capture and invoice follow-up automation.",
    routes: ["/ops/tools/finance-guard", "/pay", "/ops/metrics"],
    externalAdapters: ["Stripe", "Plaid", "RevenueCat", "App Store Connect"],
    approvalRequired: true,
    risk: "high",
    estimatedValue: "Prevents the business from growing revenue while leaking profit.",
  },
  {
    id: "war-room",
    name: "War Room Intelligence",
    category: "ops",
    status: "live",
    priority: 1,
    ownerAgent: "JARVIS",
    ownedCore: "Founder-level command doctrine, operating loops, risks, and next decisions drawn from local truth.",
    replaces: ["static KPI dashboards", "guesswork strategy notes", "decorative mission control cards"],
    moneyFunction: "Keeps the whole system pointed at the next money-making move instead of scattered activity.",
    currentCapability: "Calculates operating loop health, irreplaceability score, doctrine, decisions, and risks from live CRM/tool data.",
    nextBuild: "Add decision history, weekly war-room review, and one-click execution plans guarded by approvals.",
    routes: ["/ops/tools/war-room", "/ops", "/"],
    externalAdapters: ["OpenAI voice when enabled", "OpenClaw when running"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Improves daily focus, reduces context switching, and keeps revenue loops visible.",
  },
  {
    id: "opportunity-engine",
    name: "Opportunity Engine",
    category: "ops",
    status: "live",
    priority: 1,
    ownerAgent: "JARVIS",
    ownedCore: "Ranks every client file by money impact, proof readiness, contact completeness, stale risk, and next move.",
    replaces: ["manual lead prioritisation", "guessing what to work on next", "static CRM views"],
    moneyFunction: "Points Hamid and the agents at the most likely cash-producing move before more work is created.",
    currentCapability: "Calculates close/prove/research/nurture lanes from live CRM, tasks, proposals, audits, and memory.",
    nextBuild: "Add one-click guarded execution plans and weekly opportunity-review snapshots.",
    routes: ["/ops/tools/opportunity-engine", "/leads", "/crm"],
    externalAdapters: ["Gmail", "Firecrawl", "Apify", "Stripe"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Keeps scarce founder time focused on opportunities with the highest money leverage.",
  },
  {
    id: "proof-vault",
    name: "Proof Vault",
    category: "delivery",
    status: "live",
    priority: 1,
    ownerAgent: "BUILDER",
    ownedCore: "Evidence density, audit proof, missing proof, proposal readiness, and demo priority for every client file.",
    replaces: ["scattered screenshots", "manual proof folders", "generic website critique notes"],
    moneyFunction: "Turns research into proof assets that make outreach and proposals feel specific and valuable.",
    currentCapability: "Ranks client files by proof score and exposes missing evidence before outreach or proposal work.",
    nextBuild: "Add screenshot gallery, before/after demo comparisons, and proof-pack export for client portals.",
    routes: ["/ops/tools/proof-vault", "/leads", "/crm"],
    externalAdapters: ["Playwright", "Firecrawl", "Apify"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Raises conversion by making every pitch evidence-backed instead of generic.",
  },
  {
    id: "design-lab",
    name: "Design Lab",
    category: "delivery",
    status: "live",
    priority: 1,
    ownerAgent: "BUILDER",
    ownedCore: "Original interface principles, quality gates, and screen modes for building premium internal/client software.",
    replaces: ["AI slop design", "one-off visual experiments", "unreviewed demo pages"],
    moneyFunction: "Improves perceived value so prospects trust Elite Automations can build high-quality systems.",
    currentCapability: "Defines design doctrine, gates, and mode-specific rules used by the dashboard and demo builds.",
    nextBuild: "Turn gates into automated UI audits and reusable client-demo page templates.",
    routes: ["/ops/tools/design-lab", "/ops/tools", "/ai/imagegen"],
    externalAdapters: ["Figma/Stitch when connected"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Makes craft repeatable, defendable, and easier to sell.",
  },
  {
    id: "content-engine",
    name: "Content Engine",
    category: "outreach",
    status: "planned",
    priority: 3,
    ownerAgent: "CONTENT",
    ownedCore: "Idea capture, scripts, posts, proof snippets, repurposing, and performance logging.",
    replaces: ["Buffer starter workflows", "manual content calendar"],
    moneyFunction: "Turns client proof and build logs into trust-building content.",
    currentCapability: "Content references exist in the operating model; no dedicated content pipeline yet.",
    nextBuild: "Add content pipeline stages, post drafts, schedule tasks, and performance metrics.",
    routes: ["/planner", "/analytics"],
    externalAdapters: ["Gmail", "social platforms later"],
    approvalRequired: true,
    risk: "medium",
    estimatedValue: "Builds inbound trust while outbound runs.",
  },
  {
    id: "personal-command",
    name: "Personal Command",
    category: "personal",
    status: "partial",
    priority: 2,
    ownerAgent: "HAMID",
    ownedCore: "Daily planning, family/personal tasks, focus blocks, goals, and founder load tracking.",
    replaces: ["separate todo app", "calendar scattered notes"],
    moneyFunction: "Protects the founder energy that the whole business depends on.",
    currentCapability: "Personal and planner pages exist with local schedule/task data.",
    nextBuild: "Add energy score, habit ledger, recovery planning, and AI weekly review.",
    routes: ["/personal", "/planner"],
    externalAdapters: ["Google Calendar when connected"],
    approvalRequired: false,
    risk: "low",
    estimatedValue: "Keeps a solo founder consistent enough to compound.",
  },
  {
    id: "market-desk",
    name: "Market Desk",
    category: "finance",
    status: "live",
    priority: 4,
    ownerAgent: "FINANCE",
    ownedCore: "Local watchlist surface for stocks, crypto, and market context inside the OS.",
    replaces: ["checking separate market tabs"],
    moneyFunction: "Keeps capital/trading awareness in the same control room without distracting the sales loop.",
    currentCapability: "Markets route shows live watchlist data when providers respond.",
    nextBuild: "Add alerts, thesis notes, portfolio positions, and risk limits.",
    routes: ["/markets"],
    externalAdapters: ["public market data"],
    approvalRequired: false,
    risk: "medium",
    estimatedValue: "Improves awareness while keeping the business command centre primary.",
  },
];

const patterns: ToolForgePattern[] = [
  {
    name: "Enrichment waterfall",
    source: "Clay",
    pattern: "Pull from multiple data sources, fill missing fields, score confidence, then route qualified records.",
    localVersion: "Lead Radar keeps the data model and scoring locally, using Firecrawl/Apify/Playwright only as adapters.",
  },
  {
    name: "Sales workspace",
    source: "HubSpot CRM",
    pattern: "A single client/deal record with activity, pipeline stage, notes, tasks, contacts, and automation.",
    localVersion: "Client 360 stores every proof point, task, proposal, demo, email, call, and memory in one file.",
  },
  {
    name: "Voice booking desk",
    source: "GoHighLevel-style voice AI workflows",
    pattern: "Inbound/outbound calls, booking, missed-call recovery, messages, and CRM updates work as one loop.",
    localVersion: "Voice Desk will connect Twilio, the owned voice brain, bookings, transcripts, and CRM memory.",
  },
  {
    name: "Realtime tool-calling assistant",
    source: "OpenAI Realtime/voice agents",
    pattern: "Voice sessions can listen, respond, and call tools through explicit schemas and guardrails.",
    localVersion: "Owned Voice Agent uses the local operator runtime first, then external voice transport as the interface.",
  },
];

const categoryMeta: Record<ToolForgeCategory, {label: string; mission: string}> = {
  acquisition: {
    label: "Acquisition",
    mission: "Find real businesses, prove what is broken, and create qualified opportunities.",
  },
  outreach: {
    label: "Outreach",
    mission: "Turn evidence into emails, follow-ups, replies, and booked conversations.",
  },
  delivery: {
    label: "Delivery",
    mission: "Create proof, demos, websites, videos, and handover assets that clients can buy.",
  },
  client: {
    label: "Client OS",
    mission: "Make every prospect and client file complete, searchable, and action-ready.",
  },
  voice: {
    label: "Voice",
    mission: "Answer calls, make calls, book work, and write conversations into memory.",
  },
  finance: {
    label: "Finance",
    mission: "Track money, API spend, invoices, payments, subscriptions, and cash pressure.",
  },
  personal: {
    label: "Personal",
    mission: "Keep Hamid healthy, focused, and consistent while the business compounds.",
  },
  ops: {
    label: "Operations",
    mission: "Coordinate tools, agents, approvals, health, and mission control.",
  },
};

function statusCount(status: ToolForgeStatus) {
  return tools.filter((tool) => tool.status === status).length;
}

export function buildToolForgePayload(input: BuildToolForgePayloadInput = {}): ToolForgePayload {
  const revenueLoopTools = tools.filter((tool) =>
    ["acquisition", "outreach", "delivery", "client", "voice", "finance"].includes(tool.category),
  );
  const coveredRevenueLoopTools = revenueLoopTools.filter((tool) =>
    ["live", "partial", "build-next"].includes(tool.status),
  );
  const categories = Object.entries(categoryMeta).map(([id, meta]) => {
    const categoryTools = tools.filter((tool) => tool.category === id);
    return {
      id: id as ToolForgeCategory,
      label: meta.label,
      mission: meta.mission,
      liveOrPartial: categoryTools.filter((tool) => tool.status === "live" || tool.status === "partial").length,
      total: categoryTools.length,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    thesis:
      "HAMID.OS should own the workflow logic, data model, guardrails, and client memory. External APIs are swappable adapters, not the business brain.",
    summary: {
      total: tools.length,
      live: statusCount("live"),
      partial: statusCount("partial"),
      buildNext: statusCount("build-next"),
      needsAdapter: statusCount("needs-adapter"),
      planned: statusCount("planned"),
      approvalGated: tools.filter((tool) => tool.approvalRequired).length,
      revenueLoopCoveragePct: Math.round((coveredRevenueLoopTools.length / Math.max(1, revenueLoopTools.length)) * 100),
      operatorToolCount: input.operatorToolCount ?? 0,
      pendingApprovals: input.pendingApprovals ?? 0,
    },
    buildPrinciples: [
      "Build local-first tools with clear schemas before adding another SaaS dependency.",
      "Every revenue tool must write proof, state, next action, and owner back into HAMID.OS.",
      "Any action that sends, spends, calls, deletes, or charges money stays approval-gated.",
      "Adapters can fail. The local client file, timeline, task queue, and decision log must survive.",
    ],
    categories,
    tools,
    buildQueue: tools
      .filter((tool) => tool.status === "build-next")
      .sort((left, right) => left.priority - right.priority),
    patterns,
  };
}
