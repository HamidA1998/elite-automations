import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiUrl } from "@/services/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PaymentLink {
  id: string;
  url: string;
  active: boolean;
  amount: number | null;
  currency: string;
  description: string | null;
  created: number;
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchPaymentLinks(): Promise<PaymentLink[]> {
  const res = await fetch(apiUrl("/api/stripe/payment-links"));
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number | null, currency = "gbp") {
  if (amount === null) return "Variable";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PaymentLinksPage() {
  const queryClient = useQueryClient();
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["stripe-payment-links"],
    queryFn: fetchPaymentLinks,
    staleTime: 60_000,
  });

  const [copied, setCopied] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  const activeLinks = links.filter((l) => l.active);

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2500);
  }

  async function handleCreate() {
    if (!newAmount) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/stripe/payment-links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(parseFloat(newAmount) * 100),
          description: newDesc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      await queryClient.invalidateQueries({ queryKey: ["stripe-payment-links"] });
      setJustCreated(true);
      setTimeout(() => setJustCreated(false), 4000);
      setShowCreate(false);
      setNewDesc("");
      setNewAmount("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageWrapper
      eyebrow="HAMID.OS · PAY"
      title="PAYMENT LINKS"
      description="Shareable Stripe payment links — send to clients, embed in outreach, close deals faster"
      actions={
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          <span>New link</span>
        </Button>
      }
    >
      <div className="space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">
              {isLoading ? "—" : activeLinks.length}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Active links</p>
          </Card>
          <Card className="p-4">
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">
              {isLoading ? "—" : links.length}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Total links</p>
          </Card>
        </div>

        {/* Success banner */}
        {justCreated && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] bg-green-500/10 border border-green-500/20 text-green-400">
            <CheckCircle2 size={15} />
            <span className="text-sm font-medium">Payment link created successfully.</span>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <Card className="p-5 space-y-4 border border-[var(--color-accent)]/30">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text)]">Create payment link</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Description (e.g. Website automation setup)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              />
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">£</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] pl-7 pr-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleCreate} disabled={loading || !newAmount}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                <span>Create</span>
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle size={13} />{error}
              </p>
            )}
          </Card>
        )}

        {/* Links list */}
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-[var(--color-accent)]" />
              <p className="font-semibold text-sm">All payment links</p>
            </div>
            <Badge variant={activeLinks.length > 0 ? "success" : "neutral"}>
              {activeLinks.length} active
            </Badge>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center text-[var(--color-text-muted)]">
              <Link2 size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No payment links yet</p>
              <p className="text-xs mt-1">Create a link above and share it with your first client.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div
                    className="size-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: link.active ? "var(--color-accent)22" : "var(--color-surface-3)",
                      color: link.active ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    <Link2 size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {link.description ?? link.id}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {fmt(link.amount, link.currency)} · Created {fmtDate(link.created)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={link.active ? "success" : "neutral"}>
                      {link.active ? "Active" : "Inactive"}
                    </Badge>
                    <button
                      onClick={() => copyLink(link.url)}
                      className="p-1.5 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      title="Copy link"
                    >
                      {copied === link.url ? (
                        <CheckCircle2 size={13} className="text-green-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
