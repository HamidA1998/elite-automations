import { useQuery } from "@tanstack/react-query";
import { fetchLeadPipeline } from "@/services/api";
import { Film, Image, FileText, Download } from "lucide-react";

export function VidAssetsPage() {
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ["lead-pipeline"],
    queryFn: fetchLeadPipeline,
    staleTime: 60_000,
  });
  const leads = pipelineData?.leads ?? [];

  const assets = leads.flatMap((lead) => {
    const items = [];
    if (lead.videoFile) items.push({ type: "video",  label: lead.businessName, file: lead.videoFile,    icon: Film,     color: "var(--color-accent)" });
    if (lead.demoFile)  items.push({ type: "demo",   label: lead.businessName, file: lead.demoFile,     icon: FileText, color: "#22c55e" });
    if (lead.imageHero) items.push({ type: "image",  label: lead.businessName, file: lead.imageHero,    icon: Image,    color: "#f59e0b" });
    return items;
  });

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <p className="section-kicker">Video</p>
        <h1 className="display-title mt-2">Assets</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">All files across your entire pipeline.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse bg-[var(--color-surface-2)]" />)}
        </div>
      ) : assets.length === 0 ? (
        <div className="glass-panel rounded-[var(--radius-2xl)] py-16 flex flex-col items-center text-center text-[var(--color-text-muted)]">
          <Film size={36} className="mb-3 opacity-30" />
          <p className="text-sm">No assets found. Generate images or videos for your leads first.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-[var(--radius-2xl)] divide-y divide-[var(--color-border)] overflow-hidden">
          {assets.map((asset, i) => {
            const Icon = asset.icon;
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-surface-2)] transition-colors">
                <span className="inline-flex size-9 items-center justify-center rounded-full shrink-0" style={{ background: asset.color + "20", color: asset.color }}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text)]">{asset.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)] font-mono truncate">{asset.file}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)] capitalize shrink-0">
                  {asset.type}
                </span>
                <button className="p-1.5 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                  <Download size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
