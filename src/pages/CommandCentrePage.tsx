import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, SyntheticEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Aperture,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CalendarClock,
  CandlestickChart,
  CheckCircle2,
  CreditCard,
  Database,
  FileCheck2,
  Gauge,
  Globe2,
  ImageIcon,
  KeyRound,
  Layers3,
  Mail,
  MessageSquareText,
  Mic2,
  PhoneCall,
  Plus,
  RadioTower,
  Route,
  ScanLine,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import { ActivityFeed, type ActivityItem } from "@/components/features/ActivityFeed";
import { VoiceModePanel } from "@/components/features/VoiceModePanel";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ScheduleComposer } from "@/components/features/ScheduleComposer";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchAccounts,
  fetchDashboardState,
  fetchIntegrationsStatus,
  fetchMetrics,
  fetchOpenClawAgents,
  fetchOpenClawApprovals,
  apiUrl,
} from "@/services/api";
import { useScheduleStore } from "@/stores/schedule-store";
import type { OpenClawAgent } from "@/types/frontend";

interface HourlyAutomationSnapshot {
  config: {
    enabled: boolean;
    intervalMinutes: number;
    maxLeads: number;
    sendEmails: boolean;
  };
  state: {
    status: "idle" | "scheduled" | "running" | "completed" | "skipped" | "failed";
    nextRunAt: string | null;
    lastRunAt: string | null;
  };
  transport: {
    gmailConfigured: boolean;
    smtpConfigured: boolean;
    canSend: boolean;
    allowColdEmailSend: boolean;
  };
}

const COMMAND_ROOM_IMAGE = "/images/hamid-os-command-room.png";

async function fetchHourlyAutomation(): Promise<HourlyAutomationSnapshot> {
  const response = await fetch(apiUrl("/api/automation/hourly"));
  if (!response.ok) throw new Error("Hourly automation unavailable");
  return response.json() as Promise<HourlyAutomationSnapshot>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function streakFromItems(dates: string[]): number {
  const uniqueDates = Array.from(new Set(dates)).sort().reverse();
  let streak = 0;
  let cursor = new Date();
  while (uniqueDates.includes(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function actionHref(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("lead") || normalized.includes("source") || normalized.includes("client")) return "/ops/automation";
  if (normalized.includes("post") || normalized.includes("authority")) return "/mail/campaigns";
  if (normalized.includes("app") || normalized.includes("revenuecat")) return "/ops/health";
  if (normalized.includes("connect")) return "/ops/health";
  if (normalized.includes("priority") || normalized.includes("workout") || normalized.includes("review")) return "/planner";
  return "/ai";
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
    notation: value >= 10_000 ? "compact" : "standard",
  }).format(value);
}

function resolveAssetUrl(url: string | null | undefined) {
  if (!url) return COMMAND_ROOM_IMAGE;
  if (/^(file:|\/Users\/)/.test(url)) return COMMAND_ROOM_IMAGE;
  if (/^(https?:|data:|\/)/.test(url)) return url;
  return `/${url.replace(/^\.?\//, "")}`;
}

function fallbackToCommandRoom(event: SyntheticEvent<HTMLImageElement>) {
  if (event.currentTarget.src.endsWith(COMMAND_ROOM_IMAGE)) return;
  event.currentTarget.src = COMMAND_ROOM_IMAGE;
}

function connectorDetail(
  connector: { status: string; missingEnv: string[]; error: string | null } | undefined,
  connectedText: string,
  setupText: string,
) {
  if (!connector) return "Checking live status";
  if (connector.status === "connected") return connectedText;
  if (connector.missingEnv.length) return `Missing ${connector.missingEnv.slice(0, 2).join(", ")}`;
  return connector.error ?? setupText;
}

function laneMatch(
  status: string,
  account: { emailAddress: string | null; phoneNumber: string | null; nextActionNotes: string },
) {
  const normalized = status.toLowerCase();
  if (normalized.includes("won") || normalized.includes("closed")) return "won";
  if (normalized.includes("payment")) return "payment";
  if (normalized.includes("proposal")) return "proposal";
  if (normalized.includes("call") || normalized.includes("booked")) return "call";
  if (normalized.includes("follow")) return "follow";
  if (normalized.includes("email") || normalized.includes("message") || normalized.includes("contact")) return "message";
  if (!account.emailAddress && !account.phoneNumber) return "research";
  if (account.nextActionNotes) return "follow";
  return "new";
}

// ─── Entities ─────────────────────────────────────────────────────────────────

const ENTITIES = [
  { id: "elite",    label: "Elite Automations", color: "var(--color-accent)" },
  { id: "nurai",   label: "NurAI",              color: "#8b5cf6" },
  { id: "capital", label: "Capital",            color: "#f59e0b" },
  { id: "personal",label: "Personal",           color: "#10b981" },
] as const;

type EntityId = (typeof ENTITIES)[number]["id"];

// ─── Per-entity config ─────────────────────────────────────────────────────────

interface EntityMeta {
  kicker: string;
}

const ENTITY_META: Record<EntityId, EntityMeta> = {
  elite: {
    kicker: "Agency · Automation · Outreach",
  },
  nurai: {
    kicker: "iOS App · App Store · RevenueCat",
  },
  capital: {
    kicker: "Trading · Crypto · Polymarket",
  },
  personal: {
    kicker: "Health · Goals · Habits · Focus",
  },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function CommandCentrePage() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [activeEntity, setActiveEntity] = useState<EntityId>("elite");
  const [clock, setClock] = useState(new Date());
  const items = useScheduleStore((state) => state.items);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stateQuery = useQuery({ queryKey: ["dashboard-state"], queryFn: fetchDashboardState });
  const metricsQuery = useQuery({ queryKey: ["dashboard-metrics"], queryFn: fetchMetrics });
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const agentsQuery = useQuery({ queryKey: ["openclaw-agents"], queryFn: fetchOpenClawAgents, staleTime: 60_000 });
  const approvalsQuery = useQuery({ queryKey: ["openclaw-approvals"], queryFn: fetchOpenClawApprovals, staleTime: 30_000 });
  const integrationsQuery = useQuery({ queryKey: ["integrations-status"], queryFn: fetchIntegrationsStatus, staleTime: 60_000 });
  const hourlyQuery = useQuery({
    queryKey: ["hourly-automation"],
    queryFn: fetchHourlyAutomation,
    refetchInterval: 30_000,
    retry: 1,
  });

  const todayItems = useMemo(() => items.filter((item) => item.date === todayIso()), [items]);
  const completedOutreach = todayItems.filter(
    (item) => item.category === "Outreach" && item.completed,
  ).length;
  const streak = streakFromItems(
    items.filter((item) => item.category === "Outreach" && item.completed).map((item) => item.date),
  );

  const activityFeed = useMemo<ActivityItem[]>(() => {
    const scheduleFeed = items
      .slice()
      .sort((left, right) => `${right.date}T${right.time}`.localeCompare(`${left.date}T${left.time}`))
      .slice(0, 6)
      .map((item) => ({
        id: `schedule-${item.id}`,
        title: item.completed ? `${item.title} completed` : `${item.title} scheduled`,
        detail: `${item.category} block at ${item.time} on ${item.date}.`,
        timestampLabel: item.completed ? "Planner completion" : "Planner scheduled",
        timestampValue: `${item.date}T${item.time}:00`,
        type: "schedule" as const,
      }));

    const accountFeed = (accountsQuery.data?.accounts ?? [])
      .filter((account) => account.lastTimelineEventAt)
      .slice()
      .sort((left, right) =>
        String(right.lastTimelineEventAt).localeCompare(String(left.lastTimelineEventAt)),
      )
      .slice(0, 4)
      .map((account) => ({
        id: `lead-${account.clientId}`,
        title: account.businessName,
        detail: `${account.accountStatus} · ${account.area} · ${account.businessType}`,
        timestampLabel: new Date(String(account.lastTimelineEventAt)).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestampValue: String(account.lastTimelineEventAt),
        type: "lead" as const,
        href: `/leads/${account.clientId}`,
      }));

    return [...scheduleFeed, ...accountFeed]
      .sort((left, right) => right.timestampValue.localeCompare(left.timestampValue))
      .slice(0, 10);
  }, [accountsQuery.data?.accounts, items]);

  const pipelineCount = accountsQuery.data?.accounts?.length ?? 0;
  const weightedPipeline = Math.round(metricsQuery.data?.weightedPipeline ?? 0);
  const highPriorityFollowUps = stateQuery.data?.metrics.highPriorityFollowUps ?? 0;
  const entity = ENTITIES.find((e) => e.id === activeEntity)!;
  const meta = ENTITY_META[activeEntity];
  const connectorMap = new Map((integrationsQuery.data?.connectors ?? []).map((connector) => [connector.provider, connector]));
  const isConnected = (provider: string) => connectorMap.get(provider)?.status === "connected";
  const connectedConnectorCount = (integrationsQuery.data?.connectors ?? []).filter((connector) => connector.status === "connected").length;
  const totalConnectorCount = integrationsQuery.data?.connectors.length ?? 0;
  const hotLeads = accountsQuery.data?.accounts.filter((account) => account.priority.toLowerCase() === "high" || account.siteScore >= 70).length ?? 0;
  const missingContactData = accountsQuery.data?.accounts.filter((account) => !account.emailAddress && !account.phoneNumber).length ?? 0;
  const automationState = hourlyQuery.data?.state.status ?? "checking";
  const nextAutomationRun = hourlyQuery.data?.state.nextRunAt
    ? new Date(hourlyQuery.data.state.nextRunAt).toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"})
    : "Not scheduled";
  const connectedSignals = [
    Boolean(stateQuery.data?.sync.databasePath),
    Boolean(isConnected("gmail") || stateQuery.data?.sync.emailConnectorReady || hourlyQuery.data?.transport.gmailConfigured),
    Boolean(isConnected("twilio") && isConnected("elevenlabs")),
    Boolean(isConnected("stripe")),
  ].filter(Boolean).length;
  const proofPipelineStages = [
    {
      label: "Discover",
      owner: "LEADGEN",
      value: `${hourlyQuery.data?.config.maxLeads ?? 50}/hr`,
      detail: "Firecrawl + Apify prospect discovery",
      href: "/ops/automation",
      icon: Search,
      state: hourlyQuery.data?.config.enabled ? "live" : "warning",
    },
    {
      label: "Audit",
      owner: "OPS",
      value: `${pipelineCount}`,
      detail: "Website, reviews, contact data, conversion friction",
      href: "/leads",
      icon: FileCheck2,
      state: pipelineCount > 0 ? "live" : "warning",
    },
    {
      label: "Demo",
      owner: "BUILDER",
      value: `${stateQuery.data?.metrics.demosBuilt ?? 0}`,
      detail: "No-slop proof assets and website demos",
      href: "/vid",
      icon: Sparkles,
      state: (stateQuery.data?.metrics.demosBuilt ?? 0) > 0 ? "live" : "warning",
    },
    {
      label: "Outreach",
      owner: "OUTREACH",
      value: hourlyQuery.data?.transport.allowColdEmailSend ? "Live" : "Gate",
      detail: "Draft, approve, send, then watch replies",
      href: "/mail",
      icon: Mail,
      state: hourlyQuery.data?.transport.canSend ? "live" : "blocked",
    },
    {
      label: "Close",
      owner: "JARVIS",
      value: `£${weightedPipeline.toLocaleString("en-GB")}`,
      detail: "Proposals, payment links, delivery handoff",
      href: "/pay",
      icon: Target,
      state: weightedPipeline > 0 ? "live" : "warning",
    },
  ];
  const priorityAccounts = (accountsQuery.data?.accounts ?? [])
    .slice()
    .sort((left, right) =>
      Number(right.priority.toLowerCase() === "high") - Number(left.priority.toLowerCase() === "high")
      || right.siteScore - left.siteScore
      || String(right.lastTimelineEventAt ?? "").localeCompare(String(left.lastTimelineEventAt ?? "")),
    )
    .slice(0, 6);
  const activeAccount = priorityAccounts[0];
  const todaysSchedule = todayItems
    .slice()
    .sort((left, right) => left.time.localeCompare(right.time))
    .slice(0, 5);
  const revenuePath = priorityAccounts.length
    ? priorityAccounts
        .slice(0, 7)
        .map((account, index, list) => {
          const x = list.length === 1 ? 50 : (index / (list.length - 1)) * 100;
          const y = 88 - (account.siteScore / 100) * 68;
          return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ")
    : "M 0 78 L 18 64 L 36 68 L 54 42 L 72 48 L 100 24";
  const signalQueue = [
    {
      label: "Acquisition engine",
      value: automationState,
      detail: `Next run ${nextAutomationRun}`,
      href: "/ops/automation",
      state: hourlyQuery.data?.config.enabled ? "live" : "warning",
    },
    {
      label: "Follow-up pressure",
      value: highPriorityFollowUps,
      detail: "high-priority actions waiting",
      href: "/crm/activity",
      state: highPriorityFollowUps > 0 ? "warning" : "live",
    },
    {
      label: "Contact enrichment",
      value: missingContactData,
      detail: "records missing email and phone",
      href: "/leads",
      state: missingContactData > 0 ? "blocked" : "live",
    },
  ];
  const integrationRows = [
    { label: "CRM database", live: Boolean(stateQuery.data?.sync.databasePath), detail: stateQuery.data?.sync.databasePath ? "SQLite active" : "Checking", href: "/crm" },
    { label: "Gmail replies", live: isConnected("gmail"), detail: connectorDetail(connectorMap.get("gmail"), "OAuth synced", "Needs OAuth"), href: "/mail" },
    { label: "Calls", live: isConnected("twilio") && isConnected("elevenlabs"), detail: isConnected("twilio") ? connectorDetail(connectorMap.get("elevenlabs"), "Twilio + voice agent ready", "ElevenLabs needs setup") : connectorDetail(connectorMap.get("twilio"), "Twilio ready", "Twilio needs setup"), href: "/calls" },
    { label: "Payments", live: isConnected("stripe"), detail: connectorDetail(connectorMap.get("stripe"), "Stripe connected", "Needs Stripe key"), href: "/pay" },
    { label: "App subscriptions", live: isConnected("revenuecat"), detail: connectorDetail(connectorMap.get("revenuecat"), "RevenueCat connected", "Needs RevenueCat key"), href: "/ops/health" },
  ];
  const missionReadiness = Math.min(
    100,
    Math.round(
      connectedSignals * 14
      + Math.min(24, pipelineCount * 2)
      + Math.min(16, hotLeads * 3)
      + (hourlyQuery.data?.config.enabled ? 18 : 0)
      + (approvalsQuery.data?.pending.length ? 0 : 6),
    ),
  );
  const missionStatement = activeAccount
    ? `${activeAccount.businessName} is the sharpest next opportunity: ${activeAccount.siteScore}% score, ${compactMoney(activeAccount.dealValue)} potential, ${activeAccount.nextActionNotes || "needs a decisive next action"}.`
    : "Turn acquisition, proof, outreach, delivery, payments, calls, and personal focus into one controlled operating rhythm.";
  const missionHeadline = activeAccount
    ? `Close ${activeAccount.businessName}.`
    : "Run today's growth loop from proof to payment.";
  const apiUnlocks = [
    {
      label: "Lead intelligence",
      provider: "Firecrawl + Apify + Playwright",
      status: isConnected("firecrawl") && isConnected("apify") ? "Live" : "Needs connector",
      detail: "Search, inspect websites like a human, capture flaws, reviews, contact data, and proof opportunities.",
      href: "/ops/automation",
      live: Boolean(isConnected("firecrawl") && isConnected("apify")),
      icon: Search,
    },
    {
      label: "Email command",
      provider: "Gmail OAuth / SMTP",
      status: isConnected("gmail") || hourlyQuery.data?.transport.canSend ? "Ready" : "Needs OAuth",
      detail: "Send approved outreach, watch replies, and add conversations back into the client file.",
      href: "/mail",
      live: Boolean(isConnected("gmail") || hourlyQuery.data?.transport.canSend),
      icon: Mail,
    },
    {
      label: "Voice desk",
      provider: "Twilio + ElevenLabs",
      status: isConnected("twilio") && isConnected("elevenlabs") ? "Connected" : "Check tunnel",
      detail: "Inbound and outbound calls, call records, bookings, transcripts, and client memory.",
      href: "/calls",
      live: Boolean(isConnected("twilio") && isConnected("elevenlabs")),
      icon: PhoneCall,
    },
    {
      label: "Money rail",
      provider: "Stripe + Plaid/Open Banking",
      status: isConnected("stripe") && isConnected("plaid") ? "Live" : isConnected("stripe") ? "Stripe live" : "Needs keys",
      detail: "Invoices, payment links, subscriptions, cashflow, bank transactions, and revenue proof.",
      href: "/pay",
      live: Boolean(isConnected("stripe")),
      icon: CreditCard,
    },
    {
      label: "App economy",
      provider: "App Store Connect + RevenueCat",
      status: isConnected("revenuecat") && isConnected("appstore") ? "Live" : isConnected("revenuecat") ? "RevenueCat live" : "Needs keys",
      detail: "App metrics, subscriptions, trials, churn, reviews, and product revenue intelligence.",
      href: "/ops/health",
      live: Boolean(isConnected("revenuecat")),
      icon: Layers3,
    },
    {
      label: "Agent workforce",
      provider: "OpenClaw + OpenAI",
      status: isConnected("openclaw") && agentsQuery.data?.agents.length ? "Online" : "Needs gateway",
      detail: "JARVIS, OPS, Leadgen, Outreach, Builder, Content, Finance, and Support with approvals.",
      href: "/agents",
      live: Boolean(isConnected("openclaw") && agentsQuery.data?.agents.length),
      icon: Bot,
    },
  ];
  const operatingLoops = [
    {
      label: "Acquire",
      owner: "LEADGEN",
      value: `${pipelineCount}`,
      detail: "Find local businesses, enrich evidence, score fit.",
      href: "/ops/automation",
      icon: Search,
      active: Boolean(hourlyQuery.data?.config.enabled),
    },
    {
      label: "Diagnose",
      owner: "OPS",
      value: `${missingContactData}`,
      detail: "Website gaps, missing contacts, stale records.",
      href: "/leads",
      icon: ShieldCheck,
      active: missingContactData === 0,
    },
    {
      label: "Build proof",
      owner: "BUILDER",
      value: `${stateQuery.data?.metrics.demosBuilt ?? 0}`,
      detail: "Demo sites, images, scripts, video assets.",
      href: "/vid",
      icon: Workflow,
      active: (stateQuery.data?.metrics.demosBuilt ?? 0) > 0,
    },
    {
      label: "Close",
      owner: "JARVIS",
      value: compactMoney(weightedPipeline),
      detail: "Proposal, call, payment, delivery handoff.",
      href: "/pay",
      icon: Target,
      active: weightedPipeline > 0,
    },
    {
      label: "Life cadence",
      owner: "HAMID",
      value: `${todaysSchedule.length}`,
      detail: "Planner, habits, family, focus, recovery.",
      href: "/personal",
      icon: CalendarClock,
      active: todaysSchedule.length > 0,
    },
  ];
  const personalPulse = [
    { label: "Focus blocks", value: todaysSchedule.length ? `${todaysSchedule.length} today` : "Plan needed", href: "/planner" },
    { label: "Outreach target", value: `${completedOutreach}/10`, href: "/planner" },
    { label: "Streak", value: `${streak} days`, href: "/personal" },
  ];
  const commandMapNodes = [
    { label: "Lead radar", value: String(pipelineCount), x: 16, y: 32, state: pipelineCount > 0 ? "live" : "warning", icon: RadioTower },
    { label: "Proof lab", value: String(stateQuery.data?.metrics.demosBuilt ?? 0), x: 42, y: 22, state: (stateQuery.data?.metrics.demosBuilt ?? 0) > 0 ? "live" : "warning", icon: Aperture },
    { label: "Agents", value: String(agentsQuery.data?.agents.length ?? 0), x: 66, y: 42, state: (agentsQuery.data?.agents.length ?? 0) ? "live" : "warning", icon: Bot },
    { label: "Money", value: compactMoney(weightedPipeline), x: 78, y: 70, state: weightedPipeline > 0 ? "live" : "warning", icon: Gauge },
    { label: "Approvals", value: String(approvalsQuery.data?.pending.length ?? 0), x: 28, y: 72, state: (approvalsQuery.data?.pending.length ?? 0) > 0 ? "warning" : "live", icon: ShieldCheck },
  ];
  const proofAssets = (priorityAccounts.length ? priorityAccounts : accountsQuery.data?.accounts ?? [])
    .slice(0, 6)
    .map((account) => ({
      id: account.clientId,
      title: account.businessName,
      subtitle: `${account.area} · ${account.businessType}`,
      image: resolveAssetUrl(account.imageHero ?? account.imageServices),
      score: account.siteScore,
      value: compactMoney(account.dealValue),
      href: `/leads/${account.clientId}`,
      status: account.accountStatus,
    }));
  const capabilityMatrix = [
    { label: "Find", value: `${hourlyQuery.data?.config.maxLeads ?? 50}/hr`, detail: "Firecrawl, Apify, local research", href: "/ops/automation", live: Boolean(hourlyQuery.data?.config.enabled), icon: Search },
    { label: "Understand", value: `${pipelineCount}`, detail: "CRM, evidence dossiers, scores", href: "/crm", live: pipelineCount > 0, icon: ScanLine },
    { label: "Create", value: `${stateQuery.data?.metrics.demosBuilt ?? 0}`, detail: "Images, demos, videos, scripts", href: "/vid", live: (stateQuery.data?.metrics.demosBuilt ?? 0) > 0, icon: ImageIcon },
    { label: "Reach", value: hourlyQuery.data?.transport.canSend ? "Ready" : "Gate", detail: "Gmail, templates, replies", href: "/mail", live: Boolean(hourlyQuery.data?.transport.canSend || isConnected("gmail")), icon: Mail },
    { label: "Speak", value: isConnected("twilio") ? "Desk" : "Setup", detail: "Calls, agents, transcripts", href: "/calls", live: Boolean(isConnected("twilio") && isConnected("elevenlabs")), icon: PhoneCall },
    { label: "Close", value: compactMoney(weightedPipeline), detail: "Stripe, links, invoices", href: "/pay", live: Boolean(isConnected("stripe") || weightedPipeline > 0), icon: CreditCard },
    { label: "Operate", value: `${approvalsQuery.data?.pending.length ?? 0}`, detail: "Approvals, workflows, tools", href: "/ops", live: Boolean(agentsQuery.data?.agents.length), icon: Workflow },
    { label: "Watch", value: String(metricsQuery.data?.liveActivityCount ?? 0), detail: "Timeline, analytics, markets", href: "/timeline", live: Boolean(metricsQuery.data?.liveActivityCount), icon: Globe2 },
  ];
  const commandBand = [
    { label: "Active workspace", value: entity.label, detail: meta.kicker },
    { label: "Next acquisition run", value: nextAutomationRun, detail: automationState },
    { label: "Follow-up pressure", value: String(highPriorityFollowUps), detail: "high-priority actions waiting" },
    { label: "Enrichment gap", value: String(missingContactData), detail: "records without phone or email" },
  ];
  const topStats = [
    { label: "Weighted pipeline", value: compactMoney(weightedPipeline), detail: `${pipelineCount} live opportunities`, tone: "violet", icon: Wallet },
    { label: "Revenue collected", value: compactMoney(metricsQuery.data?.revenueCollected ?? 0), detail: "closed revenue tracked", tone: "green", icon: CreditCard },
    { label: "Active clients", value: String(pipelineCount), detail: `${hotLeads} hot leads`, tone: "blue", icon: Users },
    { label: "Projects in progress", value: String(stateQuery.data?.metrics.demosBuilt ?? 0), detail: "proof assets in motion", tone: "amber", icon: Sparkles },
    { label: "Pending approvals", value: String(approvalsQuery.data?.pending.length ?? 0), detail: "human-in-the-loop queue", tone: "rose", icon: AlertTriangle },
    { label: "Proposal stage", value: String(stateQuery.data?.metrics.proposalStage ?? 0), detail: "accounts near close", tone: "cyan", icon: Receipt },
    { label: "Average deal", value: compactMoney(metricsQuery.data?.averageDeal ?? 0), detail: "commercial benchmark", tone: "mint", icon: Target },
    { label: "Live activity", value: String(metricsQuery.data?.liveActivityCount ?? 0), detail: "tracked events this cycle", tone: "teal", icon: Bot },
  ];
  const pipelineLanes = [
    { id: "new", label: "New Leads" },
    { id: "research", label: "Need Research" },
    { id: "message", label: "Message Sent" },
    { id: "follow", label: "Follow-Up Needed" },
    { id: "call", label: "Call Booked" },
    { id: "proposal", label: "Proposal Sent" },
    { id: "payment", label: "Payment Pending" },
    { id: "won", label: "Won" },
  ].map((lane) => ({
    ...lane,
    items: (accountsQuery.data?.accounts ?? [])
      .filter((account) => laneMatch(account.accountStatus, account) === lane.id)
      .slice(0, 2),
  }));
  const agentCards = (agentsQuery.data?.agents ?? []).slice(0, 8);
  const lowerProjects = priorityAccounts.slice(0, 4);
  const automationCards = [
    {
      label: "Lead capture flow",
      state: hourlyQuery.data?.config.enabled ? "Active" : "Paused",
      detail: `Runs every ${hourlyQuery.data?.config.intervalMinutes ?? 60} minutes`,
      tone: hourlyQuery.data?.config.enabled ? "good" : "warn",
    },
    {
      label: "Contact enrichment",
      state: missingContactData > 0 ? "Needs work" : "Ready",
      detail: `${missingContactData} records missing core contact data`,
      tone: missingContactData > 0 ? "warn" : "good",
    },
    {
      label: "Email transport",
      state: hourlyQuery.data?.transport.canSend ? "Active" : "Blocked",
      detail: hourlyQuery.data?.transport.gmailConfigured ? "Gmail OAuth ready" : "Mail not configured",
      tone: hourlyQuery.data?.transport.canSend ? "good" : "bad",
    },
    {
      label: "Approval queue",
      state: `${approvalsQuery.data?.pending.length ?? 0} pending`,
      detail: "Sensitive actions held for approval",
      tone: (approvalsQuery.data?.pending.length ?? 0) > 0 ? "warn" : "good",
    },
  ];
  const quickActions = [
    { label: "Find new leads", href: "/ops/automation", tone: "violet", icon: Search },
    { label: "Send outreach", href: "/mail/compose", tone: "blue", icon: Mail },
    { label: "Create proposal", href: "/pay/links", tone: "green", icon: Receipt },
    { label: "Market watch", href: "/markets", tone: "cyan", icon: CandlestickChart },
    { label: "Launch agent task", href: "/agents", tone: "amber", icon: Bot },
  ];
  return (
    <>
      <PageWrapper
        density="compact"
        eyebrow="HAMID.OS · LIVE OPERATING DESK"
        title="Command Centre"
        description={`${clock.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} · ${clock.toLocaleTimeString("en-GB")} · ${connectedConnectorCount}/${totalConnectorCount || 0} live connectors`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setVoiceOpen(true)}>
              <Mic2 size={16} />
              Voice mode
            </Button>
            <Button variant="secondary" onClick={() => setComposerOpen(true)}>
              <Plus size={16} />
              Add task
            </Button>
            <Link to="/ops/automation">
              <Button>
                <Sparkles size={16} />
                Run acquisition
              </Button>
            </Link>
          </>
        }
      >
        <section className="executive-desktop executive-desktop--enterprise">
          <div className="executive-topbar">
            <div>
              <p className="section-kicker">Founder operating system</p>
              <h2>Revenue control room</h2>
              <p className="executive-topbar-copy">
                {pipelineCount} accounts · {hotLeads} hot leads · {approvalsQuery.data?.pending.length ?? 0} approvals · next run {nextAutomationRun}
              </p>
            </div>
            <div className="executive-topbar-actions">
              {ENTITIES.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setActiveEntity(e.id)}
                  className="executive-tab"
                  data-active={activeEntity === e.id ? "true" : undefined}
                  style={{ "--entity-color": e.color } as CSSProperties}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="executive-command-band">
            {commandBand.map((item) => (
              <div key={item.label} className="executive-command-chip">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>

          <div className="founder-command-grid">
            <section className="founder-mission-card">
              <div className="founder-mission-copy">
                <p className="section-kicker">Live operating priority</p>
                <h3>{missionHeadline}</h3>
                <p>{missionStatement}</p>
              </div>
              <div className="founder-mission-actions">
                <Link to="/ai" className="founder-primary-action">
                  <BrainCircuit size={17} />
                  Ask JARVIS
                </Link>
                <Link to="/ops/automation" className="founder-secondary-action">
                  <Sparkles size={17} />
                  Run growth loop
                </Link>
                <Link to="/personal" className="founder-secondary-action">
                  <CalendarClock size={17} />
                  Plan life
                </Link>
              </div>
              <div className="founder-theatre-map" aria-label="Live command map">
                <img
                  src={resolveAssetUrl(activeAccount?.imageHero ?? activeAccount?.imageServices)}
                  alt=""
                  onError={fallbackToCommandRoom}
                />
                <div className="founder-map-overlay">
                  <div className="founder-map-routes" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  {commandMapNodes.map((node) => {
                    const Icon = node.icon;
                    return (
                      <Link
                        key={node.label}
                        to={node.label === "Money" ? "/pay" : node.label === "Agents" ? "/agents" : node.label === "Proof lab" ? "/vid" : node.label === "Approvals" ? "/ops/approvals" : "/ops/automation"}
                        className="founder-map-node"
                        data-state={node.state}
                        style={{ "--map-x": `${node.x}%`, "--map-y": `${node.y}%` } as CSSProperties}
                      >
                        <Icon size={13} />
                        <strong>{node.value}</strong>
                        <span>{node.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="founder-readiness">
                <div className="founder-orbit" style={{ "--readiness": `${missionReadiness}%` } as CSSProperties}>
                  <span>{missionReadiness}</span>
                  <small>readiness</small>
                </div>
                <div className="founder-signal-stack">
                  {signalQueue.slice(0, 2).map((signal) => (
                    <Link key={signal.label} to={signal.href} className="founder-signal" data-state={signal.state}>
                      <span className="command-status-dot" data-state={signal.state === "blocked" ? "blocked" : signal.state === "warning" ? "warning" : undefined} />
                      <strong>{signal.label}</strong>
                      <small>{signal.value} · {signal.detail}</small>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <aside className="founder-api-card">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">API spine</p>
                  <h3>What unlocks the next level.</h3>
                </div>
                <KeyRound size={18} />
              </div>
              <div className="founder-api-list">
                {apiUnlocks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.label} to={item.href} className="founder-api-row" data-live={item.live ? "true" : undefined}>
                      <Icon size={16} />
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.provider}</small>
                        <p>{item.detail}</p>
                      </div>
                      <span>{item.status}</span>
                    </Link>
                  );
                })}
              </div>
            </aside>
          </div>

          <div className="founder-loop-grid">
            {operatingLoops.map((loop) => {
              const Icon = loop.icon;
              return (
                <Link key={loop.label} to={loop.href} className="founder-loop-card" data-active={loop.active ? "true" : undefined}>
                  <div className="founder-loop-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <span>{loop.owner}</span>
                    <strong>{loop.label}</strong>
                    <small>{loop.detail}</small>
                  </div>
                  <em>{loop.value}</em>
                </Link>
              );
            })}
          </div>

          <div className="founder-visual-grid">
            <section className="executive-panel inspo-panel founder-proof-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Visual proof layer</p>
                  <h3>Images, demos, and lead evidence that make the next move obvious.</h3>
                </div>
                <Link to="/vid/assets" className="executive-link">
                  Assets
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="founder-proof-grid">
                {proofAssets.length ? proofAssets.map((asset) => (
                  <Link key={asset.id} to={asset.href} className="founder-proof-card">
                    <img src={asset.image} alt="" loading="lazy" onError={fallbackToCommandRoom} />
                    <span className="founder-proof-score">{asset.score}% score</span>
                    <div>
                      <strong>{asset.title}</strong>
                      <small>{asset.subtitle}</small>
                    </div>
                    <footer>
                      <span>{asset.value}</span>
                      <em>{asset.status}</em>
                    </footer>
                  </Link>
                )) : (
                  <Link to="/ops/automation" className="founder-proof-empty">
                    <ImageIcon size={18} />
                    <strong>Run acquisition to fill the proof wall</strong>
                    <span>Lead images, service shots, demo assets, and evidence thumbnails will land here.</span>
                  </Link>
                )}
              </div>
            </section>

            <section className="executive-panel inspo-panel founder-capability-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Everything cockpit</p>
                  <h3>One board for every business function.</h3>
                </div>
                <Zap size={18} />
              </div>
              <div className="founder-capability-grid">
                {capabilityMatrix.map((capability) => {
                  const Icon = capability.icon;
                  return (
                    <Link key={capability.label} to={capability.href} className="founder-capability-card" data-live={capability.live ? "true" : undefined}>
                      <Icon size={16} />
                      <div>
                        <strong>{capability.label}</strong>
                        <small>{capability.detail}</small>
                      </div>
                      <span>{capability.value}</span>
                    </Link>
                  );
                })}
              </div>
              <Link to="/ai" className="founder-inspector-strip">
                <Route size={16} />
                <div>
                  <strong>Ask JARVIS to inspect the full system</strong>
                  <small>Summarise blockers, pick the next account, generate the message, then route to payment or delivery.</small>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            </section>
          </div>

          <div className="inspo-metric-grid">
            {topStats.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="inspo-metric-card" data-tone={metric.tone}>
                  <div className="inspo-metric-head">
                    <span>{metric.label}</span>
                    <Icon size={18} />
                  </div>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </div>
              );
            })}
          </div>

          <div className="inspo-central-grid">
            <section className="executive-panel inspo-panel inspo-pipeline-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Sales pipeline</p>
                  <h3>Move the next records with the highest commercial weight.</h3>
                </div>
                <Link to="/leads" className="executive-link">
                  View all
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="inspo-pipeline-board">
                {pipelineLanes.map((lane) => (
                  <div key={lane.id} className="inspo-lane">
                    <div className="inspo-lane-head">
                      <span>{lane.label}</span>
                      <strong>{lane.items.length}</strong>
                    </div>
                    <div className="inspo-lane-list">
                      {lane.items.length ? lane.items.map((account) => (
                        <Link key={account.clientId} to={`/leads/${account.clientId}`} className="inspo-lead-card">
                          <strong>{account.businessName}</strong>
                          <small>{compactMoney(account.dealValue)} · {account.area}</small>
                          <span>{new Date(account.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                        </Link>
                      )) : (
                        <div className="inspo-lane-empty">No live records</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="inspo-lane-footer">
                <span>AI Lead Score</span>
                <small>Leads are scored from live account records, contact completeness, and current pipeline movement.</small>
                <Link to="/analytics">View all insights</Link>
              </div>
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">AI agents control room</p>
                  <h3>Live workforce status, task pressure, and approvals.</h3>
                </div>
                <Link to="/agents" className="executive-link">
                  View all agents
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="inspo-agent-grid">
                {agentCards.length ? agentCards.map((agent: OpenClawAgent) => (
                  <Link key={agent.id} to="/agents" className="inspo-agent-card" data-state={agent.status}>
                    <div className="inspo-agent-head">
                      <strong>{agent.name.toUpperCase()}</strong>
                      <span className="command-status-dot" data-state={agent.status === "error" ? "blocked" : agent.status === "running-tool" ? "warning" : undefined} />
                    </div>
                    <small>{agent.role}</small>
                    <p>{agent.description || "Operational agent available in OpenClaw."}</p>
                    <div className="inspo-agent-meta">
                      <span>{agent.primaryModel ?? "Model not set"}</span>
                      <span>{agent.lastActivityAt ? new Date(agent.lastActivityAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "No activity"}</span>
                    </div>
                  </Link>
                )) : (
                  <div className="executive-empty">No live agents reported by OpenClaw.</div>
                )}
              </div>
              <div className="inspo-approval-bar">
                <span>Approval queue</span>
                <strong>{approvalsQuery.data?.pending.length ?? 0}</strong>
                <Link to="/ops/approvals">Review now</Link>
              </div>
            </section>
          </div>

          <div className="founder-intel-grid">
            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Proof factory route</p>
                  <h3>The exact path from prospect to paid deployment.</h3>
                </div>
                <Link to="/ops/workflows" className="executive-link">
                  Workflows
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="founder-stage-strip">
                {proofPipelineStages.map((stage) => {
                  const Icon = stage.icon;
                  return (
                    <Link key={stage.label} to={stage.href} className="founder-stage" data-state={stage.state}>
                      <Icon size={17} />
                      <span>{stage.owner}</span>
                      <strong>{stage.label}</strong>
                      <small>{stage.value} · {stage.detail}</small>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Personal operating layer</p>
                  <h3>Business only scales if the founder does.</h3>
                </div>
                <Link to="/personal" className="executive-link">
                  Open
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="founder-personal-grid">
                {personalPulse.map((item) => (
                  <Link key={item.label} to={item.href} className="founder-personal-tile">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </Link>
                ))}
              </div>
              <div className="founder-agenda-list">
                {todaysSchedule.length ? todaysSchedule.map((item) => (
                  <Link key={item.id} to="/planner" className="founder-agenda-row">
                    <time>{item.time}</time>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.category} · {item.priority}</small>
                    </div>
                    {item.completed ? <CheckCircle2 size={16} /> : <MessageSquareText size={16} />}
                  </Link>
                )) : (
                  <Link to="/planner" className="founder-agenda-row">
                    <time>Now</time>
                    <div>
                      <strong>Generate today’s plan</strong>
                      <small>Tell JARVIS what needs to happen and turn it into schedule blocks.</small>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Live commercial timeline</p>
                  <h3>Recent truth from schedule and client records.</h3>
                </div>
                <Database size={18} />
              </div>
              {stateQuery.isLoading || accountsQuery.isLoading ? (
                <div className="founder-skeleton-stack">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : activityFeed.length ? (
                <div className="founder-activity-wrap">
                  <ActivityFeed items={activityFeed.slice(0, 6)} />
                </div>
              ) : (
                <div className="executive-empty">No timeline events yet. Run the acquisition loop or add a schedule block.</div>
              )}
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Connected truth</p>
                  <h3>Data sources the cockpit trusts.</h3>
                </div>
                <CheckCircle2 size={18} />
              </div>
              <div className="founder-connector-grid">
                {integrationRows.map((row) => (
                  <Link key={row.label} to={row.href} className="founder-connector" data-live={row.live ? "true" : undefined}>
                    <span className="command-status-dot" data-state={row.live ? undefined : "warning"} />
                    <strong>{row.label}</strong>
                    <small>{row.detail}</small>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className="inspo-lower-grid">
            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Projects in progress</p>
                  <h3>Accounts currently closest to build or delivery.</h3>
                </div>
                <Link to="/crm/pipeline" className="executive-link">
                  View all
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="inspo-project-list">
                {lowerProjects.length ? lowerProjects.map((account) => (
                  <Link key={account.clientId} to={`/leads/${account.clientId}`} className="inspo-project-row">
                    <div>
                      <strong>{account.businessName}</strong>
                      <small>{account.businessType} · {account.area}</small>
                    </div>
                    <div className="inspo-progress">
                      <i style={{ width: `${Math.max(18, account.siteScore)}%` }} />
                      <span>{account.siteScore}%</span>
                    </div>
                  </Link>
                )) : (
                  <div className="executive-empty">No active projects yet.</div>
                )}
              </div>
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Automations hub</p>
                  <h3>Guarded flows and current workflow state.</h3>
                </div>
                <Link to="/ops/workflows" className="executive-link">
                  View all
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="inspo-automation-list">
                {automationCards.map((item) => (
                  <Link key={item.label} to="/ops/automation" className="inspo-automation-row" data-tone={item.tone}>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </div>
                    <span>{item.state}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Revenue overview</p>
                  <h3>{compactMoney(metricsQuery.data?.revenuePipeline ?? 0)}</h3>
                </div>
                <Link to="/pay" className="executive-link">
                  This month
                </Link>
              </div>
              <div className="executive-chart inspo-chart--compact">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="executiveChartFillCompact" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.34" />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${revenuePath} L 100 100 L 0 100 Z`} fill="url(#executiveChartFillCompact)" />
                  <path d={revenuePath} fill="none" stroke="var(--color-accent)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="executive-chart-readout">
                  <span>Outreach pace</span>
                  <strong>{completedOutreach}/10</strong>
                  <small>{streak} day streak</small>
                </div>
              </div>
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">War room</p>
                  <h3>Today’s focus</h3>
                </div>
                <Link to="/timeline" className="executive-link">
                  View all
                </Link>
              </div>
              <div className="inspo-war-grid">
                <div className="inspo-war-card">
                  <span>Today’s target</span>
                  <strong>{compactMoney(weightedPipeline)}</strong>
                  <small>{completedOutreach}/10 outreach target</small>
                </div>
                <div className="inspo-war-card">
                  <span>Hot leads to close</span>
                  <strong>{hotLeads}</strong>
                  <small>{stateQuery.data?.metrics.proposalStage ?? 0} in proposal stage</small>
                </div>
                <div className="inspo-war-card">
                  <span>Urgent problems</span>
                  <strong>{missingContactData + highPriorityFollowUps}</strong>
                  <small>enrichment + follow-up blockers</small>
                </div>
              </div>
            </section>

            <section className="executive-panel inspo-panel">
              <div className="executive-panel-head">
                <div>
                  <p className="section-kicker">Quick actions</p>
                  <h3>Trigger the next move immediately.</h3>
                </div>
              </div>
              <div className="inspo-quick-actions">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                  <Link key={action.label} to={action.href} className="inspo-quick-action" data-tone={action.tone}>
                    <span>
                      <Icon size={15} />
                      {action.label}
                    </span>
                    <ArrowUpRight size={14} />
                  </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      </PageWrapper>

      <Modal
        open={composerOpen}
        title="Add a schedule block"
        description="This powers the live What's Next card, the planner timeline, and browser notifications."
        onClose={() => setComposerOpen(false)}
      >
        <ScheduleComposer onCreated={() => setComposerOpen(false)} />
      </Modal>
      <VoiceModePanel open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </>
  );
}
