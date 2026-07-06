import { Sun, Moon, Sunrise, Sunset, Bell, RefreshCw, MessageSquare, CalendarDays, Circle } from "lucide-react";
import { useTime, useAutoTheme } from "@/hooks/useTime";
import { useAppStore } from "@/stores/appStore";
import { useNextScheduleItem } from "@/hooks/useSchedule";
import type { TimeTheme } from "@/types";
import { api } from "@/services/api";

const themeIcons: Record<TimeTheme, React.ReactNode> = {
  dawn:  <Sunrise size={15} />,
  day:   <Sun size={15} />,
  dusk:  <Sunset size={15} />,
  night: <Moon size={15} />,
};

const themeLabels: Record<TimeTheme, string> = {
  dawn: "Dawn", day: "Day", dusk: "Dusk", night: "Night",
};

const themeOrder: TimeTheme[] = ["dawn", "day", "dusk", "night"];

export function TopBar() {
  const { timeString, dayString, dateString } = useTime();
  const { manualTheme, setManualTheme, state, setState, setLoading } = useAppStore();
  const activeTheme = useAutoTheme(manualTheme);
  const nextItem = useNextScheduleItem();

  const cycleTheme = () => {
    const cur = themeOrder.indexOf(activeTheme);
    const next = themeOrder[(cur + 1) % themeOrder.length];
    setManualTheme(next === useAutoTheme(null) ? null : next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await api.getState();
      setState(s);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-6 border-b border-[var(--color-border)] bg-[#080707]/88 backdrop-blur-xl">
      {/* Left: greeting + date */}
      <div className="flex items-center gap-4">
        <div className="hidden lg:block text-[var(--color-bronze)] font-display text-lg tracking-wide mr-6">
          HAMID.OS
        </div>
        <div>
          <div className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
            <CalendarDays size={14} className="text-[var(--color-text-muted)]" />
            {dayString}, {dateString}
          </div>
          {nextItem && (
            <div className="text-xs text-[var(--color-text-muted)]">
              Next: <span className="text-[var(--color-accent)]">{nextItem.title}</span> at {nextItem.time}
            </div>
          )}
        </div>
      </div>

      {/* Centre: pipeline status */}
      {state && (
        <div className="hidden md:flex items-center gap-6 text-xs text-[var(--color-text-muted)]">
          <span className="flex items-center gap-2"><Circle size={8} className="fill-emerald-400 text-emerald-400" /> Live sync</span>
          <span><span className="font-mono font-semibold text-[var(--color-text)]">{state.metrics.qualifiedLeads}</span> leads</span>
          <span><span className="font-mono font-semibold text-emerald-400">{state.metrics.repliedAccounts}</span> replied</span>
          <span><span className="font-mono font-semibold text-[var(--color-bronze)]">£{Math.round(state.metrics.weightedPipeline).toLocaleString()}</span> pipeline</span>
        </div>
      )}

      {/* Right: clock + controls */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-[var(--color-text-muted)]">{timeString}</span>
        <button
          onClick={cycleTheme}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-all duration-200"
          title={`Theme: ${themeLabels[activeTheme]}`}
        >
          {themeIcons[activeTheme]}
        </button>
        <button
          onClick={refresh}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-all duration-200"
          title="Refresh data"
        >
          <RefreshCw size={15} />
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-all duration-200">
          <Bell size={15} />
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-all duration-200">
          <MessageSquare size={15} />
        </button>
        <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-[var(--color-border)]">
          <div className="h-8 w-8 rounded-full bg-[var(--color-bronze)]/15 text-[var(--color-bronze)] flex items-center justify-center text-xs font-semibold">H</div>
          <div className="leading-tight">
            <div className="text-xs text-[var(--color-text)]">Hamid</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Founder</div>
          </div>
        </div>
      </div>
    </header>
  );
}
