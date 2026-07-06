import { useMemo } from "react";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";
import type { ScheduleItem } from "@/types/frontend";

function hours() {
  return Array.from({ length: 18 }, (_, index) => {
    const hour = index + 6;
    return `${String(hour).padStart(2, "0")}:00`;
  });
}

function priorityVariant(priority: string) {
  if (priority === "high") return "error";
  if (priority === "medium") return "warning";
  return "neutral";
}

function categoryTint(category: string) {
  switch (category) {
    case "Outreach":
      return "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8";
    case "Build":
      return "border-[var(--color-success)]/30 bg-[var(--color-success)]/8";
    case "Research":
      return "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8";
    case "Personal":
      return "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/8";
    default:
      return "border-[var(--color-border)] bg-[var(--color-surface-2)]";
  }
}

export function HourlyPlanner({
  items,
  onToggleComplete,
}: {
  items: ScheduleItem[];
  onToggleComplete: (id: string) => void;
}) {
  const hourMap = useMemo(() => {
    return hours().map((slot) => ({
      slot,
      items: items.filter((item) => item.time.slice(0, 2) === slot.slice(0, 2)),
    }));
  }, [items]);

  return (
    <div className="space-y-3">
      {hourMap.map(({ slot, items: slotItems }) => (
        <div key={slot} className="grid gap-3 md:grid-cols-[88px_minmax(0,1fr)]">
          <div className="pt-3">
            <p className="metric-mono text-sm text-[var(--color-text-muted)]">{slot}</p>
          </div>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            {slotItems.length ? (
              <div className="space-y-3">
                {slotItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleComplete(item.id)}
                    className={clsx(
                      "flex w-full items-start justify-between gap-3 rounded-[var(--radius-lg)] border px-4 py-4 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-px",
                      categoryTint(item.category),
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={clsx("font-medium", item.completed && "line-through opacity-60")}>
                          {item.title}
                        </p>
                        <Badge variant="info">{item.category}</Badge>
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {item.time} • {item.completed ? "Completed" : "Scheduled"}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "mt-1 inline-flex size-5 shrink-0 rounded-full border",
                        item.completed
                          ? "border-[var(--color-success)] bg-[var(--color-success)]"
                          : "border-[var(--color-border-strong)] bg-transparent",
                      )}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-2 py-3 text-sm text-[var(--color-text-faint)]">No block scheduled</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
