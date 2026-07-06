import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ExternalLink,
  Package,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiUrl } from "@/services/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StripePrice {
  id: string;
  amount: number | null;
  currency: string;
  interval: string | null;
  type: string;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created: number;
  prices: StripePrice[];
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchProducts(): Promise<StripeProduct[]> {
  const res = await fetch(apiUrl("/api/stripe/products"));
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Failed to load products");
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

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPrimaryPrice(prices: StripePrice[]): StripePrice | null {
  if (prices.length === 0) return null;
  // Prefer recurring over one-time
  const recurring = prices.find((p) => p.interval);
  return recurring ?? prices[0] ?? null;
}

function priceLabel(price: StripePrice): string {
  const amount = fmt(price.amount, price.currency);
  if (price.interval) return `${amount}/${price.interval}`;
  return amount;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["stripe-products"],
    queryFn: fetchProducts,
    staleTime: 60_000,
  });

  const active   = products.filter((p) => p.active);
  const inactive = products.filter((p) => !p.active);
  const recurring = products.filter((p) => p.prices.some((pr) => pr.interval));
  const oneTime   = products.filter((p) => p.prices.some((pr) => !pr.interval));

  return (
    <PageWrapper
      eyebrow="HAMID.OS · PAY"
      title="PRODUCTS & PRICING"
      description="Your complete Stripe product catalogue — one-time offers and recurring plans"
    >
      <div className="space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Active products", value: active.length, sub: "published to Stripe", icon: Package, color: "var(--color-accent)" },
            { label: "Recurring plans", value: recurring.length, sub: "subscription products", icon: CheckCircle2, color: "#22c55e" },
            { label: "One-time offers", value: oneTime.length, sub: "fixed-price items", icon: Tag, color: "#f59e0b" },
            { label: "Total prices", value: products.reduce((acc, p) => acc + p.prices.length, 0), sub: "price variants", icon: Box, color: "#a78bfa" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="size-7 rounded-full flex items-center justify-center" style={{ background: color + "22", color }}>
                  <Icon size={13} />
                </span>
              </div>
              <p className="metric-mono text-xl font-bold text-[var(--color-accent)]">{isLoading ? "—" : value}</p>
              <p className="text-xs font-semibold text-[var(--color-text)] mt-0.5">{label}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>
            </Card>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle size={15} />
            <span className="text-sm">Could not load products. Check your Stripe key.</span>
          </div>
        )}

        {/* Products grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-[var(--radius-2xl)] animate-pulse bg-[var(--color-surface-2)]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center text-[var(--color-text-muted)]">
            <Package size={36} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No products yet</p>
            <p className="text-xs mt-1">Create products in your Stripe dashboard to see them here.</p>
            <a
              href="https://dashboard.stripe.com/products"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 text-xs text-[var(--color-accent)] hover:underline"
            >
              Open Stripe Products →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map((product) => {
              const primary = getPrimaryPrice(product.prices);
              const hasRecurring = product.prices.some((p) => p.interval);

              return (
                <Card key={product.id} className={`p-5 space-y-3 ${product.active ? "" : "opacity-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="size-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: hasRecurring ? "var(--color-accent)22" : "#f59e0b22",
                          color: hasRecurring ? "var(--color-accent)" : "#f59e0b",
                        }}
                      >
                        {hasRecurring ? <CheckCircle2 size={18} /> : <Tag size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[var(--color-text)] truncate">{product.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {hasRecurring ? "Recurring" : "One-time"} · Created {fmtDate(product.created)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`https://dashboard.stripe.com/products/${product.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors shrink-0"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>

                  {product.description && (
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {/* Prices */}
                  <div className="space-y-1.5">
                    {product.prices.slice(0, 3).map((price) => (
                      <div key={price.id} className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] truncate max-w-32">{price.id}</span>
                        <span className="text-sm font-semibold text-[var(--color-text)]">{priceLabel(price)}</span>
                      </div>
                    ))}
                    {product.prices.length > 3 && (
                      <p className="text-xs text-[var(--color-text-muted)]">+{product.prices.length - 3} more prices</p>
                    )}
                  </div>

                  {primary && (
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                      <Badge variant={product.active ? "success" : "neutral"}>
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="metric-mono text-lg font-bold text-[var(--color-accent)]">
                        {priceLabel(primary)}
                      </span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Inactive products */}
        {!isLoading && inactive.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
              <Package size={14} className="text-[var(--color-text-muted)]" />
              <p className="font-semibold text-sm">Inactive Products</p>
              <Badge variant="neutral">{inactive.length}</Badge>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {inactive.map((product) => {
                const primary = getPrimaryPrice(product.prices);
                return (
                  <div key={product.id} className="flex items-center justify-between px-6 py-3.5 opacity-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{product.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Archived · {fmtDate(product.created)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {primary && <span className="text-sm text-[var(--color-text-muted)]">{priceLabel(primary)}</span>}
                      <Badge variant="neutral">Inactive</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
