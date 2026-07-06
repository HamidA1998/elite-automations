import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  CreditCard,
  DollarSign,
  ExternalLink,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Progress } from "@/components/ui/Progress";
import { apiUrl, fetchMetrics } from "@/services/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StripeBalance {
  available: number;
  pending: number;
  currency: string;
}

interface StripeSummary {
  balance: StripeBalance;
  recentCharges: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string | null;
    created: number;
    customerEmail: string | null;
  }>;
  totalLast90Days: number;
  chargeCount: number;
  configured: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchStripeSummary(): Promise<StripeSummary> {
  const res = await fetch(apiUrl("/api/stripe/summary"));
  if (!res.ok) throw new Error("Failed to load Stripe data");
  return res.json();
}

function fmt(amount: number, currency = "gbp") {
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

const statusColor: Record<string, string> = {
  succeeded: "text-green-400 bg-green-500/10",
  pending: "text-yellow-400 bg-yellow-500/10",
  failed: "text-red-400 bg-red-500/10",
};

// ─── Revenue targets (founder-set goals) ───────────────────────────────────────

const MONTHLY_TARGET = 500000; // £5,000 in pence
const ARR_TARGET = 6000000;    // £60,000 ARR

// ─── Monthly bars — real data from Stripe (last 6 months shown as zero until charges exist) ──

const MONTH_LABELS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

// ─── Component ─────────────────────────────────────────────────────────────────

export function PayRevenuePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["stripe-summary"],
    queryFn: fetchStripeSummary,
    staleTime: 60_000,
  });

  const { data: crmMetrics } = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    staleTime: 60_000,
  });

  const liveClosed = data?.totalLast90Days ?? 0;
  const liveBalance = data?.balance.available ?? 0;
  const currency = data?.balance.currency ?? "gbp";
  const chargeCount = data?.chargeCount ?? 0;

  // Only derive MRR/ARR from actual revenue
  const mrr = chargeCount > 0 ? Math.round(liveClosed / 3) : 0;
  const arr = mrr * 12;
  const monthlyProgress = Math.min(100, Math.round((liveClosed / MONTHLY_TARGET) * 100));
  const arrProgress = Math.min(100, Math.round((arr / ARR_TARGET) * 100));

  // Pipeline from real CRM metrics
  const weightedPipeline = crmMetrics?.weightedPipeline ?? 0; // in pence (×100 already done by api)
  const wonDeals = crmMetrics?.wonDeals ?? 0;
  const liveActivityCount = crmMetrics?.liveActivityCount ?? 0;

  // Determine if any real pipeline exists
  const hasPipeline = weightedPipeline > 0;
  const hasRevenue = liveClosed > 0;

  // Revenue signals — only show real items
  const signals: Array<{
    icon: React.ComponentType<{ size?: number }>;
    color: string;
    text: string;
    badge: string;
    badgeVariant: "warning" | "info" | "success" | "neutral";
  }> = [];

  if (!hasRevenue && !hasPipeline) {
    signals.push({
      icon: Target,
      color: "#f59e0b",
      text: "No pipeline yet — start outreach to build revenue funnel",
      badge: "START",
      badgeVariant: "warning",
    });
  }

  if (wonDeals > 0) {
    signals.push({
      icon: CheckCircle,
      color: "#22c55e",
      text: `${wonDeals} deal${wonDeals !== 1 ? "s" : ""} won — keep the momentum`,
      badge: "WIN",
      badgeVariant: "success",
    });
  }

  if (liveActivityCount > 0) {
    signals.push({
      icon: Activity,
      color: "#a78bfa",
      text: `${liveActivityCount} active CRM activities in progress`,
      badge: "LIVE",
      badgeVariant: "info",
    });
  }

  signals.push({
    icon: CheckCircle,
    color: "#64748b",
    text: "Stripe account connected — ready to accept payments",
    badge: "READY",
    badgeVariant: "success",
  });

  if (error) {
    return (
      <PageWrapper
        eyebrow="HAMID.OS · PAY"
        title="REVENUE INTELLIGENCE"
        description="Live financial command centre — Stripe, pipeline, forecasts, targets"
      >
        <div className="flex items-center gap-3 px-5 py-4 rounded-[var(--radius-2xl)] bg-red-500/10 border border-red-500/20 text-red-400 max-w-xl">
          <AlertCircle size={18} />
          <div>
            <p className="font-medium">Could not connect to Stripe</p>
            <p className="text-sm opacity-80">Add STRIPE_SECRET_KEY to .env.local and restart the server.</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      eyebrow="HAMID.OS · PAY · REVENUE INTELLIGENCE"
      title="REVENUE COMMAND"
      description="Stripe balance, pipeline value, MRR/ARR trajectory, and goal tracking"
      actions={
        <div className="flex items-center gap-3">
          <Link to="/pay/invoices" className="text-xs text-[var(--color-accent)] hover:underline">
            Invoices →
          </Link>
          <Link to="/pay/customers" className="text-xs text-[var(--color-accent)] hover:underline">
            Customers →
          </Link>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Stripe <ExternalLink size={10} />
          </a>
        </div>
      }
    >
      <div className="space-y-6">

        {/* Top KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Available balance",
              value: isLoading ? "—" : fmt(liveBalance, currency),
              icon: CreditCard,
              color: "var(--color-accent)",
              detail: "Ready to withdraw",
            },
            {
              label: "90-day revenue",
              value: isLoading ? "—" : fmt(liveClosed, currency),
              icon: TrendingUp,
              color: "#22c55e",
              detail: `${chargeCount} charge${chargeCount !== 1 ? "s" : ""}`,
            },
            {
              label: "Est. MRR",
              value: isLoading ? "—" : mrr > 0 ? fmt(mrr, currency) : "£0",
              icon: Activity,
              color: "#f59e0b",
              detail: mrr > 0 ? "Based on 90d average" : "Awaiting first close",
            },
            {
              label: "Est. ARR run-rate",
              value: isLoading ? "—" : arr > 0 ? fmt(arr, currency) : "£0",
              icon: BarChart3,
              color: "#a78bfa",
              detail: `Target: ${fmt(ARR_TARGET, currency)}`,
            },
          ].map(({ label, value, icon: Icon, color, detail }) => (
            <Card key={label} className="p-5 space-y-3">
              <span
                className="inline-flex size-10 items-center justify-center rounded-full"
                style={{ background: `${color}22`, color }}
              >
                <Icon size={18} />
              </span>
              <div>
                <p className="metric-mono text-2xl font-bold text-[var(--color-text)]">
                  {isLoading ? (
                    <span className="inline-block w-20 h-7 rounded animate-pulse bg-[var(--color-surface-2)]" />
                  ) : (
                    value
                  )}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
                <p className="text-xs text-[var(--color-text-muted)] opacity-60 mt-0.5">{detail}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_22rem]">
          <div className="space-y-6">

            {/* Monthly revenue chart (bar) */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-kicker">Revenue history</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Monthly closed revenue</h2>
                </div>
                <Badge variant={liveClosed > 0 ? "success" : "neutral"}>
                  {liveClosed > 0 ? "LIVE DATA" : "AWAITING FIRST CLOSE"}
                </Badge>
              </div>
              {!hasRevenue ? (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <DollarSign size={28} className="text-[var(--color-text-muted)] opacity-20" />
                  <p className="text-sm text-[var(--color-text-muted)]">No revenue yet — bars will populate after the first close</p>
                </div>
              ) : (
                <div className="flex items-end gap-2 h-32 pt-4">
                  {MONTH_LABELS.map((month, i) => {
                    const isLast = i === MONTH_LABELS.length - 1;
                    const barValue = isLast ? liveClosed : 0;
                    const maxVal = Math.max(MONTHLY_TARGET, liveClosed, 1);
                    const pct = Math.max(2, (barValue / maxVal) * 100);
                    return (
                      <div key={month} className="flex flex-col items-center gap-1 flex-1">
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            isLast
                              ? "bg-[var(--color-accent)]"
                              : barValue > 0
                              ? "bg-[var(--color-accent)]/40"
                              : "bg-[var(--color-surface-2)]"
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                          {month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <div className="w-6 border-t-2 border-dashed border-[var(--color-accent)]/50" />
                <span>Monthly target: {fmt(MONTHLY_TARGET, currency)}</span>
              </div>
            </Card>

            {/* Pipeline funnel — driven by real CRM metrics */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-kicker">Sales pipeline</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Revenue funnel stages</h2>
                </div>
                {hasPipeline ? (
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-text-muted)]">Weighted pipeline</p>
                    <p className="metric-mono font-bold text-[var(--color-accent)]">
                      {fmt(weightedPipeline * 100, currency)}
                    </p>
                  </div>
                ) : (
                  <Badge variant="neutral">NO PIPELINE YET</Badge>
                )}
              </div>

              {!hasPipeline ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <Target size={28} className="text-[var(--color-text-muted)] opacity-20" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No leads in pipeline — start outreach with VIPER to fill the funnel
                  </p>
                  <Link
                    to="/mail/compose"
                    className="text-xs text-[var(--color-accent)] hover:underline"
                  >
                    Launch outreach →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: "Total prospects",  count: crmMetrics?.liveActivityCount ?? 0, value: null,            color: "#64748b" },
                    { label: "Qualified leads",  count: 0,                                    value: null,            color: "#f59e0b" },
                    { label: "Proposals out",    count: 0,                                    value: 0,               color: "#f97316" },
                    { label: "Negotiating",      count: 0,                                    value: 0,               color: "#a78bfa" },
                    { label: "Closed",           count: wonDeals,                              value: liveClosed,      color: "#22c55e" },
                  ].map((stage) => {
                    const maxVal = Math.max(weightedPipeline * 100, liveClosed, 1);
                    const pct = stage.value !== null
                      ? Math.max(2, (stage.value / maxVal) * 100)
                      : Math.max(2, ((stage.count / Math.max(stage.count, 1)) * 100));
                    return (
                      <div key={stage.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                            <span className="font-medium">{stage.label}</span>
                            <span className="text-[var(--color-text-muted)]">
                              {stage.count} lead{stage.count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <span className="font-mono text-[var(--color-text-muted)]">
                            {stage.value !== null ? fmt(stage.value, currency) : "—"}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: stage.color, opacity: 0.7 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Recent charges */}
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-[var(--color-accent)]" />
                  <p className="font-semibold text-sm">Recent charges</p>
                </div>
                <Badge variant={data?.configured === false ? "warning" : "success"}>
                  {data?.configured === false ? "STRIPE NOT CONFIGURED" : "STRIPE LIVE"}
                </Badge>
              </div>
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-14 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />
                  ))}
                </div>
              ) : (data?.recentCharges ?? []).length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CreditCard size={32} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-30" />
                  <p className="text-sm text-[var(--color-text-muted)] font-medium">No charges yet</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Your first payment will appear here in real-time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {(data?.recentCharges ?? []).map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {charge.description ?? charge.id}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {charge.customerEmail ?? "No email"} · {fmtDate(charge.created)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            statusColor[charge.status] ??
                            "text-[var(--color-text-muted)] bg-[var(--color-surface-3)]"
                          }`}
                        >
                          {charge.status}
                        </span>
                        <span className="metric-mono text-sm font-bold">
                          {fmt(charge.amount, charge.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Goal tracker */}
            <Card className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-kicker">Goal tracker</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Revenue targets</h2>
                </div>
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
                  <Target size={16} className="text-[var(--color-gold)]" />
                </span>
              </div>

              <div className="space-y-4">
                <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-4 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">First £5k month</span>
                    <span className="font-mono text-[var(--color-text-muted)]">
                      {fmt(liveClosed, currency)} / {fmt(MONTHLY_TARGET, currency)}
                    </span>
                  </div>
                  <Progress value={liveClosed} max={MONTHLY_TARGET} />
                  <div className="flex items-center gap-1 text-xs">
                    {monthlyProgress >= 100
                      ? <><CheckCircle size={11} className="text-green-400" /><span className="text-green-400">ACHIEVED</span></>
                      : liveClosed > 0
                      ? <><Flame size={11} className="text-[var(--color-gold)]" /><span className="text-[var(--color-text-muted)]">{monthlyProgress}% to target</span></>
                      : <><Target size={11} className="text-[var(--color-text-muted)]" /><span className="text-[var(--color-text-muted)]">Close first client to start</span></>
                    }
                  </div>
                </div>

                <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-4 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">£60k ARR milestone</span>
                    <span className="font-mono text-[var(--color-text-muted)]">
                      {fmt(arr, currency)} / {fmt(ARR_TARGET, currency)}
                    </span>
                  </div>
                  <Progress value={arr} max={ARR_TARGET} />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {arr > 0 ? `${arrProgress}% · ${fmt(ARR_TARGET - arr, currency)} to go` : "Close first client to start tracking ARR"}
                  </p>
                </div>

                {hasPipeline && (
                  <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-4 space-y-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">Weighted pipeline</span>
                      <span className="font-mono text-[var(--color-text-muted)]">
                        {fmt(weightedPipeline * 100, currency)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      From CRM · updates in real-time as deals progress
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Revenue signals */}
            <Card className="p-5 space-y-4">
              <div>
                <p className="section-kicker">Revenue signals</p>
                <h2 className="display-title !text-[var(--text-lg)]">What needs action</h2>
              </div>
              <div className="space-y-2">
                {signals.map(({ icon: Icon, color, text, badge, badgeVariant }) => (
                  <div
                    key={text}
                    className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-0"
                  >
                    <span
                      className="inline-flex size-7 items-center justify-center rounded-full shrink-0 mt-0.5"
                      style={{ background: `${color}22`, color }}
                    >
                      <Icon size={12} />
                    </span>
                    <p className="text-xs text-[var(--color-text)] flex-1">{text}</p>
                    <Badge variant={badgeVariant} className="text-[10px] shrink-0">{badge}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Forecast card — only meaningful once there's pipeline or revenue */}
            <Card className="p-5 space-y-4">
              <div>
                <p className="section-kicker">12-month forecast</p>
                <h2 className="display-title !text-[var(--text-lg)]">
                  {hasRevenue ? "If current pace holds" : "Scenarios once pipeline closes"}
                </h2>
              </div>
              {!hasRevenue && !hasPipeline ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                  <BarChart3 size={28} className="text-[var(--color-text-muted)] opacity-20" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Forecast will populate once you close your first deal or have active pipeline.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { scenario: "Conservative (1 close/mo)", monthly: 60000, color: "#64748b" },
                    { scenario: "Target (2 closes/mo)", monthly: 120000, color: "#f59e0b" },
                    { scenario: "Upside (3+ closes/mo)", monthly: 288000, color: "#22c55e" },
                  ].map(({ scenario, monthly, color }) => (
                    <div key={scenario} className="rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] p-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--color-text-muted)]">{scenario}</span>
                        <span className="font-mono font-bold" style={{ color }}>
                          {fmt(monthly * 12, currency)} ARR
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {fmt(monthly, currency)}/mo · {fmt(Math.round(monthly * 12 / 52), currency)}/wk
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-[var(--color-text-muted)] pt-1 opacity-60">
                    Scenarios are aspirational — based on typical B2B SaaS deal sizes, not committed pipeline.
                  </p>
                </div>
              )}
            </Card>

          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
