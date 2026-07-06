import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Activity,
  Archive,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Compass,
  FileSearch,
  Headphones,
  MailCheck,
  MessageSquareText,
  Palette,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  fetchDealRoom,
  fetchDesignLab,
  fetchFinanceGuard,
  fetchLeadEvidenceDossier,
  fetchOwnedVoiceAgent,
  fetchOpportunityEngine,
  fetchProofVault,
  fetchReplyRadar,
  fetchWarRoom,
  generateDealRoomProposal,
  runLeadBrowserAudit,
  runOwnedVoiceAgentTurn,
  syncReplyRadar,
} from "@/services/api";
import type {
  DealRoomResponse,
  DesignLabResponse,
  FinanceGuardResponse,
  LeadEvidenceDossierResponse,
  OwnedVoiceAgentTurnResponse,
  OpportunityEngineResponse,
  ProofVaultResponse,
  ReplyRadarResponse,
  WarRoomResponse,
} from "@/types/frontend";

const money = new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP", maximumFractionDigits: 0});

function knownMoney(value: number) {
  return value > 0 ? money.format(value) : "Unpriced";
}

function toneVariant(tone: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (tone === "success" || tone === "connected" || tone === "ready") return "success";
  if (tone === "danger" || tone === "blocked" || tone === "missing") return "error";
  if (tone === "warning" || tone === "needs-setup" || tone === "needs-stripe" || tone === "needs-proposal") return "warning";
  if (tone === "info") return "info";
  return "neutral";
}

function StatTile({label, value, detail}: {label: string; value: string | number; detail: string}) {
  return (
    <div className="rounded-[24px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] p-4">
      <p className="section-kicker">{label}</p>
      <p className="metric-mono mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-text)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{detail}</p>
    </div>
  );
}

function ToolHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklab,var(--color-accent)_18%,transparent),transparent_34%),linear-gradient(135deg,var(--color-surface),color-mix(in_oklab,var(--color-bg)_88%,black))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.034)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:44px_44px] opacity-40" />
      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-12 items-center justify-center rounded-[18px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.045)] text-[var(--color-accent)]">
              <Icon size={20} />
            </span>
            <p className="section-kicker">{eyebrow}</p>
          </div>
          <h1 className="mt-5 font-display text-[clamp(2.2rem,4vw,4.8rem)] font-light leading-[0.94] tracking-[-0.045em] text-[var(--color-text)]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-text-muted)] md:text-base">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>
    </section>
  );
}

function ReplyRadarPanel({data}: {data: ReplyRadarResponse}) {
  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: syncReplyRadar,
    onSuccess: () => queryClient.invalidateQueries({queryKey: ["owned-tool", "reply-radar"]}),
  });

  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="OUTREACH · REPLY RADAR"
        title="No warm reply gets missed."
        description="Reads Gmail, classifies intent, matches replies to client files, then writes next actions into the CRM timeline when you sync."
        icon={MailCheck}
        actions={
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <Sparkles size={16} />
            {syncMutation.isPending ? "Syncing" : "Sync into CRM"}
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Inbox read" value={data.summary.inboxRead} detail={data.connected ? data.account : "Gmail not connected"} />
        <StatTile label="Linked" value={data.summary.linkedReplies} detail="matched to client files" />
        <StatTile label="Hot" value={data.summary.hotReplies} detail="buying intent" />
        <StatTile label="Objections" value={data.summary.objections} detail="needs handling" />
        <StatTile label="Actions" value={data.summary.actionsDue} detail="tasks worth creating" />
        <StatTile label="Unmatched" value={data.summary.unmatched} detail="needs client match" />
      </section>

      {data.gaps.length ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 text-[var(--color-warning)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Radar gaps</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {data.gaps.map((gap) => (
                  <p key={gap} className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs leading-5 text-[var(--color-text-muted)]">
                    {gap}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)] p-5">
          <p className="section-kicker">Classified replies</p>
          <h2 className="mt-2 text-xl font-semibold">Inbox intent queue</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {data.messages.length ? data.messages.slice(0, 20).map((message) => (
            <div key={message.id} className="grid gap-4 p-5 xl:grid-cols-[1fr_220px_180px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={toneVariant(message.sentiment)}>{message.sentiment}</Badge>
                  <Badge variant={toneVariant(message.urgency)}>{message.urgency}</Badge>
                  {message.linkedClient ? <Badge variant="success">{message.linkedClient.confidence}% match</Badge> : <Badge variant="warning">unmatched</Badge>}
                </div>
                <p className="mt-3 truncate text-base font-semibold text-[var(--color-text)]">{message.subject}</p>
                <p className="mt-1 text-xs text-[var(--color-text-faint)]">{message.fromName || message.fromEmail} · {message.receivedAt ? new Date(message.receivedAt).toLocaleString("en-GB") : "unknown time"}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-text-muted)]">{message.preview}</p>
              </div>
              <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="section-kicker !text-[9px]">Suggested action</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{message.suggestedAction.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{message.suggestedAction.reason}</p>
              </div>
              <div className="flex flex-col justify-between gap-3">
                {message.linkedClient ? (
                  <Link to={message.linkedClient.route}>
                    <Button variant="secondary" className="w-full justify-between">
                      {message.linkedClient.businessName}
                      <ArrowUpRight size={14} />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/crm/contacts">
                    <Button variant="secondary" className="w-full justify-between">
                      Match contact
                      <ArrowUpRight size={14} />
                    </Button>
                  </Link>
                )}
                <p className="text-[11px] leading-4 text-[var(--color-text-faint)]">{message.evidence.join(" · ")}</p>
              </div>
            </div>
          )) : (
            <div className="p-8 text-sm text-[var(--color-text-muted)]">
              No Gmail messages were available. Connect Gmail or refresh after new replies arrive.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function VoiceAgentPanel({data}: {data: Awaited<ReturnType<typeof fetchOwnedVoiceAgent>>}) {
  const [transcript, setTranscript] = useState("Hi, I want to book a call about improving my website and getting more enquiries.");
  const [result, setResult] = useState<OwnedVoiceAgentTurnResponse | null>(null);
  const turnMutation = useMutation({
    mutationFn: runOwnedVoiceAgentTurn,
    onSuccess: setResult,
  });

  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="VOICE · OWNED AGENT"
        title="A calm first-party voice brain."
        description="This is the custom layer behind Twilio/ElevenLabs/OpenAI voice transport: client lookup, intent, memory, booking tasks, and safe handoff."
        icon={Headphones}
        actions={
          <Link to="/calls/agents">
            <Button variant="secondary">
              Open call config
              <ArrowUpRight size={16} />
            </Button>
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <p className="section-kicker">Persona</p>
          <h2 className="mt-2 text-xl font-semibold">{data.profile.name}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">{data.profile.tone}</p>
          <div className="mt-5 grid gap-3">
            {data.profile.operatingRules.map((rule) => (
              <div key={rule} className="flex items-start gap-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <ShieldCheck size={16} className="mt-0.5 text-[var(--color-accent)]" />
                <p className="text-xs leading-5 text-[var(--color-text-muted)]">{rule}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Test console</p>
          <h2 className="mt-2 text-xl font-semibold">Simulate a caller.</h2>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            className="mt-5 min-h-36 w-full resize-y rounded-[22px] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm leading-6 text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)]"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => turnMutation.mutate({transcript})} disabled={turnMutation.isPending || !transcript.trim()}>
              <MessageSquareText size={16} />
              {turnMutation.isPending ? "Thinking" : "Run voice brain"}
            </Button>
          </div>
          {result ? (
            <div className="mt-5 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{result.intent}</Badge>
                <Badge variant="success">{result.confidence}% confidence</Badge>
                {result.matchedClient ? <Badge variant="success">{result.matchedClient.businessName}</Badge> : <Badge variant="warning">no client match</Badge>}
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--color-text)]">{result.reply}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {result.actions.map((action) => (
                  <div key={`${action.type}-${action.label}`} className="rounded-[18px] bg-[var(--color-bg)] p-3">
                    <p className="text-xs font-semibold text-[var(--color-text)]">{action.label}</p>
                    <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">{action.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}

function DealRoomPanel({data}: {data: DealRoomResponse}) {
  const queryClient = useQueryClient();
  const generateMutation = useMutation({
    mutationFn: () => generateDealRoomProposal(data.client.clientId),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ["owned-tool", "deal-room"]}),
  });

  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="CLIENT OS · DEAL ROOM"
        title={`${data.client.businessName} close room.`}
        description="A conversion workspace that turns audit proof, proposal scope, payment readiness, and next steps into a single decision path."
        icon={CircleDollarSign}
        actions={
          <>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <Sparkles size={16} />
              {generateMutation.isPending ? "Drafting" : "Draft proposal"}
            </Button>
            <Link to={data.client.route}>
              <Button variant="secondary">
                Open client file
                <ArrowUpRight size={16} />
              </Button>
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Readiness" value={`${data.readinessScore}%`} detail="proposal/payment/client proof" />
        <StatTile label="Setup fee" value={money.format(data.offer.setupFee)} detail={data.offer.packageName} />
        <StatTile label="Retainer" value={money.format(data.offer.monthlyRetainer)} detail="post-launch care" />
        <StatTile label="Proposals" value={data.proposals.length} detail={data.offer.paymentStatus.replace("-", " ")} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-6">
          <p className="section-kicker">Offer architecture</p>
          <h2 className="mt-2 text-xl font-semibold">{data.offer.packageName}</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">{data.offer.proofAngle}</p>
          <div className="mt-5 grid gap-3">
            {data.offer.scope.map((scope) => (
              <div key={scope} className="flex items-start gap-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <CheckCircle2 size={16} className="mt-0.5 text-[var(--color-success)]" />
                <p className="text-sm leading-6 text-[var(--color-text-muted)]">{scope}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Blockers</p>
          <h2 className="mt-2 text-xl font-semibold">What stops payment.</h2>
          <div className="mt-5 space-y-3">
            {data.blockers.length ? data.blockers.map((blocker) => (
              <div key={blocker.label} className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <Badge variant={toneVariant(blocker.severity)}>{blocker.severity}</Badge>
                <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{blocker.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{blocker.detail}</p>
              </div>
            )) : (
              <p className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
                No major blockers detected. Review the proposal and payment route before sending.
              </p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <p className="section-kicker">Proof pack</p>
          <div className="mt-5 space-y-3">
            {data.proof.length ? data.proof.map((proof) => (
              <div key={`${proof.label}-${proof.detail}`} className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">{proof.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{proof.detail}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-faint)]">{proof.source}</p>
              </div>
            )) : <p className="text-sm text-[var(--color-text-muted)]">Run an audit to create stronger proof before sending.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Close plan</p>
          <div className="mt-5 space-y-3">
            {data.closePlan.map((step, index) => (
              <div key={step.step} className="grid grid-cols-[40px_1fr] gap-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <span className="metric-mono flex size-9 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-accent)]">{index + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{step.step}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-faint)]">{step.owner} · {step.outcome}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function FinanceGuardPanel({data}: {data: FinanceGuardResponse}) {
  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="FINANCE · GUARD"
        title="Protect margin before scaling."
        description="Reads real payment state, pipeline value, connector readiness, and spend policy so growth does not quietly leak profit."
        icon={ShieldCheck}
        actions={
          <Link to="/pay">
            <Button variant="secondary">
              Open revenue
              <ArrowUpRight size={16} />
            </Button>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Stripe" value={data.summary.stripeConnected ? "Live" : data.summary.stripeConfigured ? "Blocked" : "Setup"} detail={data.summary.mode} />
        <StatTile label="Available" value={money.format(data.summary.availableBalance)} detail="Stripe balance" />
        <StatTile label="Pending" value={money.format(data.summary.pendingBalance)} detail="Stripe balance" />
        <StatTile label="Collected" value={money.format(data.summary.recentCollected)} detail={`${data.summary.recentChargeCount} recent charges`} />
        <StatTile label="Pipeline" value={money.format(data.summary.weightedPipeline)} detail="weighted CRM value" />
        <StatTile label="At risk" value={money.format(data.summary.openRevenueAtRisk)} detail="pipeline not collected" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-6">
          <p className="section-kicker">Alerts</p>
          <div className="mt-5 space-y-3">
            {data.alerts.length ? data.alerts.map((alert) => (
              <Link key={alert.id} to={alert.route} className="block rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-border-strong)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant={toneVariant(alert.tone)}>{alert.tone}</Badge>
                    <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{alert.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{alert.detail}</p>
                  </div>
                  <ArrowUpRight size={15} className="text-[var(--color-text-muted)]" />
                </div>
              </Link>
            )) : (
              <p className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
                No finance alerts. Keep proposals and payment routes current.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Cost caps</p>
          <div className="mt-5 space-y-3">
            {data.guardrails.map((guardrail) => (
              <div key={guardrail.area} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{guardrail.area}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Approval above {money.format(guardrail.approvalRequiredAbove)} · daily cap {money.format(guardrail.dailyCap)}</p>
                  </div>
                  <Badge variant={guardrail.status === "active" ? "success" : "warning"}>{guardrail.status.replace("-", " ")}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-6">
        <p className="section-kicker">Reconciliation spine</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.reconciliation.map((item) => (
            <div key={item.label} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <Badge variant={toneVariant(item.status)}>{item.status.replace("-", " ")}</Badge>
              <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{item.source}</p>
              <p className="mt-3 text-[11px] leading-4 text-[var(--color-text-faint)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function WarRoomPanel({data}: {data: WarRoomResponse}) {
  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="JARVIS · WAR ROOM"
        title="The business brain, not a dashboard."
        description="A live command doctrine that reads tools, connectors, client proof, money pressure, and blockers to decide what deserves Hamid's focus next."
        icon={Radar}
        actions={
          <Link to="/ops">
            <Button variant="secondary">
              Open Mission Control
              <ArrowUpRight size={16} />
            </Button>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Irreplaceability" value={`${data.irreplaceabilityScore}%`} detail="owned loops + proof + connectors" />
        <StatTile label="Loops" value={data.operatingLoops.length} detail="acquire, convert, deliver, collect" />
        <StatTile label="Decisions" value={data.decisions.length} detail="current strategic moves" />
        <StatTile label="Risks" value={data.commandRisks.length} detail="diagnosed from local truth" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <p className="section-kicker">Operating loops</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.operatingLoops.map((loop) => (
              <Link key={loop.id} to={loop.route} className="group rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[var(--color-accent)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant={loop.status === "strong" ? "success" : loop.status === "blocked" ? "error" : "warning"}>{loop.status}</Badge>
                    <h3 className="mt-4 text-lg font-semibold text-[var(--color-text)]">{loop.label}</h3>
                  </div>
                  <span className="metric-mono text-4xl font-semibold tracking-[-0.08em] text-[var(--color-text)]">{loop.score}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">{loop.currentTruth}</p>
                <p className="mt-3 text-xs leading-5 text-[var(--color-text-faint)]">{loop.nextMove}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Doctrine</p>
          <div className="mt-5 space-y-3">
            {data.doctrine.map((rule, index) => (
              <div key={rule} className="grid grid-cols-[36px_1fr] gap-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <span className="metric-mono flex size-8 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-accent)]">{index + 1}</span>
                <p className="text-sm leading-6 text-[var(--color-text-muted)]">{rule}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <p className="section-kicker">Next decisions</p>
          <div className="mt-5 space-y-3">
            {data.decisions.map((decision) => (
              <Link key={decision.label} to={decision.route} className="block rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-border-strong)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant={decision.impact === "high" ? "success" : "info"}>{decision.owner} · {decision.impact}</Badge>
                    <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{decision.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{decision.why}</p>
                  </div>
                  <ArrowUpRight size={15} className="text-[var(--color-text-muted)]" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Command risks</p>
          <div className="mt-5 space-y-3">
            {data.commandRisks.map((risk) => (
              <div key={risk.label} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <Badge variant={toneVariant(risk.severity)}>{risk.severity}</Badge>
                <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{risk.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{risk.diagnostic}</p>
                <p className="mt-3 text-[11px] leading-5 text-[var(--color-text-faint)]">{risk.counterMove}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function laneTone(lane: OpportunityEngineResponse["lanes"][number]["id"]): "success" | "warning" | "error" | "info" | "neutral" {
  if (lane === "close") return "success";
  if (lane === "research") return "error";
  if (lane === "prove") return "warning";
  return "info";
}

function sourceHealthVariant(status: LeadEvidenceDossierResponse["sourceHealth"][number]["status"]): "success" | "warning" | "error" {
  if (status === "strong") return "success";
  if (status === "missing") return "error";
  return "warning";
}

function dossierBandVariant(band: LeadEvidenceDossierResponse["scorecard"]["band"]): "success" | "warning" | "error" | "neutral" {
  if (band === "ready-to-sell") return "success";
  if (band === "needs-contact") return "error";
  if (band === "needs-proof") return "warning";
  return "neutral";
}

function evidenceOutputHref(filePath: string) {
  const marker = "/output/";
  const index = filePath.indexOf(marker);
  const relative = index >= 0 ? filePath.slice(index + marker.length) : filePath.replace(/^\/+/, "");
  return `http://127.0.0.1:3007/${relative}`;
}

function isInternalEvidenceRoute(route: string) {
  if (!route.startsWith("/")) return false;
  if (route.startsWith("/Users/")) return false;
  if (route.includes("/output/")) return false;
  return true;
}

function OpportunityEnginePanel({data}: {data: OpportunityEngineResponse}) {
  const topThree = data.opportunities.slice(0, 3);

  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="JARVIS · OPPORTUNITY ENGINE"
        title="The next money moves, ranked."
        description="Reads live client files, proof, tasks, proposals, contact gaps, stale risk, and deal value so the cockpit points at the highest-leverage move before more work is created."
        icon={Compass}
        actions={
          <>
            <Link to="/ops/tools/deal-room">
              <Button>
                Open close room
                <ArrowUpRight size={16} />
              </Button>
            </Link>
            <Link to="/leads">
              <Button variant="secondary">
                Lead pipeline
                <ArrowUpRight size={16} />
              </Button>
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Ranked" value={data.summary.ranked} detail="live client files scored" />
        <StatTile label="Ready to close" value={data.summary.readyToClose} detail="proof-backed decision paths" />
        <StatTile label="Needs research" value={data.summary.needsResearch} detail="blocked by missing contact" />
        <StatTile label="Known value" value={money.format(data.summary.totalPotential)} detail="priced files only" />
      </section>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Top directive</p>
            <h2 className="mt-2 max-w-4xl text-2xl font-semibold leading-tight text-[var(--color-text)]">{data.summary.topAction}</h2>
          </div>
          <Badge variant={data.summary.readyToClose ? "success" : "warning"}>{data.summary.readyToClose ? "cash path visible" : "build the path"}</Badge>
        </div>
        {topThree.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {topThree.map((item) => (
              <Link key={item.clientId} to={item.route} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={laneTone(item.lane)}>{item.owner} · {item.lane}</Badge>
                    <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{item.businessName}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-faint)]">{item.area} · {knownMoney(item.dealValue)}</p>
                  </div>
                  <span className="metric-mono text-3xl font-semibold tracking-[-0.08em] text-[var(--color-accent)]">{item.score}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">{item.nextMove}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </Card>

      <section className="grid gap-4 xl:grid-cols-4">
        {data.lanes.map((lane) => (
          <Link key={lane.id} to={lane.route} className="group rounded-[24px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.035)] p-5 transition hover:border-[var(--color-accent)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant={laneTone(lane.id)}>{lane.id}</Badge>
                <h3 className="mt-4 text-xl font-semibold text-[var(--color-text)]">{lane.label}</h3>
              </div>
              <ArrowUpRight size={16} className="text-[var(--color-text-muted)] transition group-hover:text-[var(--color-accent)]" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <p className="metric-mono text-3xl font-semibold tracking-[-0.08em] text-[var(--color-text)]">{lane.count}</p>
                <p className="section-kicker !text-[9px]">files</p>
              </div>
              <div>
                <p className="metric-mono truncate text-3xl font-semibold tracking-[-0.08em] text-[var(--color-text)]">{money.format(lane.value)}</p>
                <p className="section-kicker !text-[9px]">known</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--color-text-muted)]">{lane.brief}</p>
          </Link>
        ))}
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)] p-5">
          <p className="section-kicker">Ranked queue</p>
          <h2 className="mt-2 text-xl font-semibold">Work from the top unless JARVIS says otherwise.</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {data.opportunities.length ? data.opportunities.map((item) => (
            <Link key={item.clientId} to={item.route} className="grid gap-4 p-5 transition hover:bg-[rgba(255,255,255,0.03)] xl:grid-cols-[72px_1.1fr_1fr_220px]">
              <div>
                <span className="metric-mono text-4xl font-semibold tracking-[-0.08em] text-[var(--color-text)]">{item.rank}</span>
                <p className="section-kicker !text-[9px]">rank</p>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={laneTone(item.lane)}>{item.lane}</Badge>
                  <Badge variant="neutral">{item.owner}</Badge>
                  <Badge variant="info">{item.closeProbability}% close</Badge>
                </div>
                <p className="mt-3 truncate text-base font-semibold text-[var(--color-text)]">{item.businessName}</p>
                <p className="mt-1 text-xs text-[var(--color-text-faint)]">{item.area} · {item.businessType} · {item.status}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">{item.reason}</p>
              </div>
              <div>
                <p className="section-kicker !text-[9px]">Next move</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text)]">{item.nextMove}</p>
                <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-[var(--color-text-faint)]">{item.proof.join(" · ")}</p>
              </div>
              <div className="flex flex-col justify-between gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                    <p className="section-kicker !text-[8px]">score</p>
                    <p className="metric-mono mt-1 text-2xl font-semibold tracking-[-0.08em]">{item.score}</p>
                  </div>
                  <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                    <p className="section-kicker !text-[8px]">value</p>
                    <p className="metric-mono mt-1 truncate text-2xl font-semibold tracking-[-0.08em]">{knownMoney(item.dealValue)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.blockers.length ? item.blockers.map((blocker) => (
                    <Badge key={blocker.label} variant={toneVariant(blocker.severity)}>{blocker.label}</Badge>
                  )) : <Badge variant="success">clear path</Badge>}
                </div>
              </div>
            </Link>
          )) : (
            <div className="p-8 text-sm text-[var(--color-text-muted)]">
              No opportunities are available yet. Add/enrich client files, then the engine will rank the next money moves.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function EvidenceRouteLink({route, label}: {route: string | null; label: string}) {
  if (!route) return null;
  if (isInternalEvidenceRoute(route)) {
    return (
      <Link to={route} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)]">
        {label}
        <ArrowUpRight size={13} />
      </Link>
    );
  }
  const href = /^https?:\/\//.test(route) ? route : evidenceOutputHref(route);
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)]">
      {label}
      <ArrowUpRight size={13} />
    </a>
  );
}

function EvidenceDossierPanel({
  data,
  onRunAudit,
  isAuditing,
}: {
  data: LeadEvidenceDossierResponse;
  onRunAudit: () => void;
  isAuditing: boolean;
}) {
  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="OPS · LEAD EVIDENCE DOSSIER"
        title={`${data.client.businessName} is now a proof file.`}
        description="A one-click operating file for deciding what to sell, what evidence exists, what is still unsafe, and which agent owns the next move. This is the anti-placeholder lead view."
        icon={FileSearch}
        actions={
          <>
            <Link to={data.client.route}>
              <Button>
                Open client file
                <ArrowUpRight size={16} />
              </Button>
            </Link>
            {data.client.websiteUrl ? (
              <a href={data.client.websiteUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  View website
                  <ArrowUpRight size={16} />
                </Button>
              </a>
            ) : null}
            <Button variant="secondary" onClick={onRunAudit} disabled={!data.client.websiteUrl || isAuditing}>
              {isAuditing ? "Auditing…" : "Run browser audit"}
            </Button>
          </>
        }
      />

      <section className="dossier-stat-grid">
        <StatTile label="Dossier score" value={data.scorecard.dossierScore} detail={data.scorecard.band.replaceAll("-", " ")} />
        <StatTile label="Proof" value={data.scorecard.proofScore} detail="audit, memory, proposal evidence" />
        <StatTile label="Contact" value={data.scorecard.contactScore} detail="email, phone, decision maker" />
        <StatTile label="Commercial" value={data.scorecard.commercialScore} detail="value, stage, proposal path" />
        <StatTile label="Urgency" value={data.scorecard.urgencyScore} detail="stale risk and overdue work" />
      </section>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Client truth</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{data.client.businessType} · {data.client.area}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-muted)]">
              {data.client.address ?? "No address captured yet."}
            </p>
          </div>
          <Badge variant={dossierBandVariant(data.scorecard.band)}>{data.scorecard.band.replaceAll("-", " ")}</Badge>
        </div>
        <div className="dossier-fact-grid mt-5">
          {data.facts.map((fact) => (
            <div key={fact.label} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <Badge variant={toneVariant(fact.tone)}>{fact.label}</Badge>
              <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{fact.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <section className="dossier-two-col">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] p-5">
            <p className="section-kicker">Proof ledger</p>
            <h2 className="mt-2 text-xl font-semibold">Claims the pitch is allowed to make.</h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {data.proof.map((item) => (
              <article key={`${item.label}-${item.detail}`} className="dossier-proof-row p-5">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.label}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">{item.source}</p>
                </div>
                <p className="text-sm leading-6 text-[var(--color-text-muted)]">{item.detail}</p>
                <div className="md:text-right">
                  <EvidenceRouteLink route={item.route} label="Open" />
                </div>
              </article>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] p-5">
            <p className="section-kicker">Conversion gaps</p>
            <h2 className="mt-2 text-xl font-semibold">What we can fix for them.</h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {data.conversionGaps.map((gap) => (
              <article key={`${gap.label}-${gap.evidence}`} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{gap.label}</p>
                  <Badge variant={toneVariant(gap.severity)}>{gap.severity}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">{gap.evidence}</p>
                <p className="mt-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs leading-5 text-[var(--color-text)]">{gap.fix}</p>
              </article>
            ))}
          </div>
        </Card>
      </section>

      <section className="dossier-two-col">
        <Card className="p-6">
          <p className="section-kicker">Demo blueprint</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{data.demoBlueprint.heroAngle}</h2>
          <div className="dossier-mini-grid mt-5">
            {data.demoBlueprint.sections.map((section) => (
              <div key={section.name} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">{section.name}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{section.purpose}</p>
                <p className="mt-3 text-[11px] leading-5 text-[var(--color-text-faint)]">Proof: {section.proof}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Automation opportunities</p>
          <div className="mt-5 space-y-3">
            {data.demoBlueprint.automations.map((automation) => (
              <div key={automation.name} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{automation.name}</p>
                  <Badge variant="info">{automation.trigger}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{automation.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="dossier-three-col">
        <Card className="p-6">
          <p className="section-kicker">Outreach angles</p>
          <div className="mt-5 space-y-4">
            {data.outreachAngles.map((angle) => (
              <article key={angle.subject} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">{angle.subject}</p>
                <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">{angle.opener}</p>
                <p className="mt-3 text-xs leading-5 text-[var(--color-text)]">{angle.offer}</p>
                <p className="mt-3 text-[11px] leading-5 text-[var(--color-text-faint)]">Evidence: {angle.evidence}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Next actions</p>
          <div className="mt-5 space-y-3">
            {data.nextActions.map((action) => (
              <Link key={`${action.owner}-${action.label}`} to={action.route} className="block rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant={action.priority === "high" ? "error" : action.priority === "medium" ? "warning" : "neutral"}>{action.owner} · {action.priority}</Badge>
                  <ArrowUpRight size={14} className="text-[var(--color-text-muted)]" />
                </div>
                <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{action.label}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{action.reason}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Source health</p>
          <div className="mt-5 space-y-3">
            {data.sourceHealth.map((source) => (
              <div key={source.label} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{source.label}</p>
                  <Badge variant={sourceHealthVariant(source.status)}>{source.status}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{source.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function ProofVaultPanel({data}: {data: ProofVaultResponse}) {
  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="BUILDER · PROOF VAULT"
        title="Every claim needs evidence."
        description="Ranks client files by usable proof, audit depth, contact completeness, and proposal readiness so demos and outreach feel specific, not generic."
        icon={Archive}
        actions={
          <Link to="/leads">
            <Button variant="secondary">
              Open leads
              <ArrowUpRight size={16} />
            </Button>
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatTile label="Audited" value={data.summary.clientsWithAudits} detail="files with browser evidence" />
        <StatTile label="Proof ready" value={data.summary.clientsWithProof} detail="45+ proof score" />
        <StatTile label="Demo ready" value={data.summary.readyForDemo} detail="70+ proof score" />
        <StatTile label="Evidence" value={data.summary.evidenceItems} detail="audits, events, proposals" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-6">
          <p className="section-kicker">Evidence streams</p>
          <div className="mt-5 space-y-3">
            {data.evidenceStreams.map((stream) => (
              <div key={stream.label} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant={stream.quality === "strong" ? "success" : stream.quality === "missing" ? "error" : "warning"}>{stream.quality}</Badge>
                    <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{stream.label}</p>
                  </div>
                  <span className="metric-mono text-3xl font-semibold tracking-[-0.07em]">{stream.count}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">{stream.nextMove}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] p-5">
            <p className="section-kicker">Proof leaders</p>
            <h2 className="mt-2 text-xl font-semibold">Best files to sell from.</h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {data.proofLeaders.length ? data.proofLeaders.map((client) => (
              <Link key={client.clientId} to={client.route} className="grid gap-4 p-5 transition hover:bg-[rgba(255,255,255,0.03)] md:grid-cols-[90px_1fr_180px]">
                <div>
                  <span className="metric-mono text-4xl font-semibold tracking-[-0.08em] text-[var(--color-text)]">{client.proofScore}</span>
                  <p className="section-kicker !text-[9px]">proof</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--color-text)]">{client.businessName}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-faint)]">{client.area} · {client.businessType}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-text-muted)]">{client.strongestProof}</p>
                </div>
                <div>
                  <Badge variant={client.missingProof.length ? "warning" : "success"}>{client.missingProof.length ? "needs proof" : "ready"}</Badge>
                  <p className="mt-3 text-[11px] leading-5 text-[var(--color-text-faint)]">
                    {client.missingProof.length ? client.missingProof.join(" · ") : "Enough evidence to build/sell."}
                  </p>
                </div>
              </Link>
            )) : (
              <div className="p-8 text-sm text-[var(--color-text-muted)]">No client files are available yet.</div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function DesignLabPanel({data}: {data: DesignLabResponse}) {
  return (
    <div className="space-y-6">
      <ToolHero
        eyebrow="BUILDER · DESIGN LAB"
        title="Craft gates for every screen."
        description={data.philosophy}
        icon={Palette}
        actions={
          <Link to="/ops/tools">
            <Button variant="secondary">
              Tool Forge
              <ArrowUpRight size={16} />
            </Button>
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="p-6">
          <p className="section-kicker">Principles</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {data.principles.map((principle) => (
              <div key={principle.name} className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="flex items-start gap-3">
                  <Target size={17} className="mt-1 text-[var(--color-accent)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{principle.name}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-faint)]">{principle.source}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-[var(--color-text-muted)]">{principle.translation}</p>
                <p className="mt-3 rounded-[16px] bg-[var(--color-bg)] p-3 text-[11px] leading-5 text-[var(--color-text-faint)]">{principle.rule}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <p className="section-kicker">Quality gates</p>
          <div className="mt-5 space-y-3">
            {data.qualityGates.map((gate) => (
              <div key={gate.area} className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center gap-3">
                  <Activity size={16} className="text-[var(--color-accent)]" />
                  <p className="text-sm font-semibold text-[var(--color-text)]">{gate.area}</p>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">{gate.passCondition}</p>
                <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-faint)]">Failure: {gate.failureSignal}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-6">
        <p className="section-kicker">Interface modes</p>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {data.interfaceModes.map((mode) => (
            <div key={mode.mode} className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">{mode.mode}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{mode.job}</p>
              <div className="mt-5 space-y-3">
                <div>
                  <p className="section-kicker !text-[9px]">Must show</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{mode.mustShow.join(" · ")}</p>
                </div>
                <div>
                  <p className="section-kicker !text-[9px]">Never do</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{mode.mustNeverDo.join(" · ")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function OwnedToolPage() {
  const {toolId = "reply-radar"} = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const selectedClientId = searchParams.get("clientId") ?? undefined;

  const replyRadarQuery = useQuery({
    queryKey: ["owned-tool", "reply-radar"],
    queryFn: fetchReplyRadar,
    enabled: toolId === "reply-radar",
    staleTime: 45_000,
  });
  const voiceAgentQuery = useQuery({
    queryKey: ["owned-tool", "owned-voice-agent"],
    queryFn: fetchOwnedVoiceAgent,
    enabled: toolId === "owned-voice-agent",
    staleTime: 45_000,
  });
  const dealRoomQuery = useQuery({
    queryKey: ["owned-tool", "deal-room"],
    queryFn: () => fetchDealRoom(),
    enabled: toolId === "deal-room",
    staleTime: 45_000,
  });
  const financeGuardQuery = useQuery({
    queryKey: ["owned-tool", "finance-guard"],
    queryFn: fetchFinanceGuard,
    enabled: toolId === "finance-guard",
    staleTime: 45_000,
  });
  const warRoomQuery = useQuery({
    queryKey: ["owned-tool", "war-room"],
    queryFn: fetchWarRoom,
    enabled: toolId === "war-room",
    staleTime: 45_000,
  });
  const opportunityEngineQuery = useQuery({
    queryKey: ["owned-tool", "opportunity-engine"],
    queryFn: fetchOpportunityEngine,
    enabled: toolId === "opportunity-engine",
    staleTime: 45_000,
  });
  const evidenceDossierQuery = useQuery({
    queryKey: ["owned-tool", "evidence-dossier", selectedClientId],
    queryFn: () => fetchLeadEvidenceDossier(selectedClientId),
    enabled: toolId === "evidence-dossier",
    staleTime: 45_000,
  });
  const proofVaultQuery = useQuery({
    queryKey: ["owned-tool", "proof-vault"],
    queryFn: fetchProofVault,
    enabled: toolId === "proof-vault",
    staleTime: 45_000,
  });
  const designLabQuery = useQuery({
    queryKey: ["owned-tool", "design-lab"],
    queryFn: fetchDesignLab,
    enabled: toolId === "design-lab",
    staleTime: 45_000,
  });
  const browserAuditMutation = useMutation({
    mutationFn: () => runLeadBrowserAudit((evidenceDossierQuery.data as LeadEvidenceDossierResponse | undefined)?.client.clientId ?? selectedClientId ?? ""),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["owned-tool", "evidence-dossier", selectedClientId]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
  });

  const active = useMemo(() => {
    if (toolId === "reply-radar") return {label: "Reply Radar", query: replyRadarQuery};
    if (toolId === "owned-voice-agent") return {label: "Owned Voice Agent", query: voiceAgentQuery};
    if (toolId === "deal-room") return {label: "Deal Room", query: dealRoomQuery};
    if (toolId === "finance-guard") return {label: "Finance Guard", query: financeGuardQuery};
    if (toolId === "war-room") return {label: "War Room Intelligence", query: warRoomQuery};
    if (toolId === "opportunity-engine") return {label: "Opportunity Engine", query: opportunityEngineQuery};
    if (toolId === "evidence-dossier") return {label: "Lead Evidence Dossier", query: evidenceDossierQuery};
    if (toolId === "proof-vault") return {label: "Proof Vault", query: proofVaultQuery};
    if (toolId === "design-lab") return {label: "Design Lab", query: designLabQuery};
    return null;
  }, [dealRoomQuery, designLabQuery, evidenceDossierQuery, financeGuardQuery, opportunityEngineQuery, proofVaultQuery, replyRadarQuery, toolId, voiceAgentQuery, warRoomQuery]);

  if (!active) {
    return (
      <PageWrapper eyebrow="OPS · TOOL WORKBENCH" title="Tool not found." description="Open Tool Forge to choose an owned system.">
        <Link to="/ops/tools">
          <Button>Open Tool Forge</Button>
        </Link>
      </PageWrapper>
    );
  }

  if (active.query.isLoading) {
    return (
      <PageWrapper eyebrow="OPS · TOOL WORKBENCH" title={`Loading ${active.label}.`} description="Reading the live local tool state.">
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => <Card key={item} className="h-44 animate-pulse bg-[var(--color-surface)]" />)}
        </div>
      </PageWrapper>
    );
  }

  if (active.query.isError || !active.query.data) {
    return (
      <PageWrapper eyebrow="OPS · TOOL WORKBENCH" title={`${active.label} is offline.`} description="The dashboard server could not return this owned tool payload.">
        <Card className="p-6">
          <p className="text-sm text-[var(--color-text-muted)]">Check the backend on port 3007, then refresh the page.</p>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      eyebrow="OPS · TOOL WORKBENCH"
      title={active.label}
      description="A real custom tool surface wired to local HAMID.OS data."
      actions={
        <Link to="/ops/tools">
          <Button variant="secondary">
            Tool Forge
            <ArrowUpRight size={16} />
          </Button>
        </Link>
      }
    >
      {toolId === "reply-radar" ? <ReplyRadarPanel data={active.query.data as ReplyRadarResponse} /> : null}
      {toolId === "owned-voice-agent" ? <VoiceAgentPanel data={active.query.data as Awaited<ReturnType<typeof fetchOwnedVoiceAgent>>} /> : null}
      {toolId === "deal-room" ? <DealRoomPanel data={active.query.data as DealRoomResponse} /> : null}
      {toolId === "finance-guard" ? <FinanceGuardPanel data={active.query.data as FinanceGuardResponse} /> : null}
      {toolId === "war-room" ? <WarRoomPanel data={active.query.data as WarRoomResponse} /> : null}
      {toolId === "opportunity-engine" ? <OpportunityEnginePanel data={active.query.data as OpportunityEngineResponse} /> : null}
      {toolId === "evidence-dossier" ? (
        <EvidenceDossierPanel
          data={active.query.data as LeadEvidenceDossierResponse}
          isAuditing={browserAuditMutation.isPending}
          onRunAudit={() => browserAuditMutation.mutate()}
        />
      ) : null}
      {toolId === "proof-vault" ? <ProofVaultPanel data={active.query.data as ProofVaultResponse} /> : null}
      {toolId === "design-lab" ? <DesignLabPanel data={active.query.data as DesignLabResponse} /> : null}
    </PageWrapper>
  );
}
