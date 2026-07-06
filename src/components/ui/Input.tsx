import { forwardRef, useId, type InputHTMLAttributes } from "react";
import clsx from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label className="flex flex-col gap-2">
      <span className="section-kicker">{label}</span>
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          "min-h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-[var(--color-text)] outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]",
          error && "border-[var(--color-error)] focus:shadow-[0_0_0_4px_rgba(239,68,68,0.16)]",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-[var(--text-xs)] text-[var(--color-error)]">{error}</span> : null}
    </label>
  );
});
