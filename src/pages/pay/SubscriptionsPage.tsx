import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CreditCard,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiUrl } from "@/services/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StripeSubscription {
  id: string;
  status: string;
  customerId: string;
  cancelAtPeriodEnd: boolean;
  amount: number | null;
  currency: string;
  interval: string | null;
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchSubscriptions(): Promise<StripeSubscription[]> {
  const res = await fetch(apiUrl("/api/stripe/subscriptions"));
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Failed to load subscriptions");
  }
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

function statusVariant(status: string): "success" | "warning" | "error" | "neutral" {
  switch (status) {
    case "active":    return "success";
    case "trialing":  return "info" as "success";
    case "past_due":  return "warning";
    case "canceled":  return "error";
    default:          return "neutral";
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SubscriptionsPage() {
  const { data: subs = [], isLoading, error } = useQuery({
    queryKey: ["stripe-subscriptions"],
    queryFn: fetchSubscriptions,
    staleTime: 60_000,
  });

  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing");
  const pastDue    = subs.filter((s) => s.status === "past_due");
  const canceled   = subs.filter((s) => s.status === "canceled");

  // MRR calculation
  const mrr = activeSubs.reduce((acc, s) => {
    if (!s.amount) return acc;
    const monthly = s.interval === "year" ? s.amount / 12 : s.amount;
    return acc + monthly;
  }, 0);

  const arr = mrr * 12;

  return (
    <PageWrapper
      eyebrow="HAMID.OS · PAY"
      title="SUBSCRIPTIONS"
      description="Recurring revenue tracking, subscription health, and MRR growth"
    >
      <div className="space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-full flex items-center justify-center bg-[var(--color-accent)]/10">
                <TrendingUp size={13} className="text-[var(--color-accent)]" />
              </span>
            </div>
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">
              {isLoading ? "—" : fmt(mrr)}
            </p>
            <p className="text-xs font-semibold text-[var(--color-text)] mt-0.5">MRR</p>
            <p className="text-xs text-[var(--color-text-muted)]">Monthly recurring revenue</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-full flex items-center justify-center bg-green-500/10">
                <RefreshCw size={13} className="text-green-400" />
              </span>
            </div>
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">
              {isLoading ? "—" : fmt(arr)}
            </p>
            <p className="text-xs font-semibold text-[var(--color-text)] mt-0.5">ARR</p>
            <p className="text-xs text-[var(--color-text-muted)]">Annual recurring revenue</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-full flex items-center justify-center bg-[var(--color-accent)]/10">
                <Users size={13} className="text-[var(--color-accent)]" />
              </span>
            </div>
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">
              {isLoading ? "—" : activeSubs.length}
            </p>
            <p className="text-xs font-semibold text-[var(--color-text)] mt-0.5">Active</p>
            <p className="text-xs text-[var(--color-text-muted)]">Active subscriptions</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-full flex items-center justify-center bg-yellow-500/10">
                <AlertCircle size={13} className="text-yellow-400" />
              </span>
            </div>
            <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">
              {isLoading ? "—" : pastDue.length}
            </p>
            <p className="text-xs font-semibold text-[var(--color-text)] mt-0.5">Past Due</p>
            <p className="text-xs text-[var(--color-text-muted)]">Needs attention</p>
          </Card>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-[var(--radius-xl)] bg-red-500/10 border border-red-500/20 text-red-400 space-y-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span className="text-sm font-semibold">Stripe API error</span>
            </div>
            <p className="text-xs leading-relaxed">{error.message}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              If using a restricted key (<code className="bg-[var(--color-surface-2)] px-1 rounded">rk_live_</code>), go to{" "}
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="underline">
                Stripe API keys
              </a>{" "}
              and enable <strong>Subscriptions — Read</strong> permission on the key.
            </p>
          </div>
        )}

        {/* Subscriptions table */}
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-[var(--color-accent)]" />
              <p className="font-semibold text-sm">All Subscriptions</p>
            </div>
            <Badge variant={activeSubs.length > 0 ? "success" : "neutral"}>
              {activeSubs.length} active
            </Badge>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : subs.length === 0 ? (
            <div className="py-14 flex flex-col items-center text-center text-[var(--color-text-muted)]">
              <RefreshCw size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No subscriptions yet</p>
              <p className="text-xs mt-1">Create recurring products in Stripe to start tracking MRR here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {subs.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div
                    className="size-9 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: sub.status === "active" ? "var(--color-accent)22" : "var(--color-surface-3)",
                      color: sub.status === "active" ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    <CreditCard size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text)] font-mono truncate">
                      {sub.id}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Customer: {sub.customerId}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {fmt(sub.amount, sub.currency)}
                        {sub.interval && (
                          <span className="text-xs text-[var(--color-text-muted)] ml-1">
                            /{sub.interval}
                          </span>
                        )}
                      </p>
                      {sub.cancelAtPeriodEnd && (
                        <p className="text-xs text-yellow-400">Cancels at period end</p>
                      )}
                    </div>
                    <Badge variant={statusVariant(sub.status)}>
                      {sub.status.replace("_", " ")}
                    </Badge>
                    <a
                      href={`https://dashboard.stripe.com/subscriptions/${sub.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      View →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cancellations */}
        {!isLoading && canceled.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
              <AlertCircle size={14} className="text-red-400" />
              <p className="font-semibold text-sm">Recently Canceled</p>
              <Badge variant="error">{canceled.length}</Badge>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {canceled.slice(0, 5).map((sub) => (
                <div key={sub.id} className="flex items-center gap-4 px-6 py-3.5 opacity-60">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-[var(--color-text-muted)] truncate">{sub.id}</p>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {fmt(sub.amount, sub.currency)}
                    {sub.interval && <span className="text-xs ml-1">/{sub.interval}</span>}
                  </p>
                  <Badge variant="error">Canceled</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
