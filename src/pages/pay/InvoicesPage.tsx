import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Send,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { useQuery as useCustomersQuery } from "@tanstack/react-query";
import { apiUrl } from "@/services/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StripeInvoice {
  id: string;
  number: string | null;
  customerEmail: string | null;
  customerName: string | null;
  amount: number;
  currency: string;
  status: string;
  created: number;
  dueDate: number | null;
  invoiceUrl: string | null;
}

interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  totalSpend: number;
  currency: string;
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchInvoices(): Promise<StripeInvoice[]> {
  const res = await fetch(apiUrl("/api/stripe/invoices"));
  if (!res.ok) throw new Error("Failed to load invoices");
  return res.json();
}

async function fetchCustomers(): Promise<StripeCustomer[]> {
  const res = await fetch(apiUrl("/api/stripe/customers"));
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_BADGE: Record<string, { variant: "success" | "warning" | "error" | "info" | "neutral"; label: string }> = {
  paid:           { variant: "success", label: "Paid" },
  open:           { variant: "info",    label: "Open" },
  draft:          { variant: "neutral", label: "Draft" },
  void:           { variant: "error",   label: "Void" },
  uncollectible:  { variant: "warning", label: "Uncollectible" },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ["stripe-invoices"],
    queryFn: fetchInvoices,
    staleTime: 60_000,
  });

  const { data: customers = [] } = useCustomersQuery({
    queryKey: ["stripe-customers"],
    queryFn: fetchCustomers,
    staleTime: 60_000,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [daysUntilDue, setDaysUntilDue] = useState("14");
  const [sendNow, setSendNow] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  const paidTotal = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((s, inv) => s + inv.amount, 0);

  const openTotal = invoices
    .filter((inv) => inv.status === "open")
    .reduce((s, inv) => s + inv.amount, 0);

  async function handleCreate() {
    if (!customerId || !amount) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(apiUrl("/api/stripe/invoices"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          description: description || undefined,
          amount: Math.round(parseFloat(amount) * 100),
          currency: "gbp",
          daysUntilDue: parseInt(daysUntilDue, 10),
          send: sendNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      await queryClient.invalidateQueries({ queryKey: ["stripe-invoices"] });
      setJustCreated(true);
      setTimeout(() => setJustCreated(false), 4000);
      setShowCreate(false);
      setCustomerId("");
      setDescription("");
      setAmount("");
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageWrapper
      eyebrow="HAMID.OS · PAY"
      title="INVOICES"
      description="Create, send, and track Stripe invoices — live from your account"
      actions={
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          <span>New invoice</span>
        </Button>
      }
    >
      <div className="space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total invoices", value: String(invoices.length), color: "var(--color-accent)" },
            { label: "Paid revenue",   value: paidTotal > 0 ? fmt(paidTotal) : "£0", color: "#22c55e" },
            { label: "Outstanding",    value: openTotal > 0 ? fmt(openTotal) : "£0", color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-4">
              <p className="metric-mono text-xl font-bold" style={{ color }}>{isLoading ? "—" : value}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{label}</p>
            </Card>
          ))}
        </div>

        {/* Success banner */}
        {justCreated && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] bg-green-500/10 border border-green-500/20 text-green-400">
            <CheckCircle2 size={15} />
            <span className="text-sm font-medium">Invoice created{sendNow ? " and sent" : " as draft"}.</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle size={15} />
            <span className="text-sm">Could not load invoices. Check your Stripe key.</span>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <Card className="p-5 space-y-4 border border-[var(--color-accent)]/30">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text)]">Create invoice</h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X size={15} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Customer</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                >
                  <option value="">— select customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name ?? c.email ?? c.id}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Amount (£)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">£</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] pl-7 pr-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Website automation setup"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Days until due</label>
                <select
                  value={daysUntilDue}
                  onChange={(e) => setDaysUntilDue(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="send-now"
                  checked={sendNow}
                  onChange={(e) => setSendNow(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                <label htmlFor="send-now" className="text-sm text-[var(--color-text-muted)] cursor-pointer">
                  Send to customer immediately
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleCreate} disabled={creating || !customerId || !amount}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{sendNow ? "Create & send" : "Create draft"}</span>
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
            {createError && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle size={13} />{createError}
              </p>
            )}
          </Card>
        )}

        {/* Invoice list */}
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-[var(--color-accent)]" />
              <p className="font-semibold text-sm">All invoices</p>
            </div>
            <span className="metric-mono text-sm text-[var(--color-accent)]">{invoices.length}</span>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center text-[var(--color-text-muted)]">
              <FileText size={36} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No invoices yet</p>
              <p className="text-xs mt-1">Create your first invoice above to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {invoices.map((inv) => {
                const status = STATUS_BADGE[inv.status] ?? { variant: "neutral" as const, label: inv.status };
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {inv.number ?? inv.id}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {inv.customerName ?? inv.customerEmail ?? "Unknown customer"} · {fmtDate(inv.created)}
                        {inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="metric-mono text-sm font-bold text-[var(--color-text)]">
                        {fmt(inv.amount, inv.currency)}
                      </span>
                      {inv.invoiceUrl && (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
