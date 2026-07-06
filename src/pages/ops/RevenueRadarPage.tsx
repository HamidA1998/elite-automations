import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Globe2,
  LockKeyhole,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchRevenueRadar, runRevenueRadarScan } from "@/services/api";
import type { RevenueRadarResponse, RevenueRadarScanResponse } from "@/types/frontend";

const money = new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP", maximumFractionDigits: 0});

const statusVariant: Record<RevenueRadarResponse["internetAccess"][number]["status"], "success" | "warning" | "error" | "info" | "neutral"> = {
  live: "success",
  ready: "info",
  blocked: "error",
  "approval-gated": "warning",
};

const priorityVariant: Record<RevenueRadarResponse["nextActions"][number]["priority"], "success" | "warning" | "error" | "info" | "neutral"> = {
  high: "error",
  medium: "warning",
  low: "neutral",
};

function formatRun(value: string) {
  if (!value || value === "Manual run only") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {weekday: "short", hour: "2-digit", minute: "2-digit"});
}

function StatCell({label, value, detail}: {label: string; value: string | number; detail: string}) {
  return (
    <div className="rounded-[22px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] p-4">
      <p className="section-kicker">{label}</p>
      <p className="metric-mono mt-3 text-[clamp(1.8rem,3vw,3rem)] font-semibold tracking-[-0.06em] text-[var(--color-text)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{detail}</p>
    </div>
  );
}

function EmptyPanel({title, detail}: {title: string; detail: string}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--color-border-strong)] bg-[rgba(255,255,255,0.025)] p-6">
      <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{detail}</p>
    </div>
  );
}

function AccessIcon({status}: {status: RevenueRadarResponse["internetAccess"][number]["status"]}) {
  if (status === "live") return <CheckCircle2 size={16} />;
  if (status === "approval-gated") return <LockKeyhole size={16} />;
  if (status === "blocked") return <AlertTriangle size={16} />;
  return <ShieldCheck size={16} />;
}

function ScanResults({result}: {result: RevenueRadarScanResponse | null}) {
  if (!result) return null;
  return (
    <Card className="p-0">
      <div className="border-b border-[var(--color-border)] p-5">
        <p className="section-kicker">Latest web money scan</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--color-text)]">{result.created} created, {result.existing} already known, {result.skipped} skipped</h2>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {result.results.map((item) => (
          <div key={`${item.businessName}-${item.url ?? item.status}`} className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.status === "created" ? "success" : item.status === "existing" ? "info" : "neutral"}>{item.status}</Badge>
                <Badge variant={item.score >= 70 ? "success" : item.score >= 50 ? "warning" : "neutral"}>{item.score}/100</Badge>
              </div>
              <p className="mt-3 truncate text-base font-semibold text-[var(--color-text)]">{item.businessName}</p>
              <p className="mt-1 text-xs text-[var(--color-text-faint)]">{item.url ?? "No URL captured"}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{item.reason}</p>
            </div>
            {item.clientId ? (
              <Link to={`/leads/${item.clientId}`}>
                <Button variant="secondary" className="w-full md:w-auto">
                  Open file
                  <ArrowUpRight size={14} />
                </Button>
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RevenueRadarPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("private dentists outdated websites booking reviews");
  const [location, setLocation] = useState("Greater Manchester");
  const [maxLeads, setMaxLeads] = useState(10);
  const [scanResult, setScanResult] = useState<RevenueRadarScanResponse | null>(null);

  const radarQuery = useQuery({
    queryKey: ["revenue-radar"],
    queryFn: fetchRevenueRadar,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const scanMutation = useMutation({
    mutationFn: runRevenueRadarScan,
    onSuccess: async (result) => {
      setScanResult(result);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["revenue-radar"]}),
        queryClient.invalidateQueries({queryKey: ["accounts"]}),
        queryClient.invalidateQueries({queryKey: ["dashboard-state"]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
  });

  const data = radarQuery.data;
  const sortedAccess = useMemo(
    () => [...(data?.internetAccess ?? [])].sort((left, right) => {
      const order = {"live": 0, "approval-gated": 1, ready: 2, blocked: 3};
      return order[left.status] - order[right.status] || left.label.localeCompare(right.label);
    }),
    [data?.internetAccess],
  );

  const runScan = () => {
    scanMutation.mutate({
      query,
      location,
      maxLeads: Math.max(1, Math.min(25, maxLeads)),
    });
  };

  return (
    <PageWrapper
      eyebrow="OPS · REVENUE RADAR"
      title="Money engine control."
      description="The operating layer that gives LEADGEN, OPS, OUTREACH, BUILDER, JARVIS, and FINANCE controlled web access to find, prove, close, and collect revenue."
      actions={
        <>
          <Link to="/ops/approvals">
            <Button variant="secondary">
              <ShieldCheck size={16} />
              Approvals
            </Button>
          </Link>
          <Link to="/ops/automation">
            <Button>
              <Zap size={16} />
              Automation
            </Button>
          </Link>
        </>
      }
    >
      {radarQuery.isLoading ? (
        <Card className="p-8">
          <p className="section-kicker">Loading Revenue Radar</p>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">Reading live integrations, client files, approvals, and pipeline pressure.</p>
        </Card>
      ) : data ? (
        <>
          <section className="revenue-radar-hero">
            <Card className="relative overflow-hidden p-0">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_20%,rgba(201,169,110,0.20),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(71,215,255,0.13),transparent_32%)]" />
              <div className="relative z-[1] p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-12 items-center justify-center rounded-[18px] border border-[var(--color-border-strong)] bg-[rgba(255,255,255,0.045)] text-[var(--color-gold)]">
                      <Radar size={20} />
                    </span>
                    <div>
                      <p className="section-kicker">Autonomous revenue doctrine</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Web access is active where configured. Outside-world actions stay gated.</p>
                    </div>
                  </div>
                  <Badge variant={data.score >= 75 ? "success" : data.score >= 55 ? "warning" : "error"}>{data.score}/100 readiness</Badge>
                </div>
                <h2 className="mt-8 max-w-4xl font-display text-[clamp(2.25rem,5vw,5.6rem)] font-light leading-[0.94] tracking-[-0.055em] text-[var(--color-text)]">
                  Find money. Prove value. Ask for the close.
                </h2>
                <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--color-text-muted)]">{data.thesis}</p>
                <div className="revenue-radar-stat-grid mt-8">
                  <StatCell label="Weighted pipeline" value={money.format(data.moneyToday.pipeline)} detail="Known opportunity value" />
                  <StatCell label="Ready to close" value={data.moneyToday.readyToClose} detail="Files JARVIS can push" />
                  <StatCell label="Research backlog" value={data.moneyToday.researchBacklog} detail="Missing email or phone" />
                  <StatCell label="Proof backlog" value={data.moneyToday.proofBacklog} detail="Needs browser evidence" />
                  <StatCell label="Approvals" value={data.moneyToday.approvals} detail="Outside-world gates" />
                  <StatCell label="Next run" value={formatRun(data.moneyToday.nextRun)} detail="Hourly autopilot status" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker">Run web discovery</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[var(--color-text)]">Top up the pipeline with live data.</h2>
                </div>
                <span className="inline-flex size-11 items-center justify-center rounded-[16px] border border-[var(--color-border)] text-[var(--color-accent-2)]">
                  <Globe2 size={18} />
                </span>
              </div>
              <div className="mt-6 grid gap-4">
                <Input label="Search query" value={query} onChange={(event) => setQuery(event.target.value)} />
                <Input label="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
                <Input
                  label="Max leads"
                  type="number"
                  min={1}
                  max={25}
                  value={maxLeads}
                  onChange={(event) => setMaxLeads(Number(event.target.value))}
                />
                <Button onClick={runScan} disabled={scanMutation.isPending || !query.trim() || !location.trim()} className="w-full">
                  <Search size={16} />
                  {scanMutation.isPending ? "Searching the web" : "Run money scan"}
                </Button>
                {scanMutation.error ? (
                  <p className="rounded-[18px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] p-3 text-sm text-[var(--color-error)]">
                    {scanMutation.error instanceof Error ? scanMutation.error.message : "Scan failed."}
                  </p>
                ) : null}
                <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                  This creates CRM files from live web discovery. Emails, calls, SMS, and payment links still route through approvals.
                </p>
              </div>
            </Card>
          </section>

          <section className="revenue-radar-two">
            <Card className="p-0">
              <div className="border-b border-[var(--color-border)] p-5">
                <p className="section-kicker">Internet access map</p>
                <h2 className="mt-2 text-xl font-semibold">What the machine can use right now</h2>
              </div>
              <div className="revenue-radar-access-grid p-5">
                {sortedAccess.map((access) => (
                  <Link key={access.provider} to={access.route} className="group block rounded-[22px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
                    <div className="h-full rounded-[22px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.028)] p-4 transition-all duration-200 group-hover:-translate-y-px group-hover:border-[var(--color-border-strong)] group-hover:bg-[rgba(255,255,255,0.045)]">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex size-10 items-center justify-center rounded-[15px] border border-[var(--color-border)] text-[var(--color-accent-2)]">
                          <AccessIcon status={access.status} />
                        </span>
                        <Badge variant={statusVariant[access.status]}>{access.status}</Badge>
                      </div>
                      <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">{access.label}</p>
                      <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{access.job}</p>
                      <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[11px] leading-5 text-[var(--color-text-faint)]">{access.guardrail}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="p-0">
              <div className="border-b border-[var(--color-border)] p-5">
                <p className="section-kicker">Money loop</p>
                <h2 className="mt-2 text-xl font-semibold">From web signal to paid client</h2>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {data.moneyLoops.map((loop, index) => (
                  <Link key={loop.stage} to={loop.route} className="group grid gap-4 p-5 transition-colors hover:bg-[rgba(255,255,255,0.035)] md:grid-cols-[48px_1fr_auto]">
                    <span className="metric-mono inline-flex size-11 items-center justify-center rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-gold)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-[var(--color-text)]">{loop.stage}</p>
                        <Badge variant={statusVariant[loop.status]}>{loop.status}</Badge>
                        <Badge variant="neutral">{loop.owner}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{loop.output}</p>
                    </div>
                    <ArrowUpRight size={16} className="text-[var(--color-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-accent)]" />
                  </Link>
                ))}
              </div>
            </Card>
          </section>

          <section className="revenue-radar-two">
            <Card className="p-0">
              <div className="border-b border-[var(--color-border)] p-5">
                <p className="section-kicker">Ranked money opportunities</p>
                <h2 className="mt-2 text-xl font-semibold">Accounts worth moving now</h2>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {data.opportunities.length ? data.opportunities.slice(0, 12).map((item) => (
                  <div key={item.clientId} className="grid gap-4 p-5 xl:grid-cols-[1fr_190px_170px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.moneyScore >= 80 ? "success" : item.moneyScore >= 60 ? "warning" : "neutral"}>{item.moneyScore}/100</Badge>
                        <Badge variant="info">{item.owner}</Badge>
                        <Badge variant="neutral">{item.status}</Badge>
                      </div>
                      <p className="mt-3 truncate text-base font-semibold text-[var(--color-text)]">{item.businessName}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-faint)]">{item.businessType} · {item.area}</p>
                      <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">{item.nextAction}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.gaps.map((gap) => <Badge key={gap} variant="warning">{gap}</Badge>)}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                      <p className="section-kicker !text-[9px]">Commercial read</p>
                      <p className="metric-mono mt-2 text-2xl font-semibold text-[var(--color-text)]">{money.format(item.dealValue)}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.closeProbability}% close probability</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link to={item.route}>
                        <Button variant="secondary" className="w-full justify-between">
                          Client file
                          <ArrowUpRight size={14} />
                        </Button>
                      </Link>
                      <Link to={item.dossierRoute}>
                        <Button variant="ghost" className="w-full justify-between">
                          Evidence
                          <ArrowUpRight size={14} />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )) : (
                  <div className="p-6">
                    <EmptyPanel title="No money opportunities ranked yet" detail="Run a web money scan or create client files with website/contact evidence so the radar can score them." />
                  </div>
                )}
              </div>
            </Card>

            <div className="grid gap-6">
              <Card className="p-0">
                <div className="border-b border-[var(--color-border)] p-5">
                  <p className="section-kicker">Niche attack map</p>
                  <h2 className="mt-2 text-xl font-semibold">Best segments to hunt</h2>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {data.niches.map((niche) => (
                    <Link key={niche.id} to={niche.route} className="group block p-5 transition-colors hover:bg-[rgba(255,255,255,0.035)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={niche.score >= 80 ? "success" : "warning"}>{niche.score}/100</Badge>
                            <Badge variant="neutral">{niche.location}</Badge>
                          </div>
                          <p className="mt-3 text-base font-semibold text-[var(--color-text)]">{niche.label}</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{niche.reason}</p>
                          <p className="mt-3 text-xs leading-5 text-[var(--color-text-faint)]">{niche.offer}</p>
                        </div>
                        <Target size={16} className="mt-1 shrink-0 text-[var(--color-gold)]" />
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>

              <Card className="p-0">
                <div className="border-b border-[var(--color-border)] p-5">
                  <p className="section-kicker">Next best actions</p>
                  <h2 className="mt-2 text-xl font-semibold">What Hamid should do next</h2>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {data.nextActions.map((action) => (
                    <Link key={`${action.owner}-${action.label}`} to={action.route} className="group grid gap-3 p-5 transition-colors hover:bg-[rgba(255,255,255,0.035)] md:grid-cols-[1fr_auto]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={priorityVariant[action.priority]}>{action.priority}</Badge>
                          <Badge variant="info">{action.owner}</Badge>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{action.label}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{action.reason}</p>
                      </div>
                      <ArrowUpRight size={16} className="text-[var(--color-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-accent)]" />
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          <ScanResults result={scanResult} />
        </>
      ) : (
        <Card className="p-8">
          <p className="section-kicker">Revenue Radar unavailable</p>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">The backend did not return a radar payload. Check the dashboard server logs and integrations status.</p>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <Clock3 size={16} className="text-[var(--color-gold)]" />
          <span>Autonomy policy: research, enrichment, audit, and draft generation can run automatically. Sending email, placing calls, SMS, payment links, and destructive actions stay approval-gated unless Hamid explicitly enables the live-send environment flag.</span>
        </div>
      </Card>
    </PageWrapper>
  );
}
