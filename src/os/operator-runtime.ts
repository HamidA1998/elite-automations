import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {brand, outputDir} from "@/config";
import type {EliteOpsDatabase} from "@/database";
import {buildToolForgePayload} from "@/os/tool-forge";
import type {ClientTask} from "@/types";
import {uniqueId} from "@/utils";

type OperatorPriority = "low" | "medium" | "high" | "critical";
type OperatorEventTone = "neutral" | "live" | "warning" | "danger";
type OperatorAction =
  | {type: "navigate"; route: string; label: string}
  | {type: "refresh"; label: string}
  | {type: "approval"; approvalId: string; label: string}
  | {type: "open_record"; clientId: string; route: string; label: string};

type OperatorEvent = {
  id: string;
  at: string;
  label: string;
  detail: string;
  tone: OperatorEventTone;
  toolId?: string;
};

type OperatorSession = {
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
};

type OperatorApproval = {
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
};

type OperatorStore = {
  sessions: OperatorSession[];
  approvals: OperatorApproval[];
};

type OperatorMemory = {
  owner: string;
  systemName: string;
  operatingPrinciples: string[];
  guardedActions: string[];
  preferredTone: string;
  updatedAt: string;
};

type OperatorAccount = {
  clientId: string;
  businessName: string;
  businessType: string;
  area: string;
  phoneNumber: string | null;
  emailAddress: string | null;
  accountStatus: string;
  priority: string;
  siteScore: number;
  dealValue: number;
  nextActionNotes: string;
  health: string;
};

export type OperatorCommandInput = {
  message: string;
  source?: "voice" | "text" | "system";
  route?: string;
  visibleText?: string;
};

export type OperatorRuntimeDeps = {
  database: EliteOpsDatabase;
  buildDashboardState: () => Promise<unknown>;
  buildClient360Payload: () => unknown;
  triggerLeadSearch: (options: {maxQualified?: number; maxPerQuery?: number}) => Promise<unknown>;
  integrationStatusPayload: () => unknown;
  sendTransportStatus: () => {canSend: boolean; provider: string; missing: string[]};
};

const operatorDir = path.join(outputDir, "operator");
const storePath = path.join(operatorDir, "operator-store.json");
const memoryPath = path.join(operatorDir, "operator-memory.json");

const toolDefinitions = [
  {
    id: "get_dashboard_context",
    name: "Read command context",
    description: "Reads current metrics, CRM totals, integration status, and operating blockers.",
    risk: "safe",
    owner: "JARVIS",
  },
  {
    id: "open_page",
    name: "Open dashboard page",
    description: "Navigates inside HAMID.OS without touching outside systems.",
    risk: "safe",
    owner: "JARVIS",
  },
  {
    id: "search_clients",
    name: "Search client files",
    description: "Searches local CRM/client records and returns the strongest matches.",
    risk: "safe",
    owner: "JARVIS",
  },
  {
    id: "summarize_lead",
    name: "Summarise lead/client",
    description: "Reads a local client file and produces a practical next-action summary.",
    risk: "safe",
    owner: "JARVIS",
  },
  {
    id: "create_task",
    name: "Create internal task",
    description: "Adds a local task to a client file so the work becomes trackable.",
    risk: "internal-write",
    owner: "JARVIS",
  },
  {
    id: "draft_email",
    name: "Draft outreach email",
    description: "Creates a local draft only. It never sends externally from voice mode.",
    risk: "safe",
    owner: "OUTREACH",
  },
  {
    id: "run_acquisition",
    name: "Run acquisition",
    description: "Triggers lead acquisition. Requires approval because it can spend search/API budget.",
    risk: "approval-required",
    owner: "LEADGEN",
  },
  {
    id: "check_system_health",
    name: "Check system health",
    description: "Reads local connector and transport readiness.",
    risk: "safe",
    owner: "OPS",
  },
  {
    id: "inspect_tool_forge",
    name: "Inspect custom tools",
    description: "Reads the owned tool roadmap, money systems, build queue, and SaaS replacements.",
    risk: "safe",
    owner: "JARVIS",
  },
] as const;

const routeLexicon: Array<{route: string; label: string; terms: string[]}> = [
  {route: "/", label: "Command Centre", terms: ["home", "command", "dashboard", "centre", "center"]},
  {route: "/leads", label: "Leads Pipeline", terms: ["lead", "leads", "pipeline", "prospects"]},
  {route: "/crm", label: "CRM", terms: ["crm", "clients", "client", "accounts"]},
  {route: "/mail", label: "Mailbox", terms: ["mail", "email", "inbox", "gmail", "replies"]},
  {route: "/calls", label: "Calls Centre", terms: ["call", "calls", "twilio", "elevenlabs", "phone"]},
  {route: "/ops/tools", label: "Tool Forge", terms: ["tools", "tool forge", "custom tools", "owned tools", "forge", "replicate"]},
  {route: "/ops/tools/reply-radar", label: "Reply Radar", terms: ["reply radar", "replies", "reply", "inbox radar", "warm replies"]},
  {route: "/ops/tools/deal-room", label: "Deal Room", terms: ["deal room", "proposal room", "close room", "client portal"]},
  {route: "/ops/tools/owned-voice-agent", label: "Owned Voice Agent", terms: ["owned voice", "voice brain", "voice agent", "phone agent"]},
  {route: "/ops/tools/finance-guard", label: "Finance Guard", terms: ["finance guard", "cost caps", "spend guard", "money guard"]},
  {route: "/ops/tools/war-room", label: "War Room Intelligence", terms: ["war room", "strategy room", "batcomputer", "iron man", "irreplaceable", "command doctrine"]},
  {route: "/ops/tools/opportunity-engine", label: "Opportunity Engine", terms: ["opportunity", "opportunities", "next money", "money moves", "prioritise leads", "prioritize leads"]},
  {route: "/ops/tools/evidence-dossier", label: "Lead Evidence Dossier", terms: ["evidence dossier", "lead dossier", "client dossier", "lead evidence", "client evidence", "proof file"]},
  {route: "/ops/tools/proof-vault", label: "Proof Vault", terms: ["proof vault", "evidence", "screenshots", "audit proof", "proof pack"]},
  {route: "/ops/tools/design-lab", label: "Design Lab", terms: ["design lab", "design", "ui quality", "premium", "interface gates"]},
  {route: "/ops", label: "Mission Control", terms: ["ops", "operations", "mission", "control", "blockers"]},
  {route: "/ops/approvals", label: "Approvals", terms: ["approval", "approvals", "permission"]},
  {route: "/ops/automation", label: "Automation", terms: ["automation", "autopilot", "workflow", "workflows"]},
  {route: "/agents", label: "Agents", terms: ["agents", "jarvis", "operator", "openclaw"]},
  {route: "/planner", label: "Planner", terms: ["planner", "schedule", "today", "calendar", "plan"]},
  {route: "/markets", label: "Markets", terms: ["markets", "market", "stocks", "stock", "crypto", "bitcoin", "trading"]},
  {route: "/pay", label: "Revenue", terms: ["pay", "payment", "stripe", "revenue", "invoices", "invoice"]},
  {route: "/personal", label: "Personal OS", terms: ["personal", "life", "health", "family", "routine"]},
  {route: "/settings", label: "Settings", terms: ["settings", "configure", "api keys", "keys"]},
];

function nowIso() {
  return new Date().toISOString();
}

function emptyStore(): OperatorStore {
  return {sessions: [], approvals: []};
}

function defaultMemory(): OperatorMemory {
  return {
    owner: brand.ownerName,
    systemName: "HAMID.OS Elite Operator",
    operatingPrinciples: [
      "Use local records, logs, and typed tools before asking an AI model.",
      "Never pretend external work happened. Show proof, source, cost, and output.",
      "Anything that sends, spends, deletes, calls, or updates an outside system requires approval.",
      "Every command must end with a clear next action, a route, or a blocker.",
    ],
    guardedActions: [
      "Cold email sending",
      "Outbound calls and SMS",
      "Large Firecrawl/Apify acquisition runs",
      "Payments, invoices, refunds, or Stripe mutations",
      "Deleting client records or files",
    ],
    preferredTone: "Calm, precise, low-energy executive operator. No hype. No fake certainty.",
    updatedAt: nowIso(),
  };
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fsp.mkdir(path.dirname(filePath), {recursive: true});
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function routeFromMessage(message: string) {
  const lower = message.toLowerCase();
  return routeLexicon
    .map((entry) => ({
      ...entry,
      score: entry.terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0),
    }))
    .sort((left, right) => right.score - left.score)
    .find((entry) => entry.score > 0) ?? null;
}

function extractRequestedCount(message: string, fallback = 5) {
  const numbers = [...message.matchAll(/\b(\d{1,3})\b/g)].map((match) => Number(match[1]));
  const candidate = numbers.find((value) => Number.isFinite(value) && value > 0);
  return Math.max(1, Math.min(50, candidate ?? fallback));
}

function simpleWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9£\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function scoreAccount(account: OperatorAccount, message: string) {
  const haystack = [
    account.businessName,
    account.businessType,
    account.area,
    account.accountStatus,
    account.priority,
    account.nextActionNotes,
    account.emailAddress ?? "",
    account.phoneNumber ?? "",
  ].join(" ").toLowerCase();
  const words = simpleWords(message);
  const matchScore = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
  const urgency = account.priority === "high" ? 3 : account.health === "critical" ? 3 : account.health === "weak" ? 2 : 1;
  const valueScore = Math.min(4, Math.round((account.dealValue || 0) / 1000));
  return matchScore * 8 + urgency + valueScore + (account.siteScore <= 45 ? 2 : 0);
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asRoute(route: string) {
  return route.startsWith("/") ? route : `/${route}`;
}

export class EliteOperatorRuntime {
  constructor(private readonly deps: OperatorRuntimeDeps) {
    fs.mkdirSync(operatorDir, {recursive: true});
  }

  async getMemory() {
    const memory = await readJsonFile<OperatorMemory>(memoryPath, defaultMemory());
    await writeJsonFile(memoryPath, memory);
    return memory;
  }

  async getStore() {
    const store = await readJsonFile<OperatorStore>(storePath, emptyStore());
    return {
      sessions: Array.isArray(store.sessions) ? store.sessions : [],
      approvals: Array.isArray(store.approvals) ? store.approvals : [],
    };
  }

  private async saveStore(store: OperatorStore) {
    await writeJsonFile(storePath, {
      sessions: store.sessions.slice(0, 80),
      approvals: store.approvals.slice(0, 120),
    });
  }

  async status() {
    const store = await this.getStore();
    return {
      generatedAt: nowIso(),
      runtime: {
        id: "elite-operator-runtime",
        name: "Elite Operator Runtime",
        mode: "local-first",
        description: "Custom HAMID.OS orchestration layer. External APIs are adapters, not the brain.",
      },
      tools: toolDefinitions,
      guardrails: (await this.getMemory()).guardedActions,
      sessions: store.sessions.slice(0, 12),
      approvals: store.approvals.filter((approval) => approval.status === "pending"),
    };
  }

  async sessions() {
    const store = await this.getStore();
    return {sessions: store.sessions};
  }

  async approvals() {
    const store = await this.getStore();
    return {approvals: store.approvals};
  }

  private event(label: string, detail: string, tone: OperatorEventTone, toolId?: string): OperatorEvent {
    return {
      id: `EVT-${uniqueId(label, detail, String(Date.now()))}`,
      at: nowIso(),
      label,
      detail,
      tone,
      toolId,
    };
  }

  private findAccounts(message: string, limit = 6) {
    return (this.deps.database.getAccounts(1, 500) as OperatorAccount[])
      .map((account) => ({account, score: scoreAccount(account, message)}))
      .filter(({score}) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({account}) => account);
  }

  private highestPriorityAccount() {
    return (this.deps.database.getAccounts(1, 500) as OperatorAccount[])
      .sort((left, right) => {
        const leftScore = (left.priority === "high" ? 100 : 0) + (left.health === "critical" ? 60 : 0) + Math.max(0, 100 - left.siteScore);
        const rightScore = (right.priority === "high" ? 100 : 0) + (right.health === "critical" ? 60 : 0) + Math.max(0, 100 - right.siteScore);
        return rightScore - leftScore;
      })[0] ?? null;
  }

  private async createApproval(input: {
    sessionId: string;
    toolId: string;
    what: string;
    why: string;
    estimatedImpact: string;
    args: Record<string, unknown>;
  }) {
    const tool = toolDefinitions.find((entry) => entry.id === input.toolId);
    const approval: OperatorApproval = {
      id: `APP-${uniqueId(input.sessionId, input.toolId, String(Date.now()))}`,
      status: "pending",
      toolId: input.toolId,
      toolName: tool?.name ?? input.toolId,
      agent: "JARVIS",
      what: input.what,
      why: input.why,
      estimatedImpact: input.estimatedImpact,
      args: input.args,
      sessionId: input.sessionId,
      requestedAt: nowIso(),
      resolvedAt: null,
    };
    const store = await this.getStore();
    store.approvals = [approval, ...store.approvals];
    await this.saveStore(store);
    return approval;
  }

  private async executeTool(toolId: string, args: Record<string, unknown>, sessionId: string) {
    if (toolId === "get_dashboard_context") {
      const [state, client360, integrations] = await Promise.all([
        this.deps.buildDashboardState(),
        Promise.resolve(this.deps.buildClient360Payload()),
        Promise.resolve(this.deps.integrationStatusPayload()),
      ]);
      return {
        message: "Read live dashboard context.",
        data: {state, client360, integrations},
      };
    }

    if (toolId === "open_page") {
      const route = asRoute(safeString(args.route) || "/");
      return {
        message: `Opening ${route}.`,
        actions: [{type: "navigate", route, label: `Open ${route}`} satisfies OperatorAction],
      };
    }

    if (toolId === "search_clients") {
      const query = safeString(args.query) || "priority clients";
      const matches = this.findAccounts(query, 8);
      return {
        message: matches.length
          ? `Found ${matches.length} local client file${matches.length === 1 ? "" : "s"}.`
          : "No matching client files found locally.",
        data: matches,
        actions: matches[0]
          ? [{type: "open_record", clientId: matches[0].clientId, route: `/leads/${matches[0].clientId}`, label: `Open ${matches[0].businessName}`} satisfies OperatorAction]
          : [],
      };
    }

    if (toolId === "summarize_lead") {
      const clientId = safeString(args.clientId) || this.findAccounts(safeString(args.query), 1)[0]?.clientId || this.highestPriorityAccount()?.clientId;
      if (!clientId) throw new Error("No lead/client file is available to summarise.");
      const detail = this.deps.database.getAccountFull(clientId) as {account?: Record<string, unknown>; tasks?: unknown[]; timeline?: unknown[]; browserAudits?: unknown[]};
      const account = detail.account ?? {};
      const businessName = safeString(account.business_name) || clientId;
      const summary = [
        `${businessName} is a ${safeString(account.business_type) || "business"} in ${safeString(account.area) || "an unknown area"}.`,
        `Status: ${safeString(account.account_status) || "unknown"}. Score: ${String(account.site_score ?? 0)}/100.`,
        `Next action: ${safeString(account.next_action_notes) || "No next action recorded."}`,
        `Open tasks: ${detail.tasks?.length ?? 0}. Timeline entries: ${detail.timeline?.length ?? 0}. Browser audits: ${detail.browserAudits?.length ?? 0}.`,
      ].join(" ");
      return {
        message: summary,
        data: detail,
        actions: [{type: "open_record", clientId, route: `/leads/${clientId}`, label: `Open ${businessName}`} satisfies OperatorAction],
      };
    }

    if (toolId === "create_task") {
      const clientId = safeString(args.clientId) || this.findAccounts(safeString(args.query), 1)[0]?.clientId || this.highestPriorityAccount()?.clientId;
      if (!clientId) throw new Error("No client file is available to attach the task to.");
      const title = safeString(args.title) || "Operator follow-up";
      const dueDate = safeString(args.dueDate) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const task: ClientTask = {
        id: `TASK-${uniqueId(clientId, title, String(Date.now()))}`,
        title,
        description: safeString(args.description) || `Created from operator session ${sessionId}.`,
        status: "todo",
        priority: ["high", "medium", "low"].includes(safeString(args.priority)) ? safeString(args.priority) as ClientTask["priority"] : "medium",
        dueDate,
        owner: safeString(args.owner) || "JARVIS",
        lane: "operator",
        createdAt: nowIso(),
      };
      this.deps.database.insertTask(clientId, task);
      return {
        message: `Created task "${task.title}" for ${clientId}.`,
        data: task,
        actions: [{type: "open_record", clientId, route: `/leads/${clientId}`, label: "Open client file"} satisfies OperatorAction],
      };
    }

    if (toolId === "draft_email") {
      const client = this.findAccounts(safeString(args.query), 1)[0] ?? this.highestPriorityAccount();
      if (!client) throw new Error("No client file is available for a draft email.");
      const draft = {
        to: client.emailAddress ?? "contact email needed",
        subject: `Quick idea for ${client.businessName}`,
        body: [
          `Hi ${client.businessName} team,`,
          "",
          `I had a look at your online presence and noticed a few practical ways ${brand.businessName} could help you capture more enquiries without adding more admin.`,
          `The strongest immediate opportunity looks like: ${client.nextActionNotes || "tightening the website journey, proof, booking flow, and follow-up automation."}`,
          "",
          "I can send over a free visual demo showing what this could look like for your business.",
          "",
          `Best,`,
          brand.ownerName,
        ].join("\n"),
      };
      return {
        message: `Drafted a local outreach email for ${client.businessName}. It has not been sent.`,
        data: draft,
        actions: [{type: "open_record", clientId: client.clientId, route: `/leads/${client.clientId}`, label: "Open client file"} satisfies OperatorAction],
      };
    }

    if (toolId === "run_acquisition") {
      const maxLeads = Math.max(1, Math.min(50, Number(args.maxLeads ?? 5)));
      const status = await this.deps.triggerLeadSearch({maxQualified: maxLeads, maxPerQuery: Math.min(maxLeads, 10)});
      return {
        message: `Started acquisition for up to ${maxLeads} lead${maxLeads === 1 ? "" : "s"}.`,
        data: status,
        actions: [
          {type: "navigate", route: "/leads", label: "Open leads"} satisfies OperatorAction,
          {type: "refresh", label: "Refresh pipeline"} satisfies OperatorAction,
        ],
      };
    }

    if (toolId === "check_system_health") {
      const integrations = this.deps.integrationStatusPayload();
      const transport = this.deps.sendTransportStatus();
      return {
        message: "Checked local connector and sending readiness.",
        data: {integrations, transport},
      };
    }

    if (toolId === "inspect_tool_forge") {
      const status = await this.status();
      const forge = buildToolForgePayload({
        operatorToolCount: status.tools.length,
        pendingApprovals: status.approvals.length,
      });
      return {
        message: `Tool Forge has ${forge.summary.live} live tools, ${forge.summary.partial} partial tools, and ${forge.summary.buildNext} build-next systems. Next: ${forge.buildQueue[0]?.name ?? "no queued tool"}.`,
        data: forge,
        actions: [{type: "navigate", route: "/ops/tools", label: "Open Tool Forge"} satisfies OperatorAction],
      };
    }

    throw new Error(`Unknown operator tool: ${toolId}`);
  }

  private plan(message: string) {
    const lower = message.toLowerCase();
    const tools: Array<{toolId: string; args: Record<string, unknown>; rationale: string}> = [];
    const route = routeFromMessage(message);

    if (/\b(open|go to|show|take me|navigate)\b/.test(lower) && route) {
      tools.push({toolId: "open_page", args: {route: route.route}, rationale: `Hamid asked to open ${route.label}.`});
    }

    if (/\b(highest priority|most urgent|top priority|next lead|best lead|most important lead)\b/.test(lower)) {
      const account = this.highestPriorityAccount();
      if (account) {
        tools.push({toolId: "summarize_lead", args: {clientId: account.clientId}, rationale: "Hamid asked for the most important client/lead."});
      }
    }

    if (/\b(find|search|run|acquisition|scrape|new leads|lead search)\b/.test(lower)) {
      tools.push({
        toolId: "run_acquisition",
        args: {maxLeads: extractRequestedCount(message, 5)},
        rationale: "Hamid asked for a lead acquisition/search run.",
      });
    }

    if (/\b(draft|write|email|outreach)\b/.test(lower) && !/\b(send|sent)\b/.test(lower)) {
      tools.push({toolId: "draft_email", args: {query: message}, rationale: "Hamid asked for outreach drafting, not sending."});
    }

    if (/\b(task|todo|remind|follow up)\b/.test(lower) && /\b(create|add|make|log)\b/.test(lower)) {
      tools.push({
        toolId: "create_task",
        args: {
          query: message,
          title: message.replace(/\b(create|add|make|log|task|todo|remind me to)\b/gi, " ").trim().slice(0, 90) || "Operator follow-up",
          priority: lower.includes("urgent") || lower.includes("high") ? "high" : "medium",
        },
        rationale: "Hamid asked to create a local task.",
      });
    }

    if (/\b(status|health|connected|connectors|api|working|broken)\b/.test(lower)) {
      tools.push({toolId: "check_system_health", args: {}, rationale: "Hamid asked for system/API readiness."});
    }

    if (/\b(tool forge|custom tools|owned tools|tools to build|replicate|make money|money tools|build queue)\b/.test(lower)) {
      tools.push({toolId: "inspect_tool_forge", args: {}, rationale: "Hamid asked about custom tools, owned systems, or money-making build priorities."});
    }

    if (/\b(summarise|summarize|tell me about|what do we know|client file|lead file)\b/.test(lower)) {
      tools.push({toolId: "summarize_lead", args: {query: message}, rationale: "Hamid asked to inspect a local client file."});
    }

    if (!tools.length) {
      tools.push({toolId: "get_dashboard_context", args: {}, rationale: "No direct tool intent matched, so read the operating context first."});
      tools.push({toolId: "search_clients", args: {query: message}, rationale: "Search local records for related clients or work objects."});
    }

    const seen = new Set<string>();
    return tools.filter((tool) => {
      const key = `${tool.toolId}:${JSON.stringify(tool.args)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }

  private toolNeedsApproval(toolId: string, args: Record<string, unknown>) {
    if (toolId !== "run_acquisition") return null;
    const maxLeads = Math.max(1, Math.min(50, Number(args.maxLeads ?? 5)));
    return {
      what: `Run acquisition for up to ${maxLeads} lead${maxLeads === 1 ? "" : "s"}`,
      why: "This can spend Firecrawl/Apify/API budget and create new external research work.",
      estimatedImpact: maxLeads > 10 ? "High API/search usage" : "Low to moderate API/search usage",
    };
  }

  async runCommand(input: OperatorCommandInput) {
    const message = input.message.trim();
    if (!message) throw new Error("Command cannot be empty.");

    const sessionId = `OP-${uniqueId(message, String(Date.now()))}`;
    const events: OperatorEvent[] = [
      this.event("Command received", `${input.source ?? "text"} · ${message}`, "neutral"),
      this.event("Planner online", "Using local HAMID.OS tool registry before any external model.", "live"),
    ];
    const actions: OperatorAction[] = [];
    const outputs: string[] = [];
    let status: OperatorSession["status"] = "completed";

    const plannedTools = this.plan(message);
    events.push(this.event("Plan created", plannedTools.map((tool) => tool.toolId).join(" → "), "live"));

    for (const planned of plannedTools) {
      const approval = this.toolNeedsApproval(planned.toolId, planned.args);
      if (approval) {
        const pending = await this.createApproval({
          sessionId,
          toolId: planned.toolId,
          args: planned.args,
          ...approval,
        });
        status = "needs_approval";
        actions.push({type: "approval", approvalId: pending.id, label: `Review ${pending.toolName}`});
        events.push(this.event("Approval required", `${pending.what}. ${pending.why}`, "warning", planned.toolId));
        outputs.push(`${pending.what} needs approval before I run it.`);
        continue;
      }

      try {
        events.push(this.event("Tool started", `${planned.toolId}: ${planned.rationale}`, "neutral", planned.toolId));
        const result = await this.executeTool(planned.toolId, planned.args, sessionId) as {
          message?: string;
          actions?: OperatorAction[];
        };
        if (result.message) outputs.push(result.message);
        if (Array.isArray(result.actions)) actions.push(...result.actions);
        events.push(this.event("Tool completed", result.message ?? `${planned.toolId} completed.`, "live", planned.toolId));
      } catch (error) {
        status = "failed";
        const detail = error instanceof Error ? error.message : `${planned.toolId} failed.`;
        events.push(this.event("Tool failed", detail, "danger", planned.toolId));
        outputs.push(detail);
      }
    }

    const reply = outputs.length
      ? outputs.join(" ")
      : "I checked the operating layer, but there was no matching local tool action.";
    const finishedAt = nowIso();
    const session: OperatorSession = {
      id: sessionId,
      source: input.source ?? "text",
      status,
      message,
      route: input.route ?? "/",
      startedAt: events[0].at,
      finishedAt,
      reply,
      events,
      actions,
    };

    const store = await this.getStore();
    store.sessions = [session, ...store.sessions];
    await this.saveStore(store);

    return {
      session,
      reply,
      actions,
      approvals: (await this.getStore()).approvals.filter((approval) => approval.sessionId === sessionId && approval.status === "pending"),
    };
  }

  async resolveApproval(approvalId: string, decision: "approved" | "rejected") {
    const store = await this.getStore();
    const approval = store.approvals.find((entry) => entry.id === approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} was not found.`);
    if (approval.status !== "pending") return {approval, result: null};

    approval.status = decision;
    approval.resolvedAt = nowIso();
    let result: unknown = null;
    if (decision === "approved") {
      result = await this.executeTool(approval.toolId, approval.args, approval.sessionId);
    }
    await this.saveStore(store);
    return {approval, result};
  }
}
