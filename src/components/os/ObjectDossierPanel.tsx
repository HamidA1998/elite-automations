import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Command, Shield } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { MissionCard, ObjectDossier } from "@/os/os-spine";

interface ObjectDossierPanelProps {
  dossier: ObjectDossier | null;
  missionCards: MissionCard[];
  pendingApprovals: number;
  runningAgents: number;
  onOpenCommand: () => void;
}

const metricToneClass: Record<ObjectDossier["metrics"][number]["tone"], string> = {
  neutral: "text-[var(--color-text)]",
  good: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger: "text-[var(--color-error)]",
};

function formatRelative(value: string | null): string {
  if (!value) return "No activity";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ObjectDossierPanel({
  dossier,
  missionCards,
  pendingApprovals,
  runningAgents,
  onOpenCommand,
}: ObjectDossierPanelProps) {
  const urgentCards = missionCards.filter((card) => card.stuck || card.priority === "critical").slice(0, 4);

  return (
    <aside className="hos-dossier">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Dossier</p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">Elite OS context</p>
        </div>
        <Button variant="ghost" className="rounded-full border border-[var(--color-border)] px-3" onClick={onOpenCommand}>
          <Command size={16} />
        </Button>
      </div>

      <div className="space-y-4 overflow-y-auto pr-1">
        <section className="os-dossier-card p-4">
          {dossier ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge variant={dossier.priority === "critical" ? "error" : dossier.priority === "high" ? "warning" : "neutral"}>
                    {dossier.status}
                  </Badge>
                  <h3 className="mt-3 text-lg font-semibold leading-tight text-[var(--color-text)]">{dossier.title}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{dossier.subtitle}</p>
                </div>
                {dossier.href ? (
                  <Link
                    to={dossier.href}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    <ArrowUpRight size={15} />
                  </Link>
                ) : null}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {dossier.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
                    <p className={`metric-mono text-lg font-semibold ${metricToneClass[metric.tone]}`}>{metric.value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{metric.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {dossier.sections.map((section) => (
                  <div key={section.title} className="border-t border-[var(--color-border)] pt-3">
                    <p className="text-xs font-semibold text-[var(--color-text)]">{section.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{section.body}</p>
                    {section.meta ? <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-faint)]">{section.meta}</p> : null}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {dossier.actions.map((action) =>
                  action.href ? (
                    <Link
                      key={action.label}
                      to={action.href}
                      className="rounded-full border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      {action.label}
                    </Link>
                  ) : null,
                )}
              </div>
            </>
          ) : (
            <div className="py-2">
              <Badge variant="info">OS spine online</Badge>
              <h3 className="mt-3 text-lg font-semibold text-[var(--color-text)]">No object selected</h3>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                Use command search to open a client, approval, agent, call, invoice, or workflow. The dossier follows your selection.
              </p>
              <Button variant="secondary" className="mt-4 w-full" onClick={onOpenCommand}>
                <Command size={15} />
                Open command
              </Button>
            </div>
          )}
        </section>

        <section className="os-dossier-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="section-kicker">System pulse</p>
            <Badge variant={pendingApprovals > 0 ? "warning" : "success"}>{pendingApprovals} approvals</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] bg-[var(--color-surface)] px-3 py-3">
              <Shield size={15} className="text-[var(--color-warning)]" />
              <p className="metric-mono mt-2 text-xl font-semibold">{pendingApprovals}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Needs approval</p>
            </div>
            <div className="rounded-[18px] bg-[var(--color-surface)] px-3 py-3">
              <Activity size={15} className="text-[var(--color-accent)]" />
              <p className="metric-mono mt-2 text-xl font-semibold">{runningAgents}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Agents active</p>
            </div>
          </div>
        </section>

        <section className="os-dossier-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="section-kicker">Attention queue</p>
            <Badge variant={urgentCards.length > 0 ? "error" : "success"}>{urgentCards.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {urgentCards.length > 0 ? (
              urgentCards.map((card) => (
                <Link
                  key={card.id}
                  to={card.href ?? "/ops"}
                  className="block rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
                >
                  <div className="flex items-start gap-2">
                    {card.stuck ? (
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[var(--color-error)]" />
                    ) : (
                      <Shield size={13} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
                    )}
                    <p
                      className="line-clamp-2 break-words text-xs font-semibold leading-snug text-[var(--color-text)]"
                      title={card.title}
                    >
                      {card.title}
                    </p>
                  </div>
                  <p
                    className="mt-1 line-clamp-2 break-words text-[11px] leading-snug text-[var(--color-text-muted)]"
                    title={`${card.owner} · ${formatRelative(card.lastActionAt)}`}
                  >
                    {card.owner} · {formatRelative(card.lastActionAt)}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4">
                <CheckCircle2 size={16} className="text-[var(--color-success)]" />
                <p className="mt-2 text-xs font-semibold text-[var(--color-text)]">No critical items</p>
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Approvals, stuck sessions, and urgent clients will surface here.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
