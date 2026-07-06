import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiUrl } from "@/services/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  totalSpend: number;
  currency: string;
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchCustomers(): Promise<StripeCustomer[]> {
  const res = await fetch(apiUrl("/api/stripe/customers"));
  if (!res.ok) throw new Error("Failed to load customers");
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

function initials(name: string | null, email: string | null): string {
  if (name) return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ["stripe-customers"],
    queryFn: fetchCustomers,
    staleTime: 60_000,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const filtered = customers.filter(
    (c) =>
      (c.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreate() {
    if (!newEmail.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(apiUrl("/api/stripe/customers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), name: newName || undefined, phone: newPhone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      await queryClient.invalidateQueries({ queryKey: ["stripe-customers"] });
      setJustCreated(newName || newEmail);
      setTimeout(() => setJustCreated(null), 4000);
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewPhone("");
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageWrapper
      eyebrow="HAMID.OS · PAY"
      title="CUSTOMERS"
      description="Your Stripe customer base — billing contacts, spend history, and quick invoicing"
      actions={
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          <span>Add customer</span>
        </Button>
      }
    >
      <div className="space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">{isLoading ? "—" : customers.length}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Total customers</p>
          </Card>
          <Card className="p-4">
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">
              {isLoading ? "—" : customers.filter((c) => c.totalSpend > 0).length}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Paying customers</p>
          </Card>
        </div>

        {/* Success banner */}
        {justCreated && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] bg-green-500/10 border border-green-500/20 text-green-400">
            <CheckCircle2 size={15} />
            <span className="text-sm font-medium">{justCreated} added to Stripe.</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle size={15} />
            <span className="text-sm">Could not load customers. Check your Stripe key.</span>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <Card className="p-5 space-y-4 border border-[var(--color-accent)]/30">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--color-text)]">New customer</h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X size={15} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Email *</label>
                <input
                  type="email"
                  placeholder="client@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  placeholder="Acme Corp"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Phone</label>
                <input
                  type="tel"
                  placeholder="+44 7700 000000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleCreate} disabled={creating || !newEmail.trim()}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span>Add to Stripe</span>
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] pl-9 pr-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-28 rounded-[var(--radius-2xl)] animate-pulse bg-[var(--color-surface-2)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center text-[var(--color-text-muted)]">
            <Users size={36} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No customers found</p>
            <p className="text-xs mt-1">Add your first client above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <Card key={c.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{
                        background: "var(--color-accent)22",
                        color: "var(--color-accent)",
                      }}
                    >
                      {initials(c.name, c.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                        {c.name ?? "Unnamed"}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{c.email ?? "No email"}</p>
                    </div>
                  </div>
                  <a
                    href={`https://dashboard.stripe.com/customers/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors shrink-0"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-muted)]">Added {fmtDate(c.created)}</p>
                  {c.totalSpend > 0 ? (
                    <Badge variant="success">{fmt(c.totalSpend, c.currency)}</Badge>
                  ) : (
                    <Badge variant="neutral">
                      <User size={9} className="mr-1" />No spend
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
