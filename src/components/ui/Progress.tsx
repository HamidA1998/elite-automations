export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
}

export function Progress({ value, max = 100, label }: ProgressProps) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--color-text-muted)]">
        <span>{label ?? "Progress"}</span>
        <span className="metric-mono">{Math.round(percent)}%</span>
      </div>
      <div className="h-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-3)] p-[2px]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
