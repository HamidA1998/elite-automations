import { Badge } from "@/components/ui/Badge";

export function LeadStatusBadge({ status }: {status: string}) {
  const normalized = status.toLowerCase();
  const variant =
    normalized === "won"
      ? "success"
      : normalized === "lost"
        ? "error"
        : normalized === "proposal" || normalized === "replied"
          ? "warning"
          : "info";
  return <Badge variant={variant}>{status}</Badge>;
}
