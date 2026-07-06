import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Badge, statusBadge, healthBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/services/api";
import type { AccountStatus, Priority, ClientRecord } from "@/types";
import {
  ArrowLeft, Globe, Phone, Mail, MapPin, Star,
  TrendingUp, ExternalLink, MessageSquare, FileText,
  Plus, Trash2, Edit3, ChevronDown, CheckCircle2,
  AlertTriangle, XCircle, Clock,
} from "lucide-react";

const STATUS_OPTIONS: AccountStatus[] = [
  "prospect", "contacted", "replied", "proposal_sent", "negotiating", "won", "lost",
];

const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high", "critical"];

function ScoreBreakdown({ audit }: { audit: ClientRecord["audit"] }) {
  if (!audit) return null;

  const scores = audit.scores as Record<string, number>;
  const items = Object.entries(scores).map(([key, val]) => ({
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: val,
    max: 10,
  }));

  return (
    <div className="space-y-3">
      {items.map(({ label, value, max }) => (
        <div key={label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[var(--color-text-muted)]">{label}</span>
            <span className="font-mono text-[var(--color-text)]">{value}/{max}</span>
          </div>
          <Progress
            value={value}
            max={max}
            size="sm"
            variant={value >= 7 ? "success" : value >= 5 ? "accent" : value >= 3 ? "warning" : "error"}
          />
        </div>
      ))}
    </div>
  );
}

function AddTaskModal({ accountId, onClose, onAdded }: { accountId: string; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await api.addTask(accountId, title, dueDate || undefined);
      onAdded();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Task" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Task Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Follow up by phone…"
            className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Due Date (optional)</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} loading={loading}>Add Task</Button>
        </div>
      </div>
    </Modal>
  );
}

function AddNoteModal({ accountId, onClose, onAdded }: { accountId: string; onClose: () => void; onAdded: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await api.addNote(accountId, content);
      onAdded();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Note" size="sm">
      <div className="space-y-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What happened in the call?…"
          rows={5}
          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} loading={loading}>Save Note</Button>
        </div>
      </div>
    </Modal>
  );
}

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, setState, setLoading } = useAppStore();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const account = state?.accounts.find((a) => a.id === id);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await api.getState();
      setState(s);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: AccountStatus) => {
    if (!account) return;
    setUpdatingStatus(true);
    try {
      await api.updateAccount(account.id, { status });
      await refresh();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updatePriority = async (priority: Priority) => {
    if (!account) return;
    await api.updateAccount(account.id, { priority });
    await refresh();
  };

  const deleteAccount = async () => {
    if (!account || !confirm(`Delete ${account.businessName}? This cannot be undone.`)) return;
    await api.deleteAccount(account.id);
    navigate("/leads");
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-[var(--color-text-muted)]">Lead not found.</p>
        <Link to="/leads"><Button variant="secondary" size="sm">← Back to Leads</Button></Link>
      </div>
    );
  }

  const score = account.audit?.totalScore ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link to="/leads" className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          <ArrowLeft size={16} /> Back to Leads
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAddNote(true)}>
            <MessageSquare size={14} className="mr-1" /> Note
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAddTask(true)}>
            <Plus size={14} className="mr-1" /> Task
          </Button>
          <Button variant="danger" size="sm" onClick={deleteAccount}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center text-2xl font-bold text-[var(--color-accent)] flex-shrink-0">
              {account.businessName[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text)]">{account.businessName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm text-[var(--color-text-muted)]">{account.businessType}</span>
                {account.area && (
                  <>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                      <MapPin size={12} /> {account.area}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge {...statusBadge(account.status)} />
                <Badge {...healthBadge(account.healthBand)} />
                {account.priority && (
                  <Badge
                    label={account.priority.charAt(0).toUpperCase() + account.priority.slice(1)}
                    variant={account.priority === "critical" ? "error" : account.priority === "high" ? "warning" : "default"}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Score ring */}
          <div className="text-center">
            <div className="text-4xl font-bold font-mono text-[var(--color-accent)]">{score}</div>
            <div className="text-xs text-[var(--color-text-muted)]">/ 100</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Audit Score</div>
          </div>
        </div>

        {/* Contact links */}
        <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-[var(--color-border)]">
          {account.website && (
            <a href={account.website} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline">
              <Globe size={12} /> Website
            </a>
          )}
          {account.email && (
            <a href={`mailto:${account.email}`}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <Mail size={12} /> {account.email}
            </a>
          )}
          {account.phone && (
            <a href={`tel:${account.phone}`}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <Phone size={12} /> {account.phone}
            </a>
          )}
        </div>

        {/* Status changer */}
        <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
          <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Pipeline Stage</div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                disabled={updatingStatus}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150
                  ${account.status === s
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                  }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Audit + Metrics + Tasks + Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audit Breakdown */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star size={15} className="text-[var(--color-gold)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Audit Breakdown</h2>
          </div>
          {account.audit ? (
            <>
              <ScoreBreakdown audit={account.audit} />
              {account.audit.issues && account.audit.issues.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Issues Found</div>
                  <ul className="space-y-1">
                    {account.audit.issues.slice(0, 5).map((issue: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-400">
                        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No audit data available.</p>
          )}
        </div>

        {/* Metrics */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-[var(--color-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Metrics</h2>
          </div>
          {account.metrics ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Est. Value", value: account.metrics.estimatedValue != null ? `£${Math.round(account.metrics.estimatedValue).toLocaleString()}` : "—" },
                { label: "Weighted", value: account.metrics.weightedValue != null ? `£${Math.round(account.metrics.weightedValue).toLocaleString()}` : "—" },
                { label: "Win Prob.", value: account.metrics.winProbability != null ? `${Math.round(account.metrics.winProbability * 100)}%` : "—" },
                { label: "Days Active", value: account.metrics.daysInPipeline?.toString() ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-[var(--color-surface-2)] p-3">
                  <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
                  <div className="text-lg font-bold font-mono text-[var(--color-text)] mt-1">{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No metrics available.</p>
          )}

          {/* Rating */}
          {account.rating != null && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Google Rating</span>
                <div className="flex items-center gap-1">
                  <Star size={11} className="text-[var(--color-gold)]" fill="currentColor" />
                  <span className="font-mono text-[var(--color-text)]">{account.rating}</span>
                  {account.reviewCount != null && (
                    <span className="text-[var(--color-text-muted)]">({account.reviewCount})</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Tasks</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAddTask(true)}>
              <Plus size={13} className="mr-1" /> Add
            </Button>
          </div>
          {account.tasks && account.tasks.length > 0 ? (
            <div className="space-y-2">
              {account.tasks.map((t: any) => (
                <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors">
                  <div className={`mt-0.5 flex-shrink-0 ${t.completed ? "text-emerald-400" : "text-[var(--color-text-muted)]"}`}>
                    {t.completed ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${t.completed ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text)]"}`}>
                      {t.title}
                    </div>
                    {t.dueDate && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Due: {t.dueDate}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No tasks yet.</p>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-cyan-400" />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Notes</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAddNote(true)}>
              <Plus size={13} className="mr-1" /> Add
            </Button>
          </div>
          {account.notes && account.notes.length > 0 ? (
            <div className="space-y-3">
              {account.notes.map((n: any) => (
                <div key={n.id} className="p-3 rounded-lg bg-[var(--color-surface-2)] text-xs text-[var(--color-text)]">
                  <p className="leading-relaxed">{n.content}</p>
                  <p className="text-[var(--color-text-muted)] mt-1.5">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No notes yet.</p>
          )}
        </div>
      </div>

      {/* Demo preview link */}
      {account.slug && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Lead Demo Page</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Share this with the prospect to showcase their audit</p>
            </div>
            <a
              href={`/output/demos/${account.slug}/index.html`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="secondary" size="sm">
                <ExternalLink size={13} className="mr-1.5" /> Open Demo
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddTask && (
        <AddTaskModal
          accountId={account.id}
          onClose={() => setShowAddTask(false)}
          onAdded={refresh}
        />
      )}
      {showAddNote && (
        <AddNoteModal
          accountId={account.id}
          onClose={() => setShowAddNote(false)}
          onAdded={refresh}
        />
      )}
    </div>
  );
}
