import { CheckCircle2, Clock3 } from "lucide-react";
import type { ScheduleItem } from "@/types/frontend";

export interface TimelineProps {
  items: ScheduleItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="relative flex gap-4 pl-3">
          <span className="absolute left-0 top-10 h-[calc(100%-1rem)] w-px bg-[var(--color-border)]" />
          <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
            {item.completed ? (
              <CheckCircle2 size={16} className="text-[var(--color-success)]" />
            ) : (
              <Clock3 size={16} className="text-[var(--color-accent)]" />
            )}
          </span>
          <div className="min-w-0 flex-1 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[var(--color-text)]">{item.title}</p>
              <span className="section-kicker">{item.category}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {item.date} at {item.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
