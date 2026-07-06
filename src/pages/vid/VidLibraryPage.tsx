import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Layers,
  Play,
  Search,
  TrendingUp,
  Video,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchLeadPipeline } from "@/services/api";

// ─── Pipeline stages ───────────────────────────────────────────────────────────

const STAGE_ORDER = [
  "Prospect",
  "Outreach",
  "Demo Booked",
  "Demo Done",
  "Proposal Sent",
  "Negotiating",
  "Won",
] as const;

const STAGE_COLOR: Record<string, string> = {
  Prospect:       "#6366f1",
  Outreach:       "#8b5cf6",
  "Demo Booked":  "#a78bfa",
  "Demo Done":    "#22d3ee",
  "Proposal Sent":"#f59e0b",
  Negotiating:    "#f97316",
  Won:            "#22c55e",
};

// ─── Component ─────────────────────────────────────────────────────────────────

export function VidLibraryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "video" | "demo" | "pending">("all");

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ["lead-pipeline"],
    queryFn: fetchLeadPipeline,
    staleTime: 60_000,
  });
  const leads = pipelineData?.leads ?? [];

  const withVideo = leads.filter((l) => l.videoFile);
  const withDemo  = leads.filter((l) => l.demoFile);
  const bothReady = leads.filter((l) => l.videoFile && l.demoFile);
  const pending   = leads.filter((l) => !l.videoFile && !l.demoFile);
  const partial   = leads.filter((l) => (l.videoFile || l.demoFile) && !(l.videoFile && l.demoFile));

  // Coverage %
  const coverage = leads.length > 0 ? Math.round((bothReady.length / leads.length) * 100) : 0;

  const filtered = leads.filter((l) => {
    const matchSearch = !search || [l.businessName, l.area, l.businessType].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all"     ? true :
      filter === "video"   ? !!l.videoFile :
      filter === "demo"    ? !!l.demoFile :
      filter === "pending" ? (!l.videoFile && !l.demoFile) : true;
    return matchSearch && matchFilter;
  });

  // By stage analysis
  const stageBreakdown = STAGE_ORDER.map((stage) => {
    const inStage = leads.filter((l) => l.accountStatus === stage || (l as unknown as Record<string,unknown>).stage === stage);
    const hasVideo = inStage.filter((l) => l.videoFile);
    const hasDemo  = inStage.filter((l) => l.demoFile);
    return { stage, total: inStage.length, hasVideo: hasVideo.length, hasDemo: hasDemo.length };
  }).filter((s) => s.total > 0);

  return (
    <PageWrapper
      eyebrow="HAMID.OS · VID"
      title="VIDEO LIBRARY"
      description="Production pipeline, demo assets and video coverage across your entire prospect base"
      actions={
        <Button variant="glow">
          <Video size={14} />
          <span>Upload asset</span>
        </Button>
      }
    >
      <div className="space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Videos ready",
              value: isLoading ? "—" : withVideo.length,
              sub: "custom video files",
              icon: Film,
              color: "var(--color-accent)",
            },
            {
              label: "Demos ready",
              value: isLoading ? "—" : withDemo.length,
              sub: "demo site files",
              icon: Play,
              color: "#22c55e",
            },
            {
              label: "Full coverage",
              value: isLoading ? "—" : bothReady.length,
              sub: "both video + demo",
              icon: CheckCircle2,
              color: "#22d3ee",
            },
            {
              label: "Coverage %",
              value: isLoading ? "—" : `${coverage}%`,
              sub: "of total prospects",
              icon: TrendingUp,
              color: "#f59e0b",
            },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="size-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: color + "22", color }}
                >
                  <Icon size={15} />
                </span>
              </div>
              <p className="metric-mono text-2xl font-bold text-[var(--color-accent)]">{value}</p>
              <p className="text-xs font-semibold text-[var(--color-text)] mt-0.5">{label}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>
            </Card>
          ))}
        </div>

        {/* Coverage bar */}
        {!isLoading && leads.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[var(--color-accent)]" />
                <p className="font-semibold text-sm">Production Coverage</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">
                {bothReady.length} of {leads.length} prospects
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
              {/* Videos */}
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(withVideo.length / leads.length) * 100}%`,
                  background: "var(--color-accent)",
                  opacity: 0.6,
                }}
              />
              {/* Both (demos) */}
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(bothReady.length / leads.length) * 100}%`,
                  background: "#22c55e",
                  opacity: 0.8,
                }}
              />
            </div>
            <div className="flex items-center gap-6 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <span className="size-2.5 rounded-full bg-[var(--color-accent)] opacity-60 inline-block" />
                Video only — {withVideo.length - bothReady.length}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <span className="size-2.5 rounded-full bg-green-500 opacity-80 inline-block" />
                Full package — {bothReady.length}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <span className="size-2.5 rounded-full bg-[var(--color-surface-3)] inline-block" />
                Pending — {pending.length}
              </span>
            </div>
          </Card>
        )}

        {/* Stage breakdown */}
        {!isLoading && stageBreakdown.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2">
              <Zap size={14} className="text-[var(--color-accent)]" />
              <p className="font-semibold text-sm">Coverage by Pipeline Stage</p>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {stageBreakdown.map(({ stage, total, hasVideo, hasDemo }) => {
                const color = STAGE_COLOR[stage] ?? "var(--color-accent)";
                const pct = total > 0 ? Math.round((hasDemo / total) * 100) : 0;
                return (
                  <div key={stage} className="flex items-center gap-4 px-6 py-3">
                    <div
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-sm font-medium text-[var(--color-text)] w-36 shrink-0">
                      {stage}
                    </span>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[var(--color-text-muted)] w-12 text-right shrink-0">
                        {hasDemo}/{total}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {hasVideo > 0 && (
                        <Badge variant="info">{hasVideo} vid</Badge>
                      )}
                      {hasDemo > 0 && (
                        <Badge variant="success">{hasDemo} demo</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search prospects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] pl-9 pr-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "video", "demo", "pending"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-[var(--radius-xl)] text-xs font-semibold uppercase tracking-wider transition-colors ${
                  filter === f
                    ? "bg-[var(--color-accent)] text-black"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {f === "all" ? `All (${leads.length})` :
                 f === "video" ? `Video (${withVideo.length})` :
                 f === "demo" ? `Demo (${withDemo.length})` :
                 `Pending (${pending.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Asset grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-48 rounded-[var(--radius-2xl)] animate-pulse bg-[var(--color-surface-2)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center text-[var(--color-text-muted)]">
            <Film size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No assets found</p>
            <p className="text-xs mt-1">
              {search ? "Try a different search term" : "Upload video files to leads in the CRM to see them here"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((lead) => {
              const hasVideo = !!lead.videoFile;
              const hasDemo  = !!lead.demoFile;
              const status = hasVideo && hasDemo ? "complete" : hasVideo || hasDemo ? "partial" : "pending";

              return (
                <Card key={lead.clientId} className="overflow-hidden group">
                  {/* Thumbnail area */}
                  <div
                    className="aspect-video flex items-center justify-center relative overflow-hidden"
                    style={{
                      background: status === "complete"
                        ? "linear-gradient(135deg, var(--color-accent)11, #22c55e11)"
                        : status === "partial"
                        ? "linear-gradient(135deg, var(--color-accent)11, var(--color-surface-3))"
                        : "var(--color-surface-2)",
                    }}
                  >
                    <div className="flex flex-col items-center gap-2 text-center px-4">
                      <Film
                        size={28}
                        style={{
                          color: status === "complete" ? "#22c55e" :
                                 status === "partial"  ? "var(--color-accent)" :
                                 "var(--color-text-muted)",
                          opacity: status === "pending" ? 0.3 : 0.7,
                        }}
                      />
                      <span className="text-xs font-mono text-[var(--color-text-muted)] opacity-60">
                        {status === "pending" ? "No assets yet" :
                         status === "partial" ? "Partial coverage" :
                         "Full package"}
                      </span>
                    </div>
                    {/* Status corner badge */}
                    <div className="absolute top-3 right-3">
                      <Badge
                        variant={status === "complete" ? "success" : status === "partial" ? "info" : "neutral"}
                      >
                        {status === "complete" ? "Complete" : status === "partial" ? "Partial" : "Pending"}
                      </Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[var(--color-text)] truncate">
                          {lead.businessName}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {lead.area} · {lead.businessType}
                        </p>
                      </div>
                      <Link
                        to={`/leads/${lead.clientId}`}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors shrink-0"
                      >
                        <ExternalLink size={13} />
                      </Link>
                    </div>

                    {/* Asset indicators */}
                    <div className="flex gap-2 flex-wrap">
                      <span
                        className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${
                          hasVideo
                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        <Film size={10} />
                        {hasVideo ? "Video ✓" : "No video"}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${
                          hasDemo
                            ? "bg-green-500/10 text-green-400"
                            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        <Play size={10} />
                        {hasDemo ? "Demo ✓" : "No demo"}
                      </span>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {lead.accountStatus}
                      </span>
                      <Link
                        to={`/leads/${lead.clientId}`}
                        className="text-xs text-[var(--color-accent)] hover:underline font-medium"
                      >
                        {status === "pending" ? "Upload assets →" : "View lead →"}
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Partial assets */}
        {!isLoading && partial.length > 0 && filter === "all" && !search && (
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-yellow-400" />
                <p className="font-semibold text-sm">Incomplete Packages</p>
                <Badge variant="warning">{partial.length}</Badge>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">Needs either video or demo file</p>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {partial.map((lead) => (
                <Link
                  key={lead.clientId}
                  to={`/leads/${lead.clientId}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">{lead.businessName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{lead.area} · {lead.accountStatus}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {lead.videoFile && <Badge variant="info">Video ✓</Badge>}
                    {!lead.videoFile && <Badge variant="neutral">No video</Badge>}
                    {lead.demoFile && <Badge variant="success">Demo ✓</Badge>}
                    {!lead.demoFile && <Badge variant="neutral">No demo</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
