import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right.js";
import Bot from "lucide-react/dist/esm/icons/bot.js";
import BrainCircuit from "lucide-react/dist/esm/icons/brain-circuit.js";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.js";
import CircleDollarSign from "lucide-react/dist/esm/icons/circle-dollar-sign.js";
import Copy from "lucide-react/dist/esm/icons/copy.js";
import CreditCard from "lucide-react/dist/esm/icons/credit-card.js";
import FileCheck2 from "lucide-react/dist/esm/icons/file-check-2.js";
import Layers3 from "lucide-react/dist/esm/icons/layers-3.js";
import Mail from "lucide-react/dist/esm/icons/mail.js";
import MessageSquareText from "lucide-react/dist/esm/icons/message-square-text.js";
import PhoneCall from "lucide-react/dist/esm/icons/phone-call.js";
import Rocket from "lucide-react/dist/esm/icons/rocket.js";
import Search from "lucide-react/dist/esm/icons/search.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.js";
import Target from "lucide-react/dist/esm/icons/target.js";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up.js";
import Users from "lucide-react/dist/esm/icons/users.js";
import Wallet from "lucide-react/dist/esm/icons/wallet.js";
import Workflow from "lucide-react/dist/esm/icons/workflow.js";
import Zap from "lucide-react/dist/esm/icons/zap.js";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageWrapper } from "@/components/layout/PageWrapper";

interface AgencyTemplate {
  id: string;
  industry: string;
  niche: string;
  buyer: string;
  offer: string;
  pain: string;
  outcome: string;
  setupFee: number;
  monthly: number;
  confidence: "sell first" | "next wedge" | "later";
  proofMetric: string;
  firstAsset: string;
  channels: string[];
  stack: string[];
}

const agencyTemplates: AgencyTemplate[] = [
  {
    id: "dental",
    industry: "Healthcare",
    niche: "Dental practices",
    buyer: "Practice owner or manager",
    offer: "Patient Enquiry Growth System",
    pain: "Slow enquiry follow-up, weak treatment pages, and missed private patient demand.",
    outcome: "More booked consultations from existing traffic without promising medical outcomes.",
    setupFee: 1500,
    monthly: 650,
    confidence: "sell first",
    proofMetric: "response time, consultation requests, missed enquiries recovered",
    firstAsset: "personalised homepage audit plus treatment enquiry demo",
    channels: ["Website", "Email", "Phone follow-up"],
    stack: ["Website audit", "AI reply drafts", "CRM follow-up", "Stripe setup"],
  },
  {
    id: "medspa",
    industry: "Healthcare",
    niche: "Medspas and beauty clinics",
    buyer: "Clinic founder",
    offer: "Consultation Booking Agent",
    pain: "High-intent treatment questions disappear into DMs, forms, and slow callbacks.",
    outcome: "Faster consultation handling, clearer pricing answers, and tighter booking flow.",
    setupFee: 1800,
    monthly: 850,
    confidence: "next wedge",
    proofMetric: "consultations booked, reply speed, treatment page conversion",
    firstAsset: "AI booking flow for one hero treatment",
    channels: ["Web chat", "Instagram DM", "Email"],
    stack: ["FAQ brain", "Booking handoff", "Lead scoring", "Weekly report"],
  },
  {
    id: "estate",
    industry: "Property",
    niche: "Estate and letting agents",
    buyer: "Branch director",
    offer: "Viewing Qualification System",
    pain: "Agents waste hours qualifying low-intent renters, sellers, and viewing requests.",
    outcome: "Cleaner enquiries, faster viewing triage, and a more complete applicant record.",
    setupFee: 1200,
    monthly: 600,
    confidence: "next wedge",
    proofMetric: "qualified enquiries, viewing slots protected, admin hours saved",
    firstAsset: "viewing triage assistant and property enquiry audit",
    channels: ["Website", "Email", "WhatsApp handoff"],
    stack: ["Form rewrite", "Qualification bot", "CRM notes", "Pipeline report"],
  },
  {
    id: "legal",
    industry: "Professional services",
    niche: "Solicitors",
    buyer: "Managing partner",
    offer: "Client Intake Router",
    pain: "New matters arrive with missing context, weak qualification, and manual chasing.",
    outcome: "Structured intake, clearer triage, and faster handoff to the right fee earner.",
    setupFee: 2200,
    monthly: 950,
    confidence: "later",
    proofMetric: "intake completeness, admin time saved, qualified matters",
    firstAsset: "one practice-area intake audit plus triage script",
    channels: ["Website", "Email", "Phone notes"],
    stack: ["Intake form", "Matter summary", "Conflict-safe notes", "Approval workflow"],
  },
  {
    id: "accountants",
    industry: "Professional services",
    niche: "Accountants",
    buyer: "Practice principal",
    offer: "Lead Follow-up and Document Chase Agent",
    pain: "New business leads and client document requests stall across email threads.",
    outcome: "Cleaner onboarding, fewer forgotten follow-ups, and faster client readiness.",
    setupFee: 1400,
    monthly: 700,
    confidence: "later",
    proofMetric: "documents collected, follow-ups completed, onboarding cycle time",
    firstAsset: "client onboarding checklist and follow-up email sequence",
    channels: ["Email", "Portal handoff", "CRM"],
    stack: ["Document checklist", "Reminder drafts", "Client status board", "Report"],
  },
];

const agencyStages = [
  {
    label: "Find",
    owner: "SCOUT",
    icon: <Search size={18} />,
    body: "Source local businesses with visible conversion leaks and enough transaction value to pay.",
    href: "/ops/automation",
  },
  {
    label: "Prove",
    owner: "NOVA",
    icon: <FileCheck2 size={18} />,
    body: "Create a focused audit, demo page, or agent flow before asking for a call.",
    href: "/leads",
  },
  {
    label: "Sell",
    owner: "VIPER",
    icon: <MessageSquareText size={18} />,
    body: "Send approval-gated outreach with one clear problem, proof asset, and low-friction ask.",
    href: "/mail/compose",
  },
  {
    label: "Collect",
    owner: "CASH",
    icon: <CreditCard size={18} />,
    body: "Use setup fees plus monthly care. Recurring revenue matters more than one-off builds.",
    href: "/pay/links",
  },
  {
    label: "Deliver",
    owner: "FORGE",
    icon: <Workflow size={18} />,
    body: "Run each client through launch, QA, approval, report, and renewal loops.",
    href: "/ops/workflows",
  },
] as const;

const launchSteps = [
  {
    day: "Day 1",
    title: "Pick one niche and one painful workflow",
    owner: "Hamid",
    output: "Dental first: treatment enquiry and follow-up leaks",
    href: "/agency",
  },
  {
    day: "Day 2",
    title: "Find 20 businesses and rank by visible pain",
    owner: "SCOUT",
    output: "Lead list with score, contact route, and weak proof",
    href: "/ops/automation",
  },
  {
    day: "Day 3",
    title: "Build 5 proof assets",
    owner: "NOVA",
    output: "Audit plus demo for the strongest five accounts",
    href: "/leads",
  },
  {
    day: "Day 4",
    title: "Send 10 approval-gated outreach messages",
    owner: "VIPER",
    output: "Manual send queue and objection log",
    href: "/mail/campaigns",
  },
  {
    day: "Day 5",
    title: "Close setup plus monthly care",
    owner: "CASH",
    output: "Payment link, scope, start date, and handoff checklist",
    href: "/pay/links",
  },
] as const;

const guardrails = [
  "Do not promise guaranteed patients, revenue, legal outcomes, or medical advice.",
  "Keep outbound, payment requests, contracts, and sensitive-data handling human-approved.",
  "Sell one measurable workflow before expanding into a platform.",
  "Charge for setup and care. Do not become a free custom automation shop.",
];

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return money.format(Math.round(value));
}

function statusVariant(confidence: AgencyTemplate["confidence"]) {
  if (confidence === "sell first") return "success";
  if (confidence === "next wedge") return "info";
  return "neutral";
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`executive-panel ${className}`}>{children}</section>;
}

function PanelHead({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="executive-panel-head">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)]/55 p-3">
      <span className="flex items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
        {label}
        <strong className="metric-mono text-[var(--color-text)]">{display}</strong>
      </span>
      <input
        aria-label={label}
        className="accent-[var(--color-accent)]"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function LinkButton({
  to,
  children,
  variant = "primary",
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const tone: string =
    variant === "primary"
      ? "border border-[color-mix(in_oklab,var(--color-accent)_48%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_78%,black)] text-white shadow-[0_0_18px_var(--color-accent-glow)] hover:bg-[var(--color-accent)]"
      : "border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]";

  return (
    <Link
      to={to}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 py-2 text-[var(--text-sm)] font-medium transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-px active:translate-y-0 active:scale-[0.995] ${tone}`}
    >
      {children}
    </Link>
  );
}

function MiniMetric({
  label,
  value,
  icon,
  tone = "accent",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "accent" | "cyan" | "green";
}) {
  const color = tone === "cyan" ? "var(--color-accent-2)" : tone === "green" ? "var(--color-success)" : "var(--color-accent)";
  return (
    <article className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3 text-[var(--color-text-muted)]">
        <span className="text-xs font-semibold uppercase tracking-[0.12em]">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <strong className="metric-value-fit mt-3 text-[var(--color-text)]">{value}</strong>
    </article>
  );
}

export function AgencyLaunchPage() {
  const [selectedId, setSelectedId] = useState("dental");
  const [clients, setClients] = useState(8);
  const [newClients, setNewClients] = useState(2);
  const [retainer, setRetainer] = useState(650);
  const [usageMarkup, setUsageMarkup] = useState(120);
  const [setupFee, setSetupFee] = useState(1500);
  const [fulfilmentCost, setFulfilmentCost] = useState(24);
  const [copied, setCopied] = useState(false);

  const selected = agencyTemplates.find((template) => template.id === selectedId) ?? agencyTemplates[0];

  const model = useMemo(() => {
    const mrr = clients * (retainer + usageMarkup);
    const annualRunRate = mrr * 12;
    const firstMonthCash = mrr + newClients * setupFee;
    const monthlyGross = mrr * (1 - fulfilmentCost / 100);
    return {
      mrr,
      annualRunRate,
      firstMonthCash,
      monthlyGross,
    };
  }, [clients, fulfilmentCost, newClients, retainer, setupFee, usageMarkup]);

  const launchBrief = useMemo(() => {
    return [
      `Agency offer: ${selected.offer}`,
      `Target buyer: ${selected.buyer} in ${selected.niche}`,
      `Pain: ${selected.pain}`,
      `Outcome: ${selected.outcome}`,
      `First proof asset: ${selected.firstAsset}`,
      `Pricing test: ${formatMoney(setupFee)} setup + ${formatMoney(retainer)}/mo care + ${formatMoney(usageMarkup)}/mo usage margin`,
      `Proof metric: ${selected.proofMetric}`,
      `Channels: ${selected.channels.join(", ")}`,
      `Guardrail: keep outbound, payment, contract, and sensitive-data steps human-approved.`,
    ].join("\n");
  }, [retainer, selected, setupFee, usageMarkup]);

  const copyBrief = async () => {
    await navigator.clipboard.writeText(launchBrief);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const syncPricingFromTemplate = () => {
    setSetupFee(selected.setupFee);
    setRetainer(selected.monthly);
  };

  return (
    <PageWrapper
      eyebrow="Agency launch OS"
      title="Build the sellable AI agency first."
      description="A focused operating surface for turning white-label agent ideas into a real local offer: find pain, prove it, sell setup, collect monthly care, and deliver with approval gates."
      actions={
        <>
          <LinkButton to="/ops/automation" variant="secondary">
            <Search size={16} />
            Source leads
          </LinkButton>
          <LinkButton to="/pay/links">
            <Wallet size={16} />
            Create payment path
          </LinkButton>
        </>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <Panel>
          <div className="grid min-h-[28rem] gap-5 p-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(24rem,0.58fr)]">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                  <Sparkles size={14} />
                  Better than a reseller page
                </div>
                <h2 className="mt-7 max-w-[12ch] font-display text-[clamp(3rem,7vw,6.4rem)] font-light leading-[0.92] tracking-[-0.01em] text-[var(--color-text)]">
                  Your agency becomes the machine.
                </h2>
                <p className="mt-6 max-w-3xl text-base leading-7 text-[var(--color-text-muted)]">
                  The reference pattern is build, brand, bill, scale. This version adds what actually makes you money:
                  niche selection, proof assets, human-approved outreach, payment routes, delivery guardrails, and a
                  weekly operating cadence for the first client.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniMetric label="First wedge" value="Dental" tone="cyan" icon={<Target size={17} />} />
                <MiniMetric label="Price test" value={`${formatMoney(1500)} + ${formatMoney(650)}/mo`} icon={<CircleDollarSign size={17} />} />
                <MiniMetric label="Rule" value="Proof before pitch" tone="green" icon={<ShieldCheck size={17} />} />
              </div>
            </div>
            <div className="rounded-[12px] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_70%,var(--color-surface))] p-4">
              <p className="section-kicker">Live launch lane</p>
              <div className="mt-4 grid gap-2">
                {agencyStages.map((stage, index) => (
                  <Link
                    key={stage.label}
                    to={stage.href}
                    className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:border-[color-mix(in_oklab,var(--color-accent)_48%,transparent)] hover:bg-[color-mix(in_oklab,var(--color-accent)_7%,var(--color-surface))]"
                  >
                    <span className="grid size-10 place-items-center rounded-[8px] border border-[var(--color-border)] text-[var(--color-accent)]">
                      {stage.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <strong className="text-sm text-[var(--color-text)]">{index + 1}. {stage.label}</strong>
                        <Badge variant="neutral">{stage.owner}</Badge>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--color-text-muted)]">{stage.body}</span>
                    </span>
                    <ArrowUpRight size={16} className="text-[var(--color-text-muted)] transition group-hover:text-[var(--color-accent)]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            kicker="Revenue model"
            title="Model MRR before you build."
            action={<Badge variant="warning">Model, not promise</Badge>}
          />
          <div className="grid gap-3 p-4">
            <RangeControl
              label="Active clients"
              min={1}
              max={40}
              step={1}
              value={clients}
              display={`${clients}`}
              onChange={setClients}
            />
            <RangeControl
              label="New clients this month"
              min={0}
              max={10}
              step={1}
              value={newClients}
              display={`${newClients}`}
              onChange={setNewClients}
            />
            <RangeControl
              label="Monthly care"
              min={250}
              max={2500}
              step={50}
              value={retainer}
              display={formatMoney(retainer)}
              onChange={setRetainer}
            />
            <RangeControl
              label="Usage margin"
              min={0}
              max={900}
              step={25}
              value={usageMarkup}
              display={`${formatMoney(usageMarkup)}/client`}
              onChange={setUsageMarkup}
            />
            <RangeControl
              label="Setup fee"
              min={500}
              max={6000}
              step={100}
              value={setupFee}
              display={formatMoney(setupFee)}
              onChange={setSetupFee}
            />
            <RangeControl
              label="Fulfilment cost"
              min={10}
              max={55}
              step={1}
              value={fulfilmentCost}
              display={`${fulfilmentCost}%`}
              onChange={setFulfilmentCost}
            />
          </div>
          <div className="grid grid-cols-2 gap-1 border-t border-[var(--color-border)] bg-[var(--color-border)]">
            <div className="bg-[var(--color-surface)] p-4">
              <p className="section-kicker">MRR</p>
              <strong className="metric-value-fit mt-2 text-[var(--color-accent)]">{formatMoney(model.mrr)}</strong>
            </div>
            <div className="bg-[var(--color-surface)] p-4">
              <p className="section-kicker">First month cash</p>
              <strong className="metric-value-fit mt-2 text-[var(--color-text)]">{formatMoney(model.firstMonthCash)}</strong>
            </div>
            <div className="bg-[var(--color-surface)] p-4">
              <p className="section-kicker">ARR</p>
              <strong className="metric-value-fit mt-2 text-[var(--color-text)]">{formatMoney(model.annualRunRate)}</strong>
            </div>
            <div className="bg-[var(--color-surface)] p-4">
              <p className="section-kicker">Gross/month</p>
              <strong className="metric-value-fit mt-2 text-[var(--color-success)]">{formatMoney(model.monthlyGross)}</strong>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(20rem,0.62fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead
            kicker="Vertical templates"
            title="Choose a sellable first wedge."
            action={
              <Button variant="ghost" className="rounded-full" onClick={syncPricingFromTemplate}>
                <Zap size={15} />
                Use template price
              </Button>
            }
          />
          <div className="grid gap-2 p-4">
            {agencyTemplates.map((template) => {
              const active = template.id === selected.id;
              return (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  className={`grid gap-2 rounded-[10px] border p-4 text-left transition ${
                    active
                      ? "border-[color-mix(in_oklab,var(--color-accent)_62%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)]/55 hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <strong className="block text-sm text-[var(--color-text)]">{template.niche}</strong>
                      <small className="mt-1 block text-xs text-[var(--color-text-muted)]">{template.industry}</small>
                    </span>
                    <Badge variant={statusVariant(template.confidence)}>{template.confidence}</Badge>
                  </span>
                  <span className="text-xs leading-5 text-[var(--color-text-muted)]">{template.offer}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelHead
            kicker="Offer builder"
            title={selected.offer}
            action={<Badge variant={statusVariant(selected.confidence)}>{selected.confidence}</Badge>}
          />
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <article className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)]/55 p-4">
                  <p className="section-kicker">Pain to monetise</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">{selected.pain}</p>
                </article>
                <article className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)]/55 p-4">
                  <p className="section-kicker">Outcome to sell</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">{selected.outcome}</p>
                </article>
              </div>
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)]/45 p-4">
                <p className="section-kicker">Launch brief</p>
                <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-[var(--color-text-muted)]">{launchBrief}</pre>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={copyBrief}>
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy launch brief"}
                </Button>
                <LinkButton to="/ai/agents" variant="secondary">
                  <Bot size={16} />
                  Configure agent
                </LinkButton>
                <LinkButton to="/mail/templates" variant="secondary">
                  <Mail size={16} />
                  Draft outreach
                </LinkButton>
              </div>
            </div>
            <div className="grid gap-3">
              <MiniMetric label="Buyer" value={selected.buyer} icon={<Users size={16} />} />
              <MiniMetric label="Setup" value={formatMoney(selected.setupFee)} icon={<Wallet size={16} />} />
              <MiniMetric label="Care" value={`${formatMoney(selected.monthly)}/mo`} tone="green" icon={<TrendingUp size={16} />} />
              <article className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="section-kicker">Channels</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.channels.map((channel) => <Badge key={channel} variant="neutral">{channel}</Badge>)}
                </div>
                <p className="section-kicker mt-5">Stack</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.stack.map((item) => <Badge key={item} variant="info">{item}</Badge>)}
                </div>
              </article>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.48fr)]">
        <Panel>
          <PanelHead kicker="First client sprint" title="Five days to a real paid conversation." />
          <div className="executive-table">
            <div className="executive-table-row executive-table-head">
              <span>Step</span>
              <span>Owner</span>
              <span>Status</span>
              <span>Output</span>
              <span>Route</span>
            </div>
            {launchSteps.map((step, index) => (
              <Link to={step.href} className="executive-table-row" key={step.day}>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.day}</small>
                </span>
                <span>{step.owner}</span>
                <span><Badge variant={index === 0 ? "success" : "neutral"}>{index === 0 ? "start now" : "queued"}</Badge></span>
                <span>{step.output}</span>
                <span>Open <ArrowUpRight size={13} /></span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead kicker="Guardrails" title="Stay credible while selling fast." />
          <div className="executive-action-list">
            {guardrails.map((guardrail, index) => (
              <article className="executive-action-row" key={guardrail}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{guardrail}</strong>
                <ShieldCheck size={16} className="text-[var(--color-accent)]" />
              </article>
            ))}
          </div>
          <div className="executive-action-grid">
            <Link to="/leads"><Target size={15} /> Leads</Link>
            <Link to="/ops/approvals"><CheckCircle2 size={15} /> Approvals</Link>
            <Link to="/pay"><CircleDollarSign size={15} /> Revenue</Link>
          </div>
        </Panel>
      </section>

      <Panel>
        <PanelHead kicker="Agency system" title="What makes this better than a white-label promise." />
        <div className="grid gap-1 border-t border-[var(--color-border)] bg-[var(--color-border)] md:grid-cols-4">
          {[
            {
              icon: <BrainCircuit size={18} />,
              title: "Learning loop",
              body: "Every call, objection, demo, and reply becomes playbook memory for the next account.",
            },
            {
              icon: <Layers3 size={18} />,
              title: "Vertical assets",
              body: "One niche creates reusable prompts, audits, email angles, pricing, and onboarding checklists.",
            },
            {
              icon: <PhoneCall size={18} />,
              title: "Human control",
              body: "The system prepares work. You approve outbound, sensitive claims, contracts, and payment asks.",
            },
            {
              icon: <Rocket size={18} />,
              title: "Compoundable delivery",
              body: "Setup fees fund the sprint; monthly care turns the agency into a recurring operator.",
            },
          ].map((item) => (
            <article className="min-h-[13rem] bg-[var(--color-surface)] p-5" key={item.title}>
              <div className="grid size-10 place-items-center rounded-[8px] border border-[var(--color-border)] text-[var(--color-accent)]">
                {item.icon}
              </div>
              <h3 className="mt-5 text-base font-semibold text-[var(--color-text)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">{item.body}</p>
            </article>
          ))}
        </div>
      </Panel>
    </PageWrapper>
  );
}
