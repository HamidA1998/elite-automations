import clsx from "clsx";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-lg)] bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-surface-2)_96%,transparent),color-mix(in_oklab,var(--color-surface-3)_86%,transparent),color-mix(in_oklab,var(--color-surface-2)_96%,transparent))] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite]",
        className,
      )}
    />
  );
}
