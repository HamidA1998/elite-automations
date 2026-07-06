import type {
  DashboardAppState, ClientRecord, ClientContact, ClientTask,
  ClientProposal, OutreachActivity, ClientMemory, AccountStatus, Priority,
} from "@/types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({ error: "Invalid response" }));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

// ── State ───────────────────────────────────────────────────────
export const api = {
  getState: () => request<DashboardAppState>("/state"),
  getMetrics: () => request<DashboardAppState["metrics"]>("/metrics"),
  getHealth: () => request<{ status: string; uptime: number; timestamp: string }>("/health"),

  // ── Accounts ──────────────────────────────────────────────────
  getAccounts: (page = 1) =>
    request<{ accounts: ClientRecord[] }>(`/accounts?page=${page}`),

  getAccountFull: (id: string) =>
    request<ClientRecord>(`/accounts/${encodeURIComponent(id)}/full`),

  createAccount: (payload: {
    businessName: string; businessType: string; area: string;
    emailAddress?: string | null; phoneNumber?: string | null;
    websiteUrl?: string | null; accountStatus?: AccountStatus; priority?: Priority;
    dueDate?: string | null; nextActionNotes?: string; dealValue?: number; siteScore?: number;
  }) => request<DashboardAppState>("/accounts", { method: "POST", body: JSON.stringify(payload) }),

  updateAccount: (id: string, patch: Partial<{
    accountStatus: AccountStatus; priority: Priority; followUpNextStep: string;
    nextActionNotes: string; dueDate: string; closeProbability: number;
    valueEstimate: number; lastContactedAt: string | null;
    businessName: string; businessType: string; area: string;
    websiteUrl: string | null; phoneNumber: string | null; emailAddress: string | null;
  }>) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),

  deleteAccount: (id: string) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // ── Timeline ───────────────────────────────────────────────────
  addTimeline: (id: string, payload: {
    eventType: string; timestamp: string; notes?: string;
    contactName?: string | null; duration?: number | null; followUpDate?: string | null;
  }) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}/timeline`, {
      method: "POST", body: JSON.stringify(payload),
    }),

  // ── Tasks ─────────────────────────────────────────────────────
  addTask: (id: string, task: Omit<ClientTask, "id" | "createdAt">) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}/tasks`, {
      method: "POST", body: JSON.stringify(task),
    }),

  updateTask: (taskId: string, patch: Partial<Pick<ClientTask, "status" | "priority" | "dueDate" | "owner">>) =>
    request<DashboardAppState>(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),

  deleteTask: (taskId: string) =>
    request<DashboardAppState>(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" }),

  // ── Contacts ──────────────────────────────────────────────────
  addContact: (id: string, contact: Omit<ClientContact, "id">) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}/contacts`, {
      method: "POST", body: JSON.stringify(contact),
    }),

  updateContact: (contactId: string, patch: Partial<ClientContact>) =>
    request<DashboardAppState>(`/contacts/${encodeURIComponent(contactId)}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),

  deleteContact: (contactId: string) =>
    request<DashboardAppState>(`/contacts/${encodeURIComponent(contactId)}`, { method: "DELETE" }),

  // ── Proposals ─────────────────────────────────────────────────
  addProposal: (id: string, proposal: Omit<ClientProposal, "id" | "createdAt" | "updatedAt">) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}/proposal`, {
      method: "POST", body: JSON.stringify(proposal),
    }),

  updateProposal: (proposalId: string, patch: Partial<Pick<ClientProposal, "status" | "probability" | "price" | "nextStep">>) =>
    request<DashboardAppState>(`/proposals/${encodeURIComponent(proposalId)}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),

  // ── Activities ────────────────────────────────────────────────
  addActivity: (id: string, activity: Omit<OutreachActivity, "id" | "createdAt">) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}/timeline`, {
      method: "POST",
      body: JSON.stringify({ eventType: activity.type, timestamp: new Date().toISOString(), notes: activity.summary }),
    }),

  // ── Notes ─────────────────────────────────────────────────────
  addNote: (id: string, body: string) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}/notes`, {
      method: "POST", body: JSON.stringify({ body }),
    }),

  // ── Calls ─────────────────────────────────────────────────────
  logCall: (id: string, payload: {
    calledAt: string; outcome: string; durationMinutes?: number | null;
    contactName?: string | null; notes?: string; followUpDate?: string | null;
  }) =>
    request<DashboardAppState>(`/accounts/${encodeURIComponent(id)}/calls`, {
      method: "POST", body: JSON.stringify(payload),
    }),

  // ── Memories ──────────────────────────────────────────────────
  addMemory: (memory: Omit<ClientMemory, "id" | "createdAt" | "updatedAt">) =>
    request<DashboardAppState>("/memories", { method: "POST", body: JSON.stringify(memory) }),

  deleteMemory: (memoryId: string) =>
    request<DashboardAppState>(`/memories/${encodeURIComponent(memoryId)}`, { method: "DELETE" }),

  // ── Search ────────────────────────────────────────────────────
  search: (q: string, status?: string, priority?: string) => {
    const params = new URLSearchParams({ q });
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    return request<{ results: ClientRecord[] }>(`/search?${params}`);
  },

  // ── Export ────────────────────────────────────────────────────
  exportCsv: () => fetch("/api/export/csv").then((r) => r.blob()),

  // ── Backup ────────────────────────────────────────────────────
  backup: () =>
    request<{ success: boolean; backupPath: string }>("/backup", { method: "POST" }),

  // ── Pipeline import ───────────────────────────────────────────
  importPipeline: () =>
    request<DashboardAppState>("/import/pipeline", { method: "POST" }),

  // ── Mail drafts ───────────────────────────────────────────────
  getMailDrafts: () => request<{ drafts: unknown[] }>("/mail/drafts"),

  // ── Ops ───────────────────────────────────────────────────────
  getTodayBatch: () => request<{ accounts: unknown[] }>("/ops/today-batch"),
  getCallSheet: () => request<{ accounts: unknown[] }>("/ops/call-sheet"),
};
