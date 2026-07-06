import { Clock3, Mail, PencilRuler, Target, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  timestampLabel: string;
  timestampValue: string;
  type: "schedule" | "lead" | "system";
  href?: string;
}

const typeIcon = {
  schedule: Clock3,
  lead: Target,
  system: Workflow,
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="ops-zone space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">Activity feed</p>
          <h2 className="display-title !text-[var(--text-lg)]">Latest motion across the machine</h2>
        </div>
        <span className="inline-flex size-11 items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-3)]">
          <Mail size={18} className="text-[var(--color-accent)]" />
        </span>
      </div>
      {items.length ? (
        <div className="space-y-4">
          {items.map((item) => {
            const Icon = typeIcon[item.type] ?? PencilRuler;
            const content = (
              <>
                <span className="inline-flex size-10 shrink-0 items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-3)]">
                  <Icon size={16} className="text-[var(--color-accent)]" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.title}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{item.detail}</p>
                  <p className="section-kicker !tracking-[0.03em]">{item.timestampLabel}</p>
                </div>
              </>
            );
            if (item.href) {
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex gap-4 border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-accent)]/35 hover:bg-[var(--color-surface-2)]"
                >
                  {content}
                </Link>
              );
            }
            return (
              <div key={item.id} className="flex gap-4 border border-[var(--color-border)] p-4">
                {content}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed border-[var(--color-border-strong)] px-6 py-8">
          <p className="section-kicker">No activity yet</p>
          <p className="mt-2 body-copy text-sm">
            Planner completions, lead updates, and system actions will collect here so you can scan
            the last ten moves in one place.
          </p>
        </div>
      )}
    </Card>
  );
}
