import { Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CircleDollarSign, Mic2, Radar } from "lucide-react";
import { ModuleRail } from "@/components/layout/ModuleRail";
import { ModuleSidebar } from "@/components/layout/ModuleSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TopBar } from "@/components/layout/TopBar";
import { VoiceModePanel } from "@/components/features/VoiceModePanel";
import { GlobalCommandPalette } from "@/components/os/GlobalCommandPalette";
import { ObjectDossierPanel } from "@/components/os/ObjectDossierPanel";
import {
  buildAccountDossier,
  buildCommandItems,
  buildMissionCards,
  type ObjectDossier,
} from "@/os/os-spine";
import {
  fetchClient360,
  fetchMetrics,
  fetchOpenClawAgents,
  fetchOpenClawApprovals,
} from "@/services/api";
import type { ThemeMode, TimeMode } from "@/types/frontend";

export interface AppShellProps {
  timeMode: TimeMode;
  themeMode: ThemeMode;
  activeTheme: Exclude<ThemeMode, "auto">;
  greeting: string;
  dayLabel: string;
  timeLabel: string;
  notificationPermission: NotificationPermission | "unsupported";
  onThemeToggle: () => void;
  onEnableNotifications: () => void;
  onCreateAccount: () => void;
}

export function AppShell(props: AppShellProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState<ObjectDossier | null>(null);

  const client360Query = useQuery({
    queryKey: ["client-360"],
    queryFn: fetchClient360,
    staleTime: 60_000,
  });
  const agentsQuery = useQuery({
    queryKey: ["openclaw-agents"],
    queryFn: fetchOpenClawAgents,
    staleTime: 60_000,
  });
  const approvalsQuery = useQuery({
    queryKey: ["openclaw-approvals"],
    queryFn: fetchOpenClawApprovals,
    staleTime: 30_000,
  });
  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: fetchMetrics,
    staleTime: 30_000,
  });

  const accounts = client360Query.data?.accounts ?? [];
  const agents = agentsQuery.data?.agents ?? [];
  const approvals = approvalsQuery.data ?? null;

  const commandItems = useMemo(
    () => buildCommandItems({ accounts, agents, approvals }),
    [accounts, agents, approvals],
  );

  const missionCards = useMemo(
    () => buildMissionCards({ accounts, agents, approvals }),
    [accounts, agents, approvals],
  );

  const dossier = selectedDossier ?? (accounts[0] ? buildAccountDossier(accounts[0]) : null);
  const pendingApprovals = approvals?.pending.length ?? 0;
  const runningAgents = agents.filter((agent) => agent.status !== "idle").length;
  const weightedPipeline = metricsQuery.data?.weightedPipeline ?? 0;
  const overdueTasks = accounts.reduce((sum, account) => sum + account.overdueTasks, 0);
  const staleAccounts = accounts.filter((account) => account.daysSinceLastActivity >= 5).length;

  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const wantsCommand = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!wantsCommand) return;
      event.preventDefault();
      setCommandOpen((open) => !open);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="shell-background hos-shell">
      <ModuleRail />
      <ModuleSidebar />
      <div className="hos-main">
        <TopBar
          greeting={props.greeting}
          dayLabel={props.dayLabel}
          timeLabel={props.timeLabel}
          activeTheme={props.activeTheme}
          themeMode={props.themeMode}
          onThemeToggle={props.onThemeToggle}
          notificationPermission={props.notificationPermission}
          onEnableNotifications={props.onEnableNotifications}
          onCreateAccount={props.onCreateAccount}
          onOpenCommand={() => setCommandOpen(true)}
          onOpenVoice={() => setVoiceOpen(true)}
        />
        <div className="hos-strip">
          <div className="hos-strip-row">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
              <CircleDollarSign size={14} className="text-[var(--color-accent)]" />
              <strong className="font-semibold text-[var(--color-text)]">{money.format(weightedPipeline)}</strong>
              pipeline
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
              <AlertTriangle size={14} className={overdueTasks > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"} />
              <strong className="font-semibold text-[var(--color-text)]">{overdueTasks}</strong>
              overdue tasks
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
              <Activity size={14} className={pendingApprovals > 0 ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-muted)]"} />
              <strong className="font-semibold text-[var(--color-text)]">{pendingApprovals}</strong>
              approvals
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
              <Radar size={14} className={staleAccounts > 0 ? "text-[var(--color-error)]" : "text-[var(--color-success)]"} />
              <strong className="font-semibold text-[var(--color-text)]">{staleAccounts}</strong>
              stale accounts
            </span>
            <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
              <span className={`inline-flex size-2 rounded-full ${runningAgents > 0 ? "bg-[var(--color-success)]" : "bg-[var(--color-text-faint)]"}`} />
              agents running
              <strong className="font-semibold text-[var(--color-text)]">{runningAgents}</strong>
            </span>
          </div>
        </div>
        <main className="app-scroll hos-content">
          <Outlet />
        </main>
      </div>
      <ObjectDossierPanel
        dossier={dossier}
        missionCards={missionCards}
        pendingApprovals={pendingApprovals}
        runningAgents={runningAgents}
        onOpenCommand={() => setCommandOpen(true)}
      />
      <MobileNav />
      <button type="button" className="hos-voice-dock" onClick={() => setVoiceOpen(true)} aria-label="Open JARVIS voice mode">
        <Mic2 size={18} />
        <span>Talk to JARVIS</span>
      </button>
      <VoiceModePanel open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      <GlobalCommandPalette
        open={commandOpen}
        items={commandItems}
        onClose={() => setCommandOpen(false)}
        onCreateAccount={props.onCreateAccount}
        onSelectItem={(item) => {
          if (item.type !== "client") return;
          const clientId = item.id.replace(/^client-/, "");
          const account = accounts.find((candidate) => candidate.clientId === clientId);
          if (account) setSelectedDossier(buildAccountDossier(account));
        }}
      />
    </div>
  );
}
