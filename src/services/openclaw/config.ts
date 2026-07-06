import os from "node:os";
import path from "node:path";

function normalizeHttpUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function toWsUrl(httpUrl: string) {
  return httpUrl.replace(/^http/i, "ws");
}

export interface OpenClawConfig {
  gatewayUrl: string;
  wsUrl: string;
  token: string | null;
  homeDir: string;
  configFile: string;
  agentsDir: string;
  workspaceDir: string;
  memoryDir: string;
  logsDir: string;
  approvalsFile: string;
}

const homeDir = process.env.OPENCLAW_HOME
  ? path.resolve(process.env.OPENCLAW_HOME)
  : path.join(os.homedir(), ".openclaw");

const gatewayUrl = normalizeHttpUrl(process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:18789");

export const openClawConfig: OpenClawConfig = {
  gatewayUrl,
  wsUrl: toWsUrl(gatewayUrl),
  token: process.env.OPENCLAW_API_TOKEN?.trim() || null,
  homeDir,
  configFile: path.join(homeDir, "openclaw.json"),
  agentsDir: path.join(homeDir, "agents"),
  workspaceDir: path.join(homeDir, "workspace"),
  memoryDir: path.join(homeDir, "memory"),
  logsDir: path.join(homeDir, "logs"),
  approvalsFile: path.join(homeDir, "exec-approvals.json"),
};
