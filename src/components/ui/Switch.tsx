import clsx from "clsx";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function Switch({ checked, onChange, label, description }: SwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-4 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:border-[var(--color-border-strong)]"
    >
      <span className="space-y-1">
        <span className="block text-sm font-medium text-[var(--color-text)]">{label}</span>
        {description ? (
          <span className="block text-sm text-[var(--color-text-muted)]">{description}</span>
        ) : null}
      </span>
      <span
        className={clsx(
          "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--duration-base)] ease-[var(--ease-out)]",
          checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-3)]",
        )}
      >
        <span
          className={clsx(
            "absolute top-1 size-5 rounded-full bg-white transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)]",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}
