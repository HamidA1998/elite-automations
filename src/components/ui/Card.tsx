import type { ReactNode } from "react";
import clsx from "clsx";

export interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <section
      className={clsx(
        "glass-panel rounded-[10px] border border-[var(--color-border)] p-6 transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-px hover:shadow-[0_18px_44px_rgba(0,0,0,0.22)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
