import { useQuery } from "@tanstack/react-query";
import { fetchLeadPipeline } from "@/services/api";
import { Link } from "react-router-dom";
import clsx from "clsx";

const STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

const stageColor: Record<string, string> = {
  New:       "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Contacted: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Qualified: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Proposal:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Won:       "bg-green-500/15 text-green-400 border-green-500/30",
  Lost:      "bg-red-500/15 text-red-400 border-red-500/30",
};

function mapStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("won") || s.includes("closed")) return "Won";
  if (s.includes("lost") || s.includes("dead")) return "Lost";
  if (s.includes("proposal")) return "Proposal";
  if (s.includes("qualif")) return "Qualified";
  if (s.includes("contact")) return "Contacted";
  return "New";
}

export function PipelinePage() {
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ["lead-pipeline"],
    queryFn: fetchLeadPipeline,
    staleTime: 60_000,
  });
  const leads = pipelineData?.leads ?? [];

  const board: Record<string, typeof leads> = Object.fromEntries(STAGES.map((s) => [s, []]));
  leads.forEach((l) => {
    const stage = mapStatus(l.accountStatus);
    board[stage]?.push(l);
  });

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <p className="section-kicker">CRM</p>
        <h1 className="display-title mt-2">Pipeline</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{leads.length} accounts across {STAGES.length} stages</p>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s} className="w-[260px] shrink-0 h-96 rounded-[var(--radius-2xl)] animate-pulse bg-[var(--color-surface-2)]" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage} className="w-[260px] shrink-0 flex flex-col gap-2">
              <div className={clsx("flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold", stageColor[stage])}>
                <span>{stage}</span>
                <span className="metric-mono">{board[stage].length}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {board[stage].map((lead) => (
                  <Link
                    key={lead.clientId}
                    to={`/leads/${lead.clientId}`}
                    className="block glass-panel rounded-[var(--radius-xl)] p-3 hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <p className="text-sm font-medium text-[var(--color-text)] leading-tight">{lead.businessName}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{lead.area}</p>
                    {lead.dealValue > 0 && (
                      <p className="metric-mono text-xs text-[var(--color-accent)] mt-1">
                        £{lead.dealValue.toLocaleString()}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
