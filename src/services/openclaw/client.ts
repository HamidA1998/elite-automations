import {EventEmitter} from "node:events";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {z} from "zod";

import {openClawConfig} from "@/services/openclaw/config";

const gatewayAgentsSchema = z.object({
  agents: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    workspace: z.string().optional(),
    agentDir: z.string().optional(),
    model: z.union([
      z.string(),
      z.object({
        primary: z.string().optional(),
        fallbacks: z.array(z.string()).optional(),
      }),
    ]).optional(),
    identity: z.object({
      name: z.string().optional(),
      theme: z.string().optional(),
      emoji: z.string().optional(),
      avatar: z.string().optional(),
    }).optional(),
  })).default([]),
  defaultId: z.string().optional(),
});

const gatewaySessionsSchema = z.object({
  sessions: z.array(z.object({
    key: z.string(),
    label: z.string().optional(),
    startedAt: z.number().optional(),
    updatedAt: z.number().optional(),
    endedAt: z.number().nullable().optional(),
    status: z.string().optional(),
    messageCount: z.number().optional(),
    lastMessage: z.object({
      role: z.string().optional(),
      text: z.string().optional(),
    }).optional().nullable(),
  })).default([]),
});

const gatewayHistorySchema = z.object({
  messages: z.array(z.object({
    role: z.string().optional(),
    timestamp: z.number().optional(),
    content: z.unknown().optional(),
  })).default([]),
});

const gatewayHealthSchema = z.object({
  status: z.string().optional(),
}).passthrough();

const gatewaySkillsSchema = z.object({
  skills: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean().optional(),
    source: z.string().optional(),
    pluginId: z.string().optional(),
    requiredEnv: z.array(z.string()).optional(),
  })).default([]),
});

const gatewayApprovalSnapshotSchema = z.object({
  pending: z.array(z.object({
    id: z.string(),
    command: z.string().optional(),
    agentId: z.string().optional(),
    requestedAt: z.number().optional(),
    reason: z.string().optional(),
  })).optional(),
}).passthrough();

const openClawGatewayEventSchema = z.object({
  type: z.string(),
  event: z.string().optional(),
  payload: z.unknown().optional(),
  seq: z.number().optional(),
});

const sendParamsSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().optional(),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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

export interface OpenClawActivityEvent {
  id: string;
  at: string;
  agentId: string | null;
  sessionKey: string | null;
  type: "message" | "tool_call" | "error" | "system" | "approval" | "webhook";
  title: string;
  detail: string;
  impact: string;
  raw?: Record<string, unknown>;
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

export class OpenClawGatewayError extends Error {
  code: string;
  details: unknown;

  constructor(message: string, code = "OPENCLAW_ERROR", details?: unknown) {
    super(message);
    this.name = "OpenClawGatewayError";
    this.code = code;
    this.details = details;
  }
}

interface GatewayRequestOptions {
  method: string;
  params?: Record<string, unknown>;
  scopes?: string[];
}

function trimText(value: string, max = 240) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function toIsoFromMs(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function detectStatusFromEventText(text: string): OpenClawAgent["status"] {
  const lower = text.toLowerCase();
  if (lower.includes("error") || lower.includes("failed")) return "error";
  if (lower.includes("tool")) return "running-tool";
  if (lower.includes("thinking")) return "thinking";
  return "idle";
}

function parseAgentDescription(markdown: string) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => line.startsWith("#"))?.replace(/^#+\s*/, "") ?? "";
  const body = lines.find((line) => !line.startsWith("#") && !line.startsWith("```") && !line.startsWith("- ")) ?? "";
  return {
    title,
    body: trimText(body, 220),
  };
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string") {
          return entry.text;
        }
        if (entry && typeof entry === "object" && "thinking" in entry && typeof entry.thinking === "string") {
          return entry.thinking;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
    return content.text;
  }
  return "";
}

async function pathExists(filePath: string) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(filePath: string) {
  try {
    return await fsp.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function listFilesRecursive(root: string, matcher: (filePath: string) => boolean) {
  const files: string[] = [];
  async function visit(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(current, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (matcher(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  await visit(root);
  return files;
}

async function readOpenClawConfig() {
  return readJsonSafe<Record<string, unknown>>(openClawConfig.configFile, {});
}

async function readConfiguredAgents() {
  const config = await readOpenClawConfig();
  return gatewayAgentsSchema.parse({
    agents: Array.isArray((config.agents as Record<string, unknown> | undefined)?.list)
      ? (config.agents as {list: unknown[]}).list
      : [],
    defaultId: (config.agents as Record<string, unknown> | undefined)?.defaultId,
  }).agents;
}

function resolveAgentSessionDir(agentId: string) {
  return path.join(openClawConfig.agentsDir, agentId, "sessions");
}

function resolveWorkspaceAgentFile(agentId: string) {
  return path.join(openClawConfig.workspaceDir, "agents", agentId, "AGENTS.md");
}

function buildSessionKey(agentId: string, sessionId?: string) {
  if (sessionId) return sessionId;
  return agentId === "main" ? "main" : `agent:${agentId}:main`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return await new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

async function gatewayRequest<T>(options: GatewayRequestOptions, parser: z.ZodType<T>): Promise<T> {
  if (typeof WebSocket === "undefined") {
    throw new OpenClawGatewayError("WebSocket is not available in this runtime.", "NO_WEBSOCKET");
  }

  const requestId = crypto.randomUUID();
  const connectId = crypto.randomUUID();
  const ws = new WebSocket(openClawConfig.wsUrl);

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    let connectSent = false;
    const timer = setTimeout(() => {
      finish(new OpenClawGatewayError(`OpenClaw request timed out for ${options.method}.`, "TIMEOUT"));
    }, 12_000);

    const finish = (result: T | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    ws.addEventListener("message", (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data ?? ""));
      } catch {
        return;
      }

      const parsedEvent = openClawGatewayEventSchema.safeParse(payload);
      if (!parsedEvent.success) return;
      const frame = parsedEvent.data;

      if (frame.type === "event" && frame.event === "connect.challenge" && !connectSent) {
        connectSent = true;
        const nonce = frame.payload && typeof frame.payload === "object" && "nonce" in frame.payload && typeof frame.payload.nonce === "string"
          ? frame.payload.nonce
          : "";
        ws.send(JSON.stringify({
          type: "req",
          id: connectId,
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "elite-automations",
              version: "0.1.0",
              platform: process.platform,
              mode: "operator",
            },
            role: "operator",
            scopes: options.scopes ?? ["operator.read", "operator.write", "operator.approvals"],
            caps: ["tool-events"],
            auth: openClawConfig.token ? {token: openClawConfig.token} : undefined,
            locale: "en-GB",
            userAgent: "elite-automations/0.1.0",
            device: {
              id: `elite-automations-${os.hostname()}`,
              nonce,
              signedAt: Date.now(),
            },
          },
        }));
        return;
      }

      if (frame.type !== "res" || !("id" in (payload as Record<string, unknown>))) return;
      const response = payload as {id?: string; ok?: boolean; payload?: unknown; error?: {message?: string; code?: string; details?: unknown}};
      if (response.id === connectId) {
        if (!response.ok) {
          finish(new OpenClawGatewayError(
            response.error?.message ?? "OpenClaw gateway connect failed.",
            response.error?.code ?? "CONNECT_FAILED",
            response.error?.details,
          ));
          return;
        }
        ws.send(JSON.stringify({
          type: "req",
          id: requestId,
          method: options.method,
          params: options.params ?? {},
        }));
        return;
      }
      if (response.id !== requestId) return;
      if (!response.ok) {
        finish(new OpenClawGatewayError(
          response.error?.message ?? `OpenClaw method ${options.method} failed.`,
          response.error?.code ?? "REQUEST_FAILED",
          response.error?.details,
        ));
        return;
      }
      const parsed = parser.safeParse(response.payload ?? {});
      if (!parsed.success) {
        finish(new OpenClawGatewayError(
          `OpenClaw response for ${options.method} did not match the expected shape.`,
          "PARSE_FAILED",
          parsed.error.flatten(),
        ));
        return;
      }
      finish(parsed.data);
    });

    ws.addEventListener("error", () => {
      finish(new OpenClawGatewayError(`Unable to connect to OpenClaw at ${openClawConfig.wsUrl}.`, "CONNECTION_ERROR"));
    });

    ws.addEventListener("close", () => {
      if (!settled) {
        finish(new OpenClawGatewayError("OpenClaw connection closed before the request completed.", "CONNECTION_CLOSED"));
      }
    });
  });
}

async function getDiskUsagePct() {
  try {
    const stat = await fsp.statfs(openClawConfig.homeDir);
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bfree) * Number(stat.bsize);
    if (!total) return 0;
    return Math.round(((total - free) / total) * 100);
  } catch {
    return 0;
  }
}

async function parseSessionTranscripts(agentId: string, sessionFile: string) {
  const text = await readFileSafe(sessionFile);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const messages: OpenClawSessionDetail["messages"] = [];
  const tools: OpenClawSessionDetail["tools"] = [];

  for (const line of lines) {
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = typeof row.type === "string" ? row.type : "";
    const timestamp = typeof row.timestamp === "string" ? row.timestamp : null;
    const id = typeof row.id === "string" ? row.id : crypto.randomUUID();

    if (type === "message" && row.message && typeof row.message === "object") {
      const message = row.message as Record<string, unknown>;
      messages.push({
        id,
        role: typeof message.role === "string" ? message.role : "unknown",
        at: timestamp,
        text: extractTextContent(message.content),
      });
      continue;
    }

    if (type === "custom") {
      const customType = typeof row.customType === "string" ? row.customType : "custom";
      tools.push({
        id,
        at: timestamp,
        name: customType,
        outcome: customType.includes("error") ? "error" : "info",
        summary: trimText(JSON.stringify(row.data ?? {}), 220),
      });
      continue;
    }

    if (type && type !== "session") {
      tools.push({
        id,
        at: timestamp,
        name: type,
        outcome: type.includes("error") ? "error" : "info",
        summary: `${agentId} ${type.replace(/_/g, " ")}`,
      });
    }
  }

  return {messages, tools};
}

async function listLocalSessions(): Promise<OpenClawSessionSummary[]> {
  let agentEntries: fs.Dirent[] = [];
  try {
    agentEntries = await fsp.readdir(openClawConfig.agentsDir, {withFileTypes: true});
  } catch {
    return [];
  }

  const sessions: OpenClawSessionSummary[] = [];

  for (const entry of agentEntries) {
    if (!entry.isDirectory()) continue;
    const agentId = entry.name;
    const sessionIndexPath = path.join(resolveAgentSessionDir(agentId), "sessions.json");
    const sessionIndex = await readJsonSafe<Record<string, Record<string, unknown>>>(sessionIndexPath, {});

    for (const [sessionKey, meta] of Object.entries(sessionIndex)) {
      const updatedAt = typeof meta.updatedAt === "number" ? meta.updatedAt : undefined;
      const createdAt = typeof meta.createdAt === "number" ? meta.createdAt : updatedAt;
      const lastChannel = typeof meta.channel === "string"
        ? meta.channel
        : typeof meta.lastChannel === "string"
          ? meta.lastChannel
          : "local";
      sessions.push({
        id: sessionKey,
        sessionKey,
        agentId,
        agentName: agentId,
        channel: lastChannel,
        startedAt: toIsoFromMs(createdAt),
        lastActivityAt: toIsoFromMs(updatedAt),
        status: typeof meta.endedAt === "number" ? "completed" : "active",
        messageCount: typeof meta.messageCount === "number" ? meta.messageCount : 0,
        lastMessage: typeof meta.preview === "string" ? meta.preview : "",
      });
    }
  }

  return sessions.sort((left, right) => (right.lastActivityAt ?? "").localeCompare(left.lastActivityAt ?? ""));
}

async function scanApprovalsFile() {
  const policyRaw = await readFileSafe(openClawConfig.approvalsFile);
  return {
    policyRaw: policyRaw
      ? policyRaw.replace(/("token"\s*:\s*")([^"]+)(")/g, "$1[redacted]$3")
      : null,
  };
}

export class OpenClawService extends EventEmitter {
  private recentEvents: OpenClawActivityEvent[] = [];
  private pendingApprovals = new Map<string, OpenClawApprovalsSnapshot["pending"][number]>();
  private systemHistory = {
    cpuLoad: [] as number[],
    memoryUsedPct: [] as number[],
    diskUsedPct: [] as number[],
  };
  private watcherStarted = false;

  start() {
    if (this.watcherStarted) return;
    this.watcherStarted = true;
    void this.captureSystemStats();
    setInterval(() => void this.captureSystemStats(), 30_000).unref();
    setInterval(() => void this.scanRecentSessionActivity(), 8_000).unref();
    void this.connectLiveGateway();
  }

  subscribe(listener: (event: OpenClawActivityEvent) => void) {
    this.on("activity", listener);
    return () => this.off("activity", listener);
  }

  getRecentEvents(limit = 80) {
    return this.recentEvents.slice(0, limit);
  }

  private pushEvent(event: OpenClawActivityEvent) {
    this.recentEvents = [event, ...this.recentEvents].slice(0, 300);
    if (event.type === "approval" && event.raw?.approvalId && typeof event.raw.approvalId === "string") {
      this.pendingApprovals.set(event.raw.approvalId, {
        id: event.raw.approvalId,
        agentId: event.agentId,
        command: event.title,
        rationale: event.detail,
        estimatedImpact: event.impact,
        requestedAt: event.at,
      });
    }
    if (event.type === "system" && event.raw?.approvalId && typeof event.raw.approvalId === "string") {
      this.pendingApprovals.delete(event.raw.approvalId);
    }
    this.emit("activity", event);
  }

  private async captureSystemStats() {
    const cpuLoad = Math.min(100, Math.round((os.loadavg()[0] / Math.max(os.cpus().length, 1)) * 100));
    const memoryUsedPct = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
    const diskUsedPct = await getDiskUsagePct();
    this.systemHistory.cpuLoad = [...this.systemHistory.cpuLoad, cpuLoad].slice(-30);
    this.systemHistory.memoryUsedPct = [...this.systemHistory.memoryUsedPct, memoryUsedPct].slice(-30);
    this.systemHistory.diskUsedPct = [...this.systemHistory.diskUsedPct, diskUsedPct].slice(-30);
  }

  async listAgents(): Promise<OpenClawAgent[]> {
    const rawAgents = await readConfiguredAgents();

    const sessions = await withTimeout(this.listSessions(), 1200, [] as OpenClawSessionSummary[]);
    const latestByAgent = new Map<string, OpenClawSessionSummary>();
    for (const session of sessions) {
      const current = latestByAgent.get(session.agentId);
      if (!current || (session.lastActivityAt ?? "") > (current.lastActivityAt ?? "")) {
        latestByAgent.set(session.agentId, session);
      }
    }

    return await Promise.all(rawAgents.map(async (agent) => {
      const identityPath = resolveWorkspaceAgentFile(agent.id);
      const identityText = await readFileSafe(identityPath);
      const parsedIdentity = parseAgentDescription(identityText);
      const latest = latestByAgent.get(agent.id);
      const model = typeof agent.model === "string" ? {primary: agent.model, fallbacks: []} : agent.model;
      return {
        id: agent.id,
        name: agent.identity?.name ?? agent.name ?? parsedIdentity.title ?? agent.id,
        role: parsedIdentity.title || agent.id,
        workspace: agent.workspace ?? null,
        agentDir: agent.agentDir ?? null,
        primaryModel: model?.primary ?? null,
        fallbackModels: model?.fallbacks ?? [],
        status: latest ? detectStatusFromEventText(`${latest.status} ${latest.lastMessage}`) : "idle",
        lastActivityAt: latest?.lastActivityAt ?? null,
        description: parsedIdentity.body || `OpenClaw agent ${agent.id}`,
      };
    }));
  }

  async getAgentConfig(agentId: string): Promise<OpenClawAgentConfig> {
    const agents = await this.listAgents();
    const agent = agents.find((entry) => entry.id === agentId);
    if (!agent) throw new OpenClawGatewayError(`Agent ${agentId} was not found.`, "AGENT_NOT_FOUND");

    const identityFilePath = resolveWorkspaceAgentFile(agentId);
    const identityText = await readFileSafe(identityFilePath);
    let skills: OpenClawAgentConfig["skills"] = [];
    try {
      const skillStatus = await gatewayRequest({method: "skills.status", params: {agentId}, scopes: ["operator.read"]}, gatewaySkillsSchema);
      skills = skillStatus.skills.map((skill) => ({
        name: skill.name,
        description: skill.description ?? "",
        enabled: skill.enabled ?? true,
        target: skill.pluginId ?? (skill.requiredEnv?.length ? skill.requiredEnv.join(", ") : null),
      }));
    } catch {
      // fall back to empty skills list if gateway lookup is unavailable
    }

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      primaryModel: agent.primaryModel,
      fallbackModels: agent.fallbackModels,
      identityFilePath: await pathExists(identityFilePath) ? identityFilePath : null,
      identityText,
      tools: skills.map((skill) => skill.name),
      skills,
    };
  }

  async listSessions(): Promise<OpenClawSessionSummary[]> {
    const localSessions = await listLocalSessions();
    const configuredAgents = await readConfiguredAgents();
    const agentNames = new Map(
      await Promise.all(configuredAgents.map(async (agent) => {
        const identityText = await readFileSafe(resolveWorkspaceAgentFile(agent.id));
        const parsedIdentity = parseAgentDescription(identityText);
        return [agent.id, agent.identity?.name ?? agent.name ?? parsedIdentity.title ?? agent.id] as const;
      })),
    );
    const metadataByKey = new Map<string, Record<string, unknown>>();

    for (const session of localSessions) {
      metadataByKey.set(session.sessionKey, {
        updatedAt: session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : undefined,
        channel: session.channel,
      });
    }

    const gatewaySessions = await withTimeout(
      gatewayRequest({
        method: "sessions.list",
        params: {
          limit: 200,
          includeLastMessage: true,
          includeDerivedTitles: true,
        },
        scopes: ["operator.read"],
      }, gatewaySessionsSchema),
      1500,
      {sessions: []},
    );

    if (!gatewaySessions.sessions.length) {
      return localSessions.map((session) => ({
        ...session,
        agentName: agentNames.get(session.agentId) ?? session.agentName,
      }));
    }

    const merged = gatewaySessions.sessions.map((session) => {
      const keyParts = session.key.split(":");
      const agentId = keyParts[0] === "agent" ? keyParts[1] ?? "main" : "main";
      const meta = metadataByKey.get(session.key) ?? {};
      const channel = typeof meta.channel === "string"
        ? meta.channel
        : typeof meta.lastChannel === "string"
          ? meta.lastChannel
          : "local";
      return {
        id: session.key,
        sessionKey: session.key,
        agentId,
        agentName: agentNames.get(agentId) ?? agentId,
        channel,
        startedAt: toIsoFromMs(session.startedAt) ?? toIsoFromMs(typeof meta.updatedAt === "number" ? meta.updatedAt : undefined),
        lastActivityAt: toIsoFromMs(session.updatedAt) ?? toIsoFromMs(typeof meta.updatedAt === "number" ? meta.updatedAt : undefined),
        status: session.status ?? (session.endedAt ? "completed" : "active"),
        messageCount: session.messageCount ?? 0,
        lastMessage: session.lastMessage?.text ?? "",
      };
    });

    const mergedByKey = new Map(merged.map((session) => [session.sessionKey, session]));
    for (const session of localSessions) {
      if (!mergedByKey.has(session.sessionKey)) {
        mergedByKey.set(session.sessionKey, {
          ...session,
          agentName: agentNames.get(session.agentId) ?? session.agentName,
        });
      }
    }

    return Array.from(mergedByKey.values())
      .sort((left, right) => (right.lastActivityAt ?? "").localeCompare(left.lastActivityAt ?? ""));
  }

  async getSessionDetails(sessionId: string): Promise<OpenClawSessionDetail> {
    const sessions = await this.listSessions();
    const session = sessions.find((entry) => entry.sessionKey === sessionId || entry.id === sessionId);
    if (!session) throw new OpenClawGatewayError(`Session ${sessionId} was not found.`, "SESSION_NOT_FOUND");

    const sessionIndexPath = path.join(resolveAgentSessionDir(session.agentId), "sessions.json");
    const sessionIndex = await readJsonSafe<Record<string, Record<string, unknown>>>(sessionIndexPath, {});
    const meta = sessionIndex[session.sessionKey] ?? {};
    const fileSessionId = typeof meta.sessionId === "string" ? meta.sessionId : session.sessionKey;
    const sessionFile = path.join(resolveAgentSessionDir(session.agentId), `${fileSessionId}.jsonl`);
    const transcript = await parseSessionTranscripts(session.agentId, sessionFile);

    return {
      id: session.id,
      sessionKey: session.sessionKey,
      agentId: session.agentId,
      channel: session.channel,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      status: session.status,
      messages: transcript.messages,
      tools: transcript.tools,
    };
  }

  async sendMessageToAgent(input: z.input<typeof sendParamsSchema>) {
    const params = sendParamsSchema.parse(input);
    const sessionKey = buildSessionKey(params.agentId, params.sessionId);

    const baseline = await gatewayRequest(
      {
        method: "chat.history",
        params: {sessionKey, limit: 20},
        scopes: ["operator.read"],
      },
      gatewayHistorySchema,
    ).catch(() => ({messages: []}));

    const baselineText = baseline.messages
      .map((message) => extractTextContent(message.content))
      .filter(Boolean)
      .join("\n");

    const result = await gatewayRequest(
      {
        method: "chat.send",
        params: {
          sessionKey,
          message: params.message,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        },
        scopes: ["operator.read", "operator.write"],
      },
      z.object({
        runId: z.string().optional(),
        status: z.string().optional(),
      }),
    );

    let replyText = "";
    if (result.runId) {
      await gatewayRequest(
        {
          method: "agent.wait",
          params: {runId: result.runId, timeoutMs: 15_000},
          scopes: ["operator.read"],
        },
        z.object({
          status: z.string().optional(),
        }).passthrough(),
      ).catch(() => ({status: "pending"}));

      const history = await gatewayRequest(
        {
          method: "chat.history",
          params: {sessionKey, limit: 30},
          scopes: ["operator.read"],
        },
        gatewayHistorySchema,
      ).catch(() => ({messages: []}));

      replyText = history.messages
        .filter((message) => message.role === "assistant")
        .map((message) => extractTextContent(message.content))
        .filter(Boolean)
        .find((text) => !baselineText.includes(text)) ?? "";
    }

    this.pushEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      agentId: params.agentId,
      sessionKey,
      type: "message",
      title: `Command sent to ${params.agentId}`,
      detail: trimText(params.message, 180),
      impact: "Operator-directed agent run",
      raw: {
        runId: result.runId ?? null,
      },
    });

    return {
      sessionKey,
      runId: result.runId ?? null,
      status: result.status ?? "started",
      replyText,
    };
  }

  async getSystemStats(): Promise<OpenClawSystemStats> {
    await this.captureSystemStats();
    const cpuLoad = this.systemHistory.cpuLoad.at(-1) ?? 0;
    const memoryUsedPct = this.systemHistory.memoryUsedPct.at(-1) ?? 0;
    const diskUsedPct = this.systemHistory.diskUsedPct.at(-1) ?? 0;
    const severity = Math.max(cpuLoad, memoryUsedPct, diskUsedPct);
    return {
      cpuLoad,
      memoryUsedPct,
      diskUsedPct,
      temperatureC: null,
      status: severity >= 85 ? "Critical" : severity >= 65 ? "Elevated" : "Nominal",
      history: this.systemHistory,
    };
  }

  async getApprovals(): Promise<OpenClawApprovalsSnapshot> {
    const filePolicy = await scanApprovalsFile();
    const gatewayPolicy = await withTimeout(
      gatewayRequest(
        {method: "exec.approval.list", params: {}, scopes: ["operator.approvals", "operator.read"]},
        gatewayApprovalSnapshotSchema,
      ),
      1500,
      null,
    );
    if (gatewayPolicy?.pending) {
      for (const entry of gatewayPolicy.pending) {
        this.pendingApprovals.set(entry.id, {
          id: entry.id,
          agentId: entry.agentId ?? null,
          command: entry.command ?? "Approval requested",
          rationale: entry.reason ?? "OpenClaw requested approval.",
          estimatedImpact: "Exec or external action",
          requestedAt: toIsoFromMs(entry.requestedAt) ?? new Date().toISOString(),
        });
      }
    }

    return {
      policyPath: openClawConfig.approvalsFile,
      pending: Array.from(this.pendingApprovals.values()).sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)),
      policyRaw: filePolicy.policyRaw,
    };
  }

  async resolveApproval(approvalId: string, decision: "allow-once" | "allow-always" | "deny") {
    await gatewayRequest(
      {
        method: "exec.approval.resolve",
        params: {id: approvalId, decision},
        scopes: ["operator.approvals", "operator.read"],
      },
      z.object({ok: z.boolean().optional()}).passthrough(),
    );
    this.pendingApprovals.delete(approvalId);
    this.pushEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      agentId: null,
      sessionKey: null,
      type: "system",
      title: "Approval resolved",
      detail: `${approvalId} set to ${decision}.`,
      impact: "Operator approval decision",
      raw: {approvalId},
    });
    return {ok: true};
  }

  async getMemorySections(search = ""): Promise<OpenClawMemorySection[]> {
    const files = await listFilesRecursive(openClawConfig.workspaceDir, (filePath) => {
      const basename = path.basename(filePath);
      return basename === "MEMORY.md" || basename === "HEARTBEAT.md" || basename === "AGENTS.md";
    });
    const memoryFiles = await listFilesRecursive(openClawConfig.memoryDir, (filePath) => filePath.endsWith(".md"));
    const query = search.trim().toLowerCase();

    const sections = await Promise.all([...files, ...memoryFiles].map(async (filePath) => ({
      title: path.relative(openClawConfig.homeDir, filePath),
      path: filePath,
      body: await readFileSafe(filePath),
    })));

    return sections
      .filter((section) => !query || section.body.toLowerCase().includes(query) || section.title.toLowerCase().includes(query))
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  private async scanRecentSessionActivity() {
    const agents = await this.listAgents().catch(() => []);
    for (const agent of agents) {
      const dir = resolveAgentSessionDir(agent.id);
      let entries: string[] = [];
      try {
        entries = await fsp.readdir(dir);
      } catch {
        continue;
      }
      const latestJsonl = entries
        .filter((entry) => entry.endsWith(".jsonl"))
        .map((entry) => path.join(dir, entry))
        .sort()
        .pop();
      if (!latestJsonl) continue;
      const stats = await fsp.stat(latestJsonl).catch(() => null);
      if (!stats) continue;
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs > 15_000) continue;
      this.pushEvent({
        id: crypto.randomUUID(),
        at: new Date(stats.mtimeMs).toISOString(),
        agentId: agent.id,
        sessionKey: null,
        type: "system",
        title: `${agent.name} session updated`,
        detail: "A local session transcript changed on disk.",
        impact: "Transcript activity detected",
      });
    }
  }

  private async connectLiveGateway() {
    if (typeof WebSocket === "undefined") return;

    try {
      const ws = new WebSocket(openClawConfig.wsUrl);
      const connectId = crypto.randomUUID();
      const subscribeId = crypto.randomUUID();

      ws.addEventListener("message", (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(String(event.data ?? ""));
        } catch {
          return;
        }

        const parsed = openClawGatewayEventSchema.safeParse(payload);
        if (!parsed.success) return;
        const frame = parsed.data;

        if (frame.type === "event" && frame.event === "connect.challenge") {
          ws.send(JSON.stringify({
            type: "req",
            id: connectId,
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: "elite-automations-stream",
                version: "0.1.0",
                platform: process.platform,
                mode: "operator",
              },
              role: "operator",
              scopes: ["operator.read", "operator.write", "operator.approvals"],
              caps: ["tool-events"],
              auth: openClawConfig.token ? {token: openClawConfig.token} : undefined,
              locale: "en-GB",
              userAgent: "elite-automations/0.1.0",
            },
          }));
          return;
        }

        if (frame.type === "res" && (payload as {id?: string}).id === connectId) {
          ws.send(JSON.stringify({
            type: "req",
            id: subscribeId,
            method: "sessions.subscribe",
            params: {},
          }));
          return;
        }

        if (frame.type !== "event" || !frame.event) return;
        const payloadRecord = frame.payload && typeof frame.payload === "object"
          ? frame.payload as Record<string, unknown>
          : {};
        const agentId = typeof payloadRecord.agentId === "string"
          ? payloadRecord.agentId
          : typeof payloadRecord.sessionKey === "string" && payloadRecord.sessionKey.startsWith("agent:")
            ? payloadRecord.sessionKey.split(":")[1] ?? null
            : null;

        if (frame.event.startsWith("exec.approval.")) {
          const approvalId = typeof payloadRecord.id === "string" ? payloadRecord.id : crypto.randomUUID();
          this.pushEvent({
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            agentId,
            sessionKey: typeof payloadRecord.sessionKey === "string" ? payloadRecord.sessionKey : null,
            type: frame.event.endsWith("requested") ? "approval" : "system",
            title: frame.event.endsWith("requested") ? "Approval requested" : "Approval resolved",
            detail: trimText(String(payloadRecord.reason ?? payloadRecord.command ?? frame.event), 180),
            impact: "External or exec action",
            raw: {approvalId},
          });
          return;
        }

        this.pushEvent({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          agentId,
          sessionKey: typeof payloadRecord.sessionKey === "string" ? payloadRecord.sessionKey : null,
          type: frame.event.includes("tool") ? "tool_call" : frame.event.includes("error") ? "error" : "message",
          title: frame.event,
          detail: trimText(JSON.stringify(payloadRecord), 200),
          impact: "Gateway event",
          raw: payloadRecord,
        });
      });

      ws.addEventListener("close", () => {
        setTimeout(() => void this.connectLiveGateway(), 5_000).unref();
      });

      ws.addEventListener("error", () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      });
    } catch {
      setTimeout(() => void this.connectLiveGateway(), 10_000).unref();
    }
  }
}

export const openClawService = new OpenClawService();
