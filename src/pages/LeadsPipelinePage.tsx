import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckSquare2,
  Clock3,
  Flame,
  Globe2,
  Layers3,
  ListFilter,
  Mail,
  Phone,
  Search,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { LeadStatusBadge } from "@/components/features/LeadStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchLeadPipeline,
  fetchLeadSearchStatus,
  fetchPipelineSnapshot,
  queueLeadDemo,
  queueLeadEmail,
  triggerLeadSearch,
  updateLeadStatus,
} from "@/services/api";
import type { LeadPipelineItem } from "@/types/frontend";

type StageKey =
  | "researched"
  | "ready-to-send"
  | "contacted"
  | "replied"
  | "proposal"
  | "won";

interface StageConfig {
  key: StageKey;
  label: string;
  chroma: string;
  muted: string;
  description: string;
}

const stages: StageConfig[] = [
  {
    key: "researched",
    label: "New",
    chroma: "rgba(118, 214, 206, 1)",
    muted: "rgba(118, 214, 206, 0.14)",
    description: "Fresh discovery, awaiting audit.",
  },
  {
    key: "ready-to-send",
    label: "Audited",
    chroma: "rgba(216, 183, 106, 1)",
    muted: "rgba(216, 183, 106, 0.16)",
    description: "Scored and queued for outreach.",
  },
  {
    key: "contacted",
    label: "Emailed",
    chroma: "rgba(245, 158, 11, 1)",
    muted: "rgba(245, 158, 11, 0.14)",
    description: "First touch delivered.",
  },
  {
    key: "replied",
    label: "Replied",
    chroma: "rgba(99, 179, 237, 1)",
    muted: "rgba(99, 179, 237, 0.14)",
    description: "Engaged — move fast.",
  },
  {
    key: "proposal",
    label: "Proposal",
    chroma: "rgba(168, 85, 247, 1)",
    muted: "rgba(168, 85, 247, 0.14)",
    description: "Commercial live.",
  },
  {
    key: "won",
    label: "Closed",
    chroma: "rgba(16, 185, 129, 1)",
    muted: "rgba(16, 185, 129, 0.14)",
    description: "Deal signed or archived.",
  },
];

function stageKey(status: string): StageKey {
  const normalized = status.toLowerCase();
  if (normalized === "ready-to-send") return "ready-to-send";
  if (normalized === "contacted" || normalized === "in-follow-up") return "contacted";
  if (normalized === "replied") return "replied";
  if (normalized === "proposal") return "proposal";
  if (normalized === "won" || normalized === "lost") return "won";
  return "researched";
}

function scoreTone(score: number): { stroke: string; glow: string; label: string } {
  if (score >= 70) return { stroke: "rgba(16, 185, 129, 1)", glow: "rgba(16, 185, 129, 0.35)", label: "Strong" };
  if (score >= 55) return { stroke: "rgba(216, 183, 106, 1)", glow: "rgba(216, 183, 106, 0.3)", label: "Fair" };
  if (score >= 40) return { stroke: "rgba(245, 158, 11, 1)", glow: "rgba(245, 158, 11, 0.3)", label: "Weak" };
  return { stroke: "rgba(239, 68, 68, 1)", glow: "rgba(239, 68, 68, 0.3)", label: "Broken" };
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "£0";
  if (value >= 1000) return `£${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function relativeTimeFrom(iso: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  const diffMs = Date.now() - ts;
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours <= 0) return "just now";
    return `${hours}h ago`;
  }
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const ts = new Date(dueDate).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.ceil((ts - Date.now()) / 86_400_000);
}

function ScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score || 0));
  const tone = scoreTone(clamped);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div
      className="relative grid size-[58px] shrink-0 place-items-center rounded-full"
      style={{
        background: `radial-gradient(circle at 35% 25%, ${tone.glow}, transparent 68%)`,
      }}
    >
      <svg width="58" height="58" viewBox="0 0 58 58" className="-rotate-90">
        <circle
          cx="29"
          cy="29"
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
          fill="transparent"
        />
        <motion.circle
          cx="29"
          cy="29"
          r={radius}
          stroke={tone.stroke}
          strokeWidth="4"
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${tone.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="metric-mono text-[15px] font-semibold leading-none"
          style={{ color: tone.stroke }}
        >
          {Math.round(clamped)}
        </span>
      </div>
    </div>
  );
}

function ContactSignal({
  icon: Icon,
  active,
  label,
  href,
}: {
  icon: typeof Globe2;
  active: boolean;
  label: string;
  href?: string;
}) {
  const body = (
    <span
      title={active ? `${label} captured` : `${label} missing`}
      className={`grid size-7 place-items-center rounded-full border transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] ${
        active
          ? "border-[color-mix(in_oklab,var(--color-success)_40%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-success)_16%,transparent)] text-[var(--color-success)]"
          : "border-dashed border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-faint)]"
      }`}
    >
      <Icon size={12} strokeWidth={active ? 2.4 : 1.6} />
    </span>
  );
  if (!active || !href) return body;
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="transition-transform duration-[var(--duration-base)] hover:-translate-y-px"
    >
      {body}
    </a>
  );
}

function KpiTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div
      className="metric-panel relative overflow-hidden rounded-[22px] p-5"
      style={
        accent
          ? ({
              background: `linear-gradient(145deg, color-mix(in oklab, ${accent} 10%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in oklab, white 2%, var(--color-surface)) 0%, color-mix(in oklab, black 6%, var(--color-surface)) 100%)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <p className="section-kicker">{label}</p>
      <p
        className="metric-mono mt-3 text-[28px] font-semibold leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
      {accent ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full"
          style={{ background: `radial-gradient(circle, color-mix(in oklab, ${accent} 26%, transparent), transparent 70%)` }}
        />
      ) : null}
    </div>
  );
}

interface LeadCardProps {
  lead: LeadPipelineItem;
  stage: StageConfig;
  selected: boolean;
  onToggleSelect: () => void;
  onQueueDemo: () => void;
  onQueueEmail: () => void;
}

function LeadCard({ lead, stage, selected, onToggleSelect, onQueueDemo, onQueueEmail }: LeadCardProps) {
  const lastTouch = relativeTimeFrom(lead.lastTimelineEventAt);
  const dueIn = daysUntil(lead.dueDate);
  const weighted = Math.round(lead.dealValue * (lead.closeProbability / 100));
  const hasWebsite = Boolean(lead.websiteUrl);
  const hasPhone = Boolean(lead.phoneNumber);
  const hasEmail = Boolean(lead.emailAddress);
  const contactRoutes = [hasWebsite, hasPhone, hasEmail].filter(Boolean).length;
  const isHot = (lead.priority || "").toLowerCase() === "high";
  const rating = lead.googleRating ?? null;
  const reviews = lead.reviewCount ?? 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={`group relative overflow-hidden rounded-[22px] border transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] ${
        selected
          ? "border-[color-mix(in_oklab,var(--color-accent)_55%,transparent)]"
          : "border-[var(--color-border)] hover:border-[color-mix(in_oklab,var(--color-border-strong)_100%,transparent)]"
      }`}
      style={{
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.010) 52%, rgba(0,0,0,0.22)), linear-gradient(180deg, color-mix(in oklab, white 2%, var(--color-surface)) 0%, color-mix(in oklab, black 6%, var(--color-surface)) 100%)",
        boxShadow: selected
          ? `0 0 0 1px color-mix(in oklab, var(--color-accent) 45%, transparent), 0 18px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)`
          : "0 12px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Top accent stripe (stage colour) */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${stage.chroma}, transparent 65%)`,
          opacity: 0.85,
        }}
      />
      {/* Hover glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, ${stage.muted}, transparent 70%)` }}
      />

      <div className="relative space-y-4 p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect();
            }}
            className={`mt-1 grid size-[42px] shrink-0 place-items-center rounded-[14px] text-sm font-semibold uppercase transition-all duration-[var(--duration-base)] ${
              selected
                ? "bg-[var(--color-accent)] text-white shadow-[0_0_18px_var(--color-accent-glow)]"
                : "border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-text)] hover:scale-[1.04]"
            }`}
            aria-label={selected ? "Deselect lead" : "Select lead"}
          >
            {selected ? <CheckSquare2 size={18} /> : initialsFor(lead.businessName || "?")}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="metric-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-faint)]">
                {lead.clientId}
              </p>
              {isHot ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--color-error)_40%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-error)_14%,transparent)] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-[var(--color-error)]">
                  <Flame size={10} /> Hot
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 truncate text-[15px] font-semibold leading-tight text-[var(--color-text)]">
              {lead.businessName}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
              <span>{lead.businessType}</span>
              <span className="text-[var(--color-text-faint)]">·</span>
              <span>{lead.area}</span>
              {rating != null ? (
                <>
                  <span className="text-[var(--color-text-faint)]">·</span>
                  <span className="inline-flex items-center gap-1 text-[var(--color-gold)]">
                    <Star size={11} className="fill-[var(--color-gold)]" />
                    {rating.toFixed(1)}
                    <span className="text-[var(--color-text-muted)]">({reviews})</span>
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <ScoreRing score={lead.siteScore} />
        </div>

        {/* Next action strip */}
        {(lead.nextActionNotes || dueIn != null) && (
          <div
            className="rounded-[14px] border px-3 py-2"
            style={{
              borderColor: "color-mix(in oklab, var(--color-border-strong) 62%, transparent)",
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--color-accent) 5%, transparent), transparent 60%)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="section-kicker !text-[9px]">Next move</p>
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--color-text)]">
                  {lead.nextActionNotes || "Plan the first touch."}
                </p>
              </div>
              {dueIn != null ? (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    dueIn < 0
                      ? "bg-[color-mix(in_oklab,var(--color-error)_16%,transparent)] text-[var(--color-error)]"
                      : dueIn <= 2
                        ? "bg-[color-mix(in_oklab,var(--color-warning)_16%,transparent)] text-[var(--color-warning)]"
                        : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                  }`}
                >
                  <Clock3 size={10} />
                  {dueIn < 0 ? `${Math.abs(dueIn)}d over` : dueIn === 0 ? "today" : `${dueIn}d`}
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Contact signals + last touched */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <ContactSignal
              icon={Globe2}
              active={hasWebsite}
              label="Website"
              href={lead.websiteUrl ?? undefined}
            />
            <ContactSignal
              icon={Phone}
              active={hasPhone}
              label="Phone"
              href={lead.phoneNumber ? `tel:${lead.phoneNumber}` : undefined}
            />
            <ContactSignal
              icon={Mail}
              active={hasEmail}
              label="Email"
              href={lead.emailAddress ? `mailto:${lead.emailAddress}` : undefined}
            />
            <span className="ml-1 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
              {contactRoutes}/3 routes
            </span>
          </div>
          {lastTouch ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-faint)]">
              <Clock3 size={10} /> {lastTouch}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
              Untouched
            </span>
          )}
        </div>

        {/* Commercial footer */}
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--color-surface-2)]/80 px-3 py-2">
          <div>
            <p className="section-kicker !text-[9px]">Deal</p>
            <p className="metric-mono mt-1 text-[15px] font-semibold text-[var(--color-text)]">
              {formatCurrency(lead.dealValue)}
            </p>
          </div>
          <div className="text-right">
            <p className="section-kicker !text-[9px]">Weighted</p>
            <p className="metric-mono mt-1 text-[13px] text-[var(--color-text-muted)]">
              {formatCurrency(weighted)} · {Math.round(lead.closeProbability || 0)}%
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onQueueDemo();
            }}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-[11px] font-semibold text-[var(--color-text)] transition-all duration-[var(--duration-base)] hover:-translate-y-px hover:bg-[var(--color-surface-2)]"
          >
            <Sparkles size={12} />
            Demo
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onQueueEmail();
            }}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-[var(--color-border)] bg-transparent px-2 text-[11px] font-semibold text-[var(--color-text-muted)] transition-all duration-[var(--duration-base)] hover:-translate-y-px hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <Mail size={12} />
            Email
          </button>
          <Link
            to={`/leads/${encodeURIComponent(lead.clientId)}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[11px] font-semibold text-[var(--color-accent)] transition-all duration-[var(--duration-base)] hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)]"
            style={{ border: "1px solid color-mix(in oklab, var(--color-accent) 35%, transparent)" }}
          >
            Open
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export function LeadsPipelinePage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [areaFilter, setAreaFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const leadsQuery = useQuery({ queryKey: ["lead-pipeline"], queryFn: fetchLeadPipeline });
  const pipelineSnapshotQuery = useQuery({
    queryKey: ["pipeline-snapshot"],
    queryFn: fetchPipelineSnapshot,
  });
  const searchStatusQuery = useQuery({
    queryKey: ["lead-search-status"],
    queryFn: fetchLeadSearchStatus,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 3000 : false),
  });

  const runSearch = useMutation({
    mutationFn: () => triggerLeadSearch({ maxQualified: 12, maxPerQuery: 6 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-search-status"] });
    },
  });

  const queueDemo = useMutation({
    mutationFn: (clientId: string) => queueLeadDemo(clientId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead-pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-detail"] }),
      ]);
    },
  });

  const queueEmail = useMutation({
    mutationFn: (clientId: string) => queueLeadEmail(clientId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead-pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-detail"] }),
      ]);
    },
  });

  const markContacted = useMutation({
    mutationFn: async (clientIds: string[]) => {
      await Promise.all(clientIds.map((clientId) => updateLeadStatus(clientId, "contacted")));
    },
    onSuccess: async () => {
      setSelectedLeadIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lead-pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-detail"] }),
      ]);
    },
  });

  const leads = leadsQuery.data?.leads ?? [];
  const areas = useMemo(() => Array.from(new Set(leads.map((lead) => lead.area))).sort(), [leads]);
  const types = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.businessType))).sort(),
    [leads],
  );

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesQuery =
          !query ||
          [
            lead.clientId,
            lead.businessName,
            lead.businessType,
            lead.area,
            lead.emailAddress ?? "",
            lead.phoneNumber ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesArea = areaFilter === "all" || lead.area === areaFilter;
        const matchesType = typeFilter === "all" || lead.businessType === typeFilter;
        const matchesStatus = statusFilter === "all" || lead.accountStatus === statusFilter;
        return matchesQuery && matchesArea && matchesType && matchesStatus;
      }),
    [areaFilter, leads, query, statusFilter, typeFilter],
  );

  const selectedSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);
  const allFilteredSelected =
    filteredLeads.length > 0 && filteredLeads.every((lead) => selectedSet.has(lead.clientId));
  const qualifiedCount = pipelineSnapshotQuery.data?.qualifiedLeads.length ?? 0;
  const rawCount = pipelineSnapshotQuery.data?.rawLeads.length ?? 0;

  // Pipeline-wide KPIs
  const kpis = useMemo(() => {
    const totalValue = leads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
    const weightedValue = leads.reduce(
      (sum, lead) => sum + (lead.dealValue || 0) * ((lead.closeProbability || 0) / 100),
      0,
    );
    const scored = leads.filter((lead) => lead.siteScore > 0);
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, lead) => sum + lead.siteScore, 0) / scored.length)
      : 0;
    const hot = leads.filter((lead) => (lead.priority || "").toLowerCase() === "high").length;
    return {
      totalValue,
      weightedValue,
      avgScore,
      hot,
      active: leads.filter((lead) => stageKey(lead.accountStatus) !== "won").length,
    };
  }, [leads]);

  const toggleLeadSelection = (clientId: string) => {
    setSelectedLeadIds((current) =>
      current.includes(clientId)
        ? current.filter((entry) => entry !== clientId)
        : [...current, clientId],
    );
  };

  const toggleAllFiltered = () => {
    setSelectedLeadIds((current) => {
      if (allFilteredSelected) {
        return current.filter((entry) => !filteredLeads.some((lead) => lead.clientId === entry));
      }
      const merged = new Set([...current, ...filteredLeads.map((lead) => lead.clientId)]);
      return Array.from(merged);
    });
  };

  const runBulkDemo = async () => {
    await Promise.all(selectedLeadIds.map((clientId) => queueLeadDemo(clientId)));
    setSelectedLeadIds([]);
  };

  const runBulkEmail = async () => {
    await Promise.all(selectedLeadIds.map((clientId) => queueLeadEmail(clientId)));
    setSelectedLeadIds([]);
  };

  return (
    <PageWrapper
      eyebrow="Leads pipeline"
      title="Qualified businesses, audit pressure, and next actions in one operating board."
      description="Trigger discovery, scan the pipeline, filter the market, and open a lead into a full dossier. Every card surfaces score, contact routes, next move, and commercial weight."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-[14px] border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-1">
            {(["kanban", "table"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-[var(--duration-base)] ${
                  view === mode
                    ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-sm)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {mode === "kanban" ? <Layers3 size={13} /> : <ListFilter size={13} />}
                {mode}
              </button>
            ))}
          </div>
          <Button
            onClick={() => runSearch.mutate()}
            disabled={runSearch.isPending || searchStatusQuery.data?.status === "running"}
          >
            <WandSparkles size={16} />
            {searchStatusQuery.data?.status === "running" ? "Searching…" : "Find new leads"}
          </Button>
        </div>
      }
    >
      {/* KPI hero */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Pipeline value"
          value={formatCurrency(kpis.totalValue)}
          hint={`${leads.length} leads · ${kpis.active} active`}
          accent="var(--color-accent)"
        />
        <KpiTile
          label="Weighted value"
          value={formatCurrency(kpis.weightedValue)}
          hint="Close probability applied"
          accent="var(--color-success)"
        />
        <KpiTile
          label="Avg site score"
          value={`${kpis.avgScore}`}
          hint="Lower = more rebuild pressure"
          accent={kpis.avgScore >= 55 ? "var(--color-success)" : "var(--color-warning)"}
        />
        <KpiTile
          label="Hot leads"
          value={`${kpis.hot}`}
          hint="Priority flagged as high"
          accent="rgba(239, 68, 68, 1)"
        />
        <KpiTile
          label="Qualified snapshot"
          value={`${qualifiedCount}`}
          hint={`${rawCount} raw in discovery`}
          accent="rgba(168, 85, 247, 1)"
        />
      </div>

      {/* Toolbar */}
      <Card className="space-y-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <label className="flex items-center gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 transition-colors duration-[var(--duration-base)] focus-within:border-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] focus-within:shadow-[0_0_0_3px_var(--color-accent-glow)]">
            <Search size={16} className="text-[var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, ID, phone, email, area, type"
              className="min-h-11 w-full bg-transparent outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
              >
                clear
              </button>
            ) : null}
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-11 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm"
          >
            <option value="all">All statuses</option>
            {Array.from(new Set(leads.map((lead) => lead.accountStatus))).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
            className="min-h-11 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm"
          >
            <option value="all">All areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="min-h-11 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm"
          >
            <option value="all">All business types</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
          {/* Discovery status */}
          <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="section-kicker">Discovery engine</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {searchStatusQuery.data?.message ?? "No lead search has been started yet."}
                </p>
              </div>
              <Badge
                variant={
                  searchStatusQuery.data?.status === "running"
                    ? "warning"
                    : searchStatusQuery.data?.status === "completed"
                      ? "success"
                      : "neutral"
                }
              >
                {searchStatusQuery.data?.status ?? "idle"}
              </Badge>
            </div>
            <div className="mt-3">
              <Progress
                value={
                  searchStatusQuery.data?.status === "running"
                    ? 55
                    : searchStatusQuery.data?.status === "completed"
                      ? 100
                      : 0
                }
                label={`Raw: ${rawCount} · Qualified: ${qualifiedCount}`}
              />
            </div>
          </div>

          {/* Bulk actions */}
          <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface-2)]/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-kicker">Bulk actions</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {selectedLeadIds.length
                    ? "Move selected leads forward without opening them."
                    : "Select leads to unlock bulk ops."}
                </p>
              </div>
              <Badge variant={selectedLeadIds.length ? "info" : "neutral"}>
                {selectedLeadIds.length} selected
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={runBulkDemo} disabled={!selectedLeadIds.length}>
                <Sparkles size={14} />
                Queue demos
              </Button>
              <Button variant="secondary" onClick={runBulkEmail} disabled={!selectedLeadIds.length}>
                <Mail size={14} />
                Queue emails
              </Button>
              <Button
                onClick={() => markContacted.mutate(selectedLeadIds)}
                disabled={!selectedLeadIds.length}
              >
                <CheckSquare2 size={14} />
                Mark contacted
              </Button>
              {selectedLeadIds.length ? (
                <Button variant="ghost" onClick={() => setSelectedLeadIds([])}>
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {/* Board */}
      {leadsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-72 w-full rounded-[22px]" />
          ))}
        </div>
      ) : view === "kanban" ? (
        <div className="app-scroll -mx-2 flex gap-4 overflow-x-auto px-2 pb-4 xl:mx-0 xl:grid xl:grid-cols-6 xl:gap-5 xl:overflow-visible xl:px-0">
          {stages.map((stage) => {
            const stageLeads = filteredLeads.filter(
              (lead) => stageKey(lead.accountStatus) === stage.key,
            );
            const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
            return (
              <section
                key={stage.key}
                className="relative flex min-w-[320px] flex-col gap-3 rounded-[24px] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_90%,transparent)] p-3 xl:min-w-0"
                style={{
                  boxShadow:
                    "0 18px 48px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-0 h-[3px] rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${stage.chroma}, transparent 85%)`,
                    filter: `drop-shadow(0 0 10px ${stage.muted})`,
                  }}
                />

                {/* Column header */}
                <header className="flex items-start justify-between gap-3 px-1 pt-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ background: stage.chroma, boxShadow: `0 0 10px ${stage.chroma}` }}
                      />
                      <h2 className="display-title !text-[var(--text-base)] font-normal text-[var(--color-text)]">
                        {stage.label}
                      </h2>
                    </div>
                    <p className="mt-1 text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-text-faint)]">
                      {stage.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="metric-mono text-[15px] font-semibold leading-none"
                      style={{ color: stage.chroma }}
                    >
                      {stageLeads.length}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
                      {formatCurrency(stageValue)}
                    </p>
                  </div>
                </header>

                <div className="panel-divider my-1" />

                {/* Column lanes */}
                <div className="flex min-h-[6rem] flex-col gap-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {stageLeads.length ? (
                      stageLeads.map((lead) => (
                        <LeadCard
                          key={lead.clientId}
                          lead={lead}
                          stage={stage}
                          selected={selectedSet.has(lead.clientId)}
                          onToggleSelect={() => toggleLeadSelection(lead.clientId)}
                          onQueueDemo={() => queueDemo.mutate(lead.clientId)}
                          onQueueEmail={() => queueEmail.mutate(lead.clientId)}
                        />
                      ))
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid place-items-center rounded-[18px] border border-dashed border-[var(--color-border-strong)] px-4 py-8 text-center text-[11px] text-[var(--color-text-faint)]"
                      >
                        No leads in this stage yet.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[var(--color-surface-2)]">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  {[
                    "Select",
                    "Lead",
                    "Type",
                    "Area",
                    "Score",
                    "Deal",
                    "Status",
                    "Next move",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-5 py-4 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const weighted = Math.round(lead.dealValue * (lead.closeProbability / 100));
                  return (
                    <tr
                      key={lead.clientId}
                      className="border-t border-[var(--color-border)] transition-colors duration-[var(--duration-base)] hover:bg-[var(--color-surface-2)]/60"
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(lead.clientId)}
                          onChange={() => toggleLeadSelection(lead.clientId)}
                          className="size-4 rounded border border-[var(--color-border-strong)] bg-transparent"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-[var(--color-text)]">{lead.businessName}</p>
                          <p className="metric-mono text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
                            {lead.clientId}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-text-muted)]">
                        {lead.businessType}
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--color-text-muted)]">{lead.area}</td>
                      <td className="px-5 py-4">
                        <ScoreRing score={lead.siteScore} />
                      </td>
                      <td className="px-5 py-4">
                        <p className="metric-mono text-sm font-semibold text-[var(--color-text)]">
                          {formatCurrency(lead.dealValue)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatCurrency(weighted)} · {Math.round(lead.closeProbability || 0)}%
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <LeadStatusBadge status={lead.accountStatus} />
                      </td>
                      <td className="px-5 py-4 max-w-[18rem] text-sm text-[var(--color-text-muted)]">
                        <p className="line-clamp-2">{lead.nextActionNotes || "—"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => queueDemo.mutate(lead.clientId)}>
                            Demo
                          </Button>
                          <Button variant="ghost" onClick={() => queueEmail.mutate(lead.clientId)}>
                            Email
                          </Button>
                          <Link to={`/leads/${encodeURIComponent(lead.clientId)}`} className="inline-flex">
                            <Button variant="ghost">
                              <ListFilter size={16} />
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-4 text-sm text-[var(--color-text-muted)]">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                className="size-4 rounded border border-[var(--color-border-strong)] bg-transparent"
              />
              Select all filtered leads
            </label>
            <p>{filteredLeads.length} rows visible</p>
          </div>
        </Card>
      )}
    </PageWrapper>
  );
}
