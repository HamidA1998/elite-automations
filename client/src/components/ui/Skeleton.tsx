import React from "react";

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-[var(--color-surface-2)] ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
        style={{ animation: "shimmer 1.5s infinite" }}
      />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}
