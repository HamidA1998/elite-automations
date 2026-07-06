import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCcw, Shield, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchOperatorApprovals, resolveOperatorApproval } from "@/services/api";
import type { OperatorApproval } from "@/types/frontend";

type RiskLevel = "low" | "medium" | "high" | "critical";
type FilterType = "all" | "pending" | "resolved" | "high-risk";

const RISK_COLOR: Record<RiskLevel, string> = {
  low: "text-green-400 bg-green-400/10 border-green-400/20",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
};

const STATUS_BADGE: Record<OperatorApproval["status"], "success" | "neutral" | "error" | "warning"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

function riskFromApproval(approval: OperatorApproval): RiskLevel {
  const impact = `${approval.what} ${approval.estimatedImpact} ${approval.why}`.toLowerCase();
  if (impact.includes("delete") || impact.includes("payment") || impact.includes("high api") || impact.includes("high search")) {
    return "critical";
  }
  if (impact.includes("send") || impact.includes("call") || impact.includes("sms") || impact.includes("large")) return "high";
  if (impact.includes("moderate") || impact.includes("api")) return "medium";
  return "low";
}

function resultRoute(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const actions = (result as {actions?: unknown}).actions;
  if (!Array.isArray(actions)) return null;
  const routeAction = actions.find((action): action is {route: string} =>
    Boolean(action && typeof action === "object" && typeof (action as {route?: unknown}).route === "string"),
  );
  return routeAction?.route ?? null;
}

export function ApprovalsPage() {
  const [approvals, setApprovals] = useState<OperatorApproval[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchOperatorApprovals();
      setApprovals(response.approvals);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApprovals();
  }, []);

  const counts = useMemo(() => ({
    pending: approvals.filter((approval) => approval.status === "pending").length,
    approved: approvals.filter((approval) => approval.status === "approved").length,
    rejected: approvals.filter((approval) => approval.status === "rejected").length,
    highRisk: approvals.filter((approval) => {
      const risk = riskFromApproval(approval);
      return risk === "high" || risk === "critical";
    }).length,
  }), [approvals]);

  const filtered = approvals.filter((approval) => {
    if (filter === "pending") return approval.status === "pending";
    if (filter === "resolved") return approval.status !== "pending";
    if (filter === "high-risk") {
      const risk = riskFromApproval(approval);
      return risk === "high" || risk === "critical";
    }
    return true;
  });

  const resolveApproval = async (approvalId: string, decision: "approved" | "rejected") => {
    setResolvingId(approvalId);
    setError(null);
    try {
      const response = await resolveOperatorApproval(approvalId, decision);
      const route = decision === "approved" ? resultRoute(response.result) : null;
      await loadApprovals();
      if (route) window.location.hash = route;
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Could not resolve approval.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <PageWrapper
      eyebrow="HAMID.OS · RISK CONTROL"
      title="Approvals"
      description="Real approval queue for any operator action that sends, spends, calls, deletes, or touches the outside world."
      action={(
        <Button variant="secondary" onClick={() => void loadApprovals()}>
          <RefreshCcw size={15} />
          Refresh
        </Button>
      )}
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Pending", value: counts.pending, tone: "text-yellow-400" },
            { label: "High risk", value: counts.highRisk, tone: "text-orange-400" },
            { label: "Approved", value: counts.approved, tone: "text-green-400" },
            { label: "Rejected", value: counts.rejected, tone: "text-red-400" },
          ].map(({ label, value, tone }) => (
            <Card key={label} className="p-4">
              <div className={`font-mono text-2xl font-bold ${tone}`}>{value}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</div>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "pending", "resolved", "high-risk"] as FilterType[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-all ${
                filter === item
                  ? "bg-[var(--color-accent)] text-black"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {item.replace("-", " ")}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--color-text-muted)]">
            {loading ? "Loading live approvals..." : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {error ? (
          <Card className="border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </Card>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Shield size={32} className="mx-auto mb-4 text-[var(--color-text-muted)] opacity-40" />
            <p className="font-semibold text-[var(--color-text-muted)]">No operator approvals in this view</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              When JARVIS blocks spend, sending, calls, or external updates, the real request will appear here.
            </p>
          </Card>
        ) : null}

        <div className="space-y-4">
          {filtered.map((approval) => {
            const risk = riskFromApproval(approval);
            const isPending = approval.status === "pending";
            const resolving = resolvingId === approval.id;
            return (
              <Card
                key={approval.id}
                className={`p-5 transition-opacity ${isPending ? "" : "opacity-70"}`}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${RISK_COLOR[risk]}`}>
                        <AlertTriangle size={12} />
                        {risk.toUpperCase()} RISK
                      </span>
                      <Badge variant="neutral">Agent: {approval.agent}</Badge>
                      <Badge variant="neutral">{approval.toolName}</Badge>
                      <Badge variant={STATUS_BADGE[approval.status]}>{approval.status.toUpperCase()}</Badge>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">{approval.what}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{approval.why}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Impact</div>
                    <div className="max-w-[14rem] text-sm font-semibold text-[var(--color-accent)]">{approval.estimatedImpact}</div>
                  </div>
                </div>

                <div className="mb-4 grid gap-3 rounded-[12px] border border-[var(--color-border)] bg-black/15 p-3 text-xs text-[var(--color-text-muted)] md:grid-cols-3">
                  <span>Requested: {new Date(approval.requestedAt).toLocaleString("en-GB")}</span>
                  <span>Session: {approval.sessionId}</span>
                  <span>Tool: {approval.toolId}</span>
                </div>

                {isPending ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={resolving}
                      className="bg-green-500/20 text-green-300 hover:bg-green-500/30"
                      onClick={() => void resolveApproval(approval.id, "approved")}
                    >
                      <CheckCircle size={14} />
                      Approve and run
                    </Button>
                    <Button
                      disabled={resolving}
                      className="bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      onClick={() => void resolveApproval(approval.id, "rejected")}
                    >
                      <XCircle size={14} />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    Decision recorded: {approval.status}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </PageWrapper>
  );
}
