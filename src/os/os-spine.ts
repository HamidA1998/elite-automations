import type {
  Client360Account,
  OpenClawAgent,
  OpenClawApprovalsSnapshot,
} from "@/types/frontend";

export type OsObjectType =
  | "client"
  | "lead"
  | "agent"
  | "approval"
  | "call"
  | "mail"
  | "payment"
  | "task"
  | "project"
  | "command"
  | "route";

export type OsPriority = "low" | "medium" | "high" | "critical";

export type MissionStage = "inbox" | "planning" | "executing" | "reviewing" | "done";

export interface OsCommandItem {
  id: string;
  type: OsObjectType;
  title: string;
  subtitle: string;
  keywords: string[];
  href?: string;
  priority: OsPriority;
  actionId?: string;
}

export interface DossierMetric {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warning" | "danger";
}

export interface DossierSection {
  title: string;
  body: string;
  meta?: string;
}

export interface ObjectDossier {
  id: string;
  type: OsObjectType;
  title: string;
  subtitle: string;
  status: string;
  priority: OsPriority;
  href?: string;
  metrics: DossierMetric[];
  sections: DossierSection[];
  actions: Array<{
    label: string;
    href?: string;
    actionId?: string;
  }>;
}

export interface MissionCard {
  id: string;
  kind: "client" | "agent" | "approval" | "system";
  stage: MissionStage;
  title: string;
  subtitle: string;
  owner: string;
  priority: OsPriority;
  lastActionAt: string | null;
  statusLabel: string;
  impact: string;
  href?: string;
  stuck: boolean;
}

interface MissionInput {
  accounts: Client360Account[];
  agents: OpenClawAgent[];
  approvals: OpenClawApprovalsSnapshot | null;
  now?: Date;
}

const priorityWeight: Record<OsPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function minutesSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 60_000));
}

function accountPriority(account: Client360Account): OsPriority {
  if (account.overdueTasks > 0 || account.riskFlags.length > 1) return "critical";
  if (account.priority.toLowerCase() === "high" || account.relationshipScore >= 70) return "high";
  if (account.priority.toLowerCase() === "low") return "low";
  return "medium";
}

function accountStage(account: Client360Account): MissionStage {
  const status = account.accountStatus.toLowerCase();
  if (status.includes("closed") || status.includes("won")) return "done";
  if (account.proposalCount > 0 && account.openTasks === 0) return "reviewing";
  if (account.demoFile || account.emailFile) return "executing";
  return "planning";
}

function toneFromScore(score: number): DossierMetric["tone"] {
  if (score >= 75) return "good";
  if (score >= 55) return "warning";
  return "danger";
}

function scoreCommandItem(item: OsCommandItem, rawQuery: string): number {
  const query = normalize(rawQuery);
  if (!query) return priorityWeight[item.priority];

  const title = normalize(item.title);
  const subtitle = normalize(item.subtitle);
  const keywords = item.keywords.map(normalize);

  let score = 0;
  if (title === query) score += 100;
  if (title.startsWith(query)) score += 70;
  if (title.includes(query)) score += 45;
  if (subtitle.includes(query)) score += 30;
  if (keywords.some((keyword) => keyword === query)) score += 35;
  if (keywords.some((keyword) => keyword.includes(query))) score += 24;

  return score > 0 ? score + priorityWeight[item.priority] : 0;
}

export function filterCommandItems(items: OsCommandItem[], query: string): OsCommandItem[] {
  const queryText = normalize(query);
  if (!queryText) {
    return [...items].sort((left, right) => priorityWeight[right.priority] - priorityWeight[left.priority]);
  }

  return items
    .map((item) => ({
      item,
      score: scoreCommandItem(item, queryText),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
}

export function buildAccountDossier(account: Client360Account): ObjectDossier {
  const primaryContact = account.primaryContact
    ? `${account.primaryContact.fullName} · ${account.primaryContact.role}`
    : "No primary contact assigned";

  return {
    id: account.clientId,
    type: "client",
    title: account.businessName,
    subtitle: `${account.area} · ${account.businessType}`,
    status: account.accountStatus,
    priority: accountPriority(account),
    href: `/leads/${account.clientId}`,
    metrics: [
      { label: "Relationship", value: String(account.relationshipScore), tone: toneFromScore(account.relationshipScore) },
      { label: "Dossier", value: `${account.dossierCompleteness}%`, tone: toneFromScore(account.dossierCompleteness) },
      { label: "Pipeline", value: `£${Math.round(account.dealValue).toLocaleString("en-GB")}`, tone: "neutral" },
      { label: "Open tasks", value: String(account.openTasks), tone: account.overdueTasks > 0 ? "danger" : "neutral" },
    ],
    sections: [
      {
        title: "Next action",
        body: account.nextBestAction || account.nextActionNotes || "No next action recorded.",
        meta: account.dueDate ? `Due ${account.dueDate}` : "No due date",
      },
      {
        title: "Primary contact",
        body: primaryContact,
        meta: account.primaryContact?.email ?? account.primaryContact?.phone ?? "Contact research needed",
      },
      {
        title: "Risk",
        body: account.riskFlags.length > 0 ? account.riskFlags.join(" · ") : "No current risk flags.",
        meta: `${account.daysSinceLastActivity} days since latest activity`,
      },
    ],
    actions: [
      { label: "Open client file", href: `/leads/${account.clientId}` },
      { label: "View CRM", href: "/crm" },
      { label: "Ask JARVIS", href: "/agents" },
    ],
  };
}

export function buildCommandItems(input: {
  accounts: Client360Account[];
  agents: OpenClawAgent[];
  approvals: OpenClawApprovalsSnapshot | null;
}): OsCommandItem[] {
  const accountItems = input.accounts.map<OsCommandItem>((account) => ({
    id: `client-${account.clientId}`,
    type: "client",
    title: account.businessName,
    subtitle: `${account.area} · ${account.businessType} · ${account.accountStatus}`,
    keywords: [
      account.area,
      account.businessType,
      account.accountStatus,
      account.primaryContact?.fullName ?? "",
      account.primaryContact?.email ?? "",
      account.nextBestAction,
    ].filter(Boolean),
    href: `/leads/${account.clientId}`,
    priority: accountPriority(account),
  }));

  const agentItems = input.agents.map<OsCommandItem>((agent) => ({
    id: `agent-${agent.id}`,
    type: "agent",
    title: agent.name,
    subtitle: `${agent.role} · ${agent.status}`,
    keywords: [agent.id, agent.role, agent.description, agent.primaryModel ?? ""].filter(Boolean),
    href: "/agents",
    priority: agent.status === "error" ? "critical" : agent.status === "running-tool" ? "high" : "medium",
  }));

  const approvalItems = (input.approvals?.pending ?? []).map<OsCommandItem>((approval) => ({
    id: `approval-${approval.id}`,
    type: "approval",
    title: approval.command,
    subtitle: `${approval.agentId ?? "agent"} · ${approval.estimatedImpact}`,
    keywords: [approval.rationale, approval.agentId ?? "", approval.estimatedImpact].filter(Boolean),
    href: "/ops/approvals",
    priority: "critical",
  }));

  const actionItems: OsCommandItem[] = [
    {
      id: "action-new-account",
      type: "command",
      title: "Create new client account",
      subtitle: "Add a lead or customer to Client 360",
      keywords: ["new account", "client", "lead", "crm"],
      priority: "high",
      actionId: "new-account",
    },
    {
      id: "route-mission-control",
      type: "route",
      title: "Open Mission Control",
      subtitle: "Global work board, blockers, approvals, and agents",
      keywords: ["ops", "mission", "work board", "blocked"],
      priority: "high",
      href: "/ops",
    },
    {
      id: "route-mail",
      type: "route",
      title: "Open mailbox",
      subtitle: "Inbox, replies, outreach, and campaigns",
      keywords: ["gmail", "mail", "email", "reply"],
      priority: "medium",
      href: "/mail",
    },
    {
      id: "route-calls",
      type: "route",
      title: "Open call centre",
      subtitle: "Twilio logs, ElevenLabs agent, SMS, and dialer",
      keywords: ["twilio", "elevenlabs", "voice", "calls"],
      priority: "medium",
      href: "/calls",
    },
  ];

  return [...actionItems, ...approvalItems, ...accountItems, ...agentItems];
}

export function buildMissionCards({ accounts, agents, approvals, now = new Date() }: MissionInput): MissionCard[] {
  const approvalCards = (approvals?.pending ?? []).map<MissionCard>((approval) => ({
    id: `approval-${approval.id}`,
    kind: "approval",
    stage: "reviewing",
    title: approval.command,
    subtitle: approval.rationale,
    owner: approval.agentId ?? "OpenClaw",
    priority: "critical",
    lastActionAt: approval.requestedAt,
    statusLabel: "Awaiting Hamid",
    impact: approval.estimatedImpact,
    href: "/ops/approvals",
    stuck: false,
  }));

  const accountCards = accounts.slice(0, 18).map<MissionCard>((account) => ({
    id: `client-${account.clientId}`,
    kind: "client",
    stage: accountStage(account),
    title: account.businessName,
    subtitle: `${account.area} · ${account.nextBestAction}`,
    owner: account.proposalCount > 0 ? "OUTREACH" : "OPS",
    priority: accountPriority(account),
    lastActionAt: account.latestActivityAt,
    statusLabel: account.accountStatus,
    impact: `£${Math.round(account.dealValue).toLocaleString("en-GB")} · ${account.closeProbability}% close`,
    href: `/leads/${account.clientId}`,
    stuck: account.daysSinceLastActivity >= 5 || account.overdueTasks > 0,
  }));

  const agentCards = agents
    .filter((agent) => agent.status !== "idle")
    .map<MissionCard>((agent) => {
      const inactiveFor = minutesSince(agent.lastActivityAt, now);
      return {
        id: `agent-${agent.id}`,
        kind: "agent",
        stage: agent.status === "error" ? "reviewing" : "executing",
        title: agent.name,
        subtitle: agent.description || agent.role,
        owner: agent.id.toUpperCase(),
        priority: agent.status === "error" ? "critical" : "high",
        lastActionAt: agent.lastActivityAt,
        statusLabel: agent.status,
        impact: agent.primaryModel ? `Model ${agent.primaryModel}` : "Model not reported",
        href: "/agents",
        stuck: agent.status !== "error" && inactiveFor !== null && inactiveFor >= 30,
      };
    });

  return [...approvalCards, ...agentCards, ...accountCards].sort(
    (left, right) => priorityWeight[right.priority] - priorityWeight[left.priority],
  );
}
