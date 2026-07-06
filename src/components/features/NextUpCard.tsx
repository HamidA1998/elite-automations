import { Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ScheduleItem } from "@/types/frontend";

export interface NextUpCardProps {
  nextItem?: ScheduleItem;
}

export function NextUpCard({ nextItem }: NextUpCardProps) {
  return (
    <Card className="ops-zone space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">What's next</p>
          <h3 className="display-title !text-[var(--text-lg)]">Immediate focus</h3>
        </div>
        <span className="inline-flex size-11 items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface)]">
          <Clock3 size={18} className="text-[var(--color-accent)]" />
        </span>
      </div>
      {nextItem ? (
        <div className="metric-panel space-y-4 p-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{nextItem.title}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {nextItem.date} at {nextItem.time}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{nextItem.category}</Badge>
            <Badge variant={nextItem.priority === "high" ? "error" : nextItem.priority === "medium" ? "warning" : "neutral"}>
              {nextItem.priority}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="metric-panel space-y-3 p-4">
          <p className="body-copy text-sm">
            Your planner is clear right now. Add the next outreach, build, or research block so the day
            always has a defined next move.
          </p>
        </div>
      )}
    </Card>
  );
}
