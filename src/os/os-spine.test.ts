import assert from "node:assert/strict";
import {
  buildAccountDossier,
  buildMissionCards,
  filterCommandItems,
  type OsCommandItem,
} from "./os-spine";
import type { Client360Account, OpenClawAgent, OpenClawApprovalsSnapshot } from "@/types/frontend";

const account = {
  clientId: "client_1",
  businessName: "Apex Dental Studio",
  businessType: "Dental",
  area: "Manchester",
  websiteUrl: "https://apex.example",
  phoneNumber: "+441234",
  emailAddress: "hello@apex.example",
  googleRating: 4.7,
  reviewCount: 121,
  address: "1 King Street",
  accountStatus: "Qualified",
  priority: "high",
  dueDate: "2026-04-20",
  nextActionNotes: "Send demo and call the owner",
  siteScore: 62,
  dealValue: 2200,
  closeProbability: 65,
  sourceNotes: "Found via Firecrawl",
  imageHero: null,
  imageServices: null,
  demoFile: null,
  videoFile: null,
  emailFile: null,
  createdAt: "2026-04-18T08:00:00.000Z",
  updatedAt: "2026-04-18T09:00:00.000Z",
  lastTimelineEventAt: "2026-04-18T09:30:00.000Z",
  health: "Warm",
  lifecycle: "lead",
  contacts: [],
  primaryContact: {
    id: "contact_1",
    fullName: "Amira Shah",
    role: "Owner",
    email: "amira@apex.example",
    phone: "+441234",
    status: "decision-maker",
  },
  contactCount: 1,
  timelineCount: 4,
  callCount: 1,
  noteCount: 2,
  proposalCount: 1,
  openTasks: 2,
  overdueTasks: 1,
  blockedTasks: 0,
  latestActivityAt: "2026-04-18T09:30:00.000Z",
  daysSinceLastActivity: 2,
  relationshipScore: 74,
  dossierCompleteness: 82,
  relationshipBand: "stable",
  riskFlags: ["Proposal not sent"],
  nextBestAction: "Send demo and call the owner",
} satisfies Client360Account;

const agents: OpenClawAgent[] = [
  {
    id: "jarvis",
    name: "JARVIS",
    role: "CEO agent",
    workspace: null,
    agentDir: null,
    primaryModel: "gpt-5.4",
    fallbackModels: [],
    status: "running-tool",
    lastActivityAt: "2026-04-18T08:00:00.000Z",
    description: "Strategy and priorities",
  },
];

const approvals: OpenClawApprovalsSnapshot = {
  policyPath: "policy.json",
  pending: [
    {
      id: "approval_1",
      agentId: "outreach",
      command: "Send outbound email",
      rationale: "Lead replied positively",
      estimatedImpact: "External email to prospect",
      requestedAt: "2026-04-18T10:00:00.000Z",
    },
  ],
  policyRaw: null,
};

const searchItems: OsCommandItem[] = [
  {
    id: "client_1",
    type: "client",
    title: "Apex Dental Studio",
    subtitle: "Manchester dental lead",
    keywords: ["amira", "proposal"],
    href: "/leads/client_1",
    priority: "high",
  },
  {
    id: "agent_jarvis",
    type: "agent",
    title: "JARVIS",
    subtitle: "CEO agent",
    keywords: ["strategy"],
    href: "/agents",
    priority: "medium",
  },
];

assert.equal(filterCommandItems(searchItems, "amira")[0]?.id, "client_1");
assert.equal(filterCommandItems(searchItems, "ceo")[0]?.id, "agent_jarvis");
assert.equal(filterCommandItems(searchItems, "missing").length, 0);

const cards = buildMissionCards({
  accounts: [account],
  agents,
  approvals,
  now: new Date("2026-04-18T11:00:00.000Z"),
});

assert.equal(cards.some((card) => card.stage === "reviewing" && card.kind === "approval"), true);
assert.equal(cards.some((card) => card.stage === "executing" && card.stuck), true);
assert.equal(cards.some((card) => card.stage === "planning" && card.title.includes("Apex")), true);

const dossier = buildAccountDossier(account);
assert.equal(dossier.title, "Apex Dental Studio");
assert.equal(dossier.sections.some((section) => section.title === "Next action"), true);
assert.equal(dossier.metrics.find((metric) => metric.label === "Relationship")?.value, "74");

console.log("os-spine tests passed");
