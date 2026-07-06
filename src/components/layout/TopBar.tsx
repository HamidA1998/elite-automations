import { Bell, Bot, Command, Mic2, MoonStar, Plus, Search, SunMedium, Sunrise, Sunset, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { ThemeMode, TimeMode } from "@/types/frontend";

const modeIcon: Record<TimeMode, typeof Sunrise> = {
  dawn: Sunrise,
  day: SunMedium,
  dusk: Sunset,
  night: MoonStar,
};

export interface TopBarProps {
  greeting: string;
  dayLabel: string;
  timeLabel: string;
  activeTheme: Exclude<ThemeMode, "auto">;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  notificationPermission: NotificationPermission | "unsupported";
  onEnableNotifications: () => void;
  onCreateAccount: () => void;
  onOpenCommand: () => void;
  onOpenVoice: () => void;
}

export function TopBar({
  greeting,
  dayLabel,
  timeLabel,
  activeTheme,
  themeMode,
  onThemeToggle,
  notificationPermission,
  onEnableNotifications,
  onCreateAccount,
  onOpenCommand,
  onOpenVoice,
}: TopBarProps) {
  const Icon = modeIcon[activeTheme];

  return (
    <header className="hos-topbar">
      <div className="hos-topbar-row">
        <div className="hos-topbar-greeting">
          <p className="hos-topbar-title">{greeting}</p>
          <p className="hos-topbar-subtitle">{dayLabel}</p>
        </div>
        <button type="button" className="hos-command-launch" onClick={onOpenCommand}>
          <Search size={15} />
          <span>Search clients, agents, workflows, logs</span>
          <kbd>
            <Command size={12} />
            K
          </kbd>
        </button>
        <div className="hos-topbar-actions">
          <div className="hos-topbar-create-actions">
            <Link to="/ops/automation" className="hos-create-action">
              <Plus size={13} />
              New lead
            </Link>
            <button type="button" className="hos-create-action" onClick={onCreateAccount}>
              <Target size={13} />
              New account
            </button>
            <Link to="/agents" className="hos-create-action">
              <Bot size={13} />
              Agent task
            </Link>
          </div>
          <Link to="/ops/approvals" className="hos-toolbar-pill">
            <Bell size={14} />
            <span>Approvals</span>
          </Link>
          <button type="button" className="hos-toolbar-pill hos-toolbar-pill--voice" onClick={onOpenVoice}>
            <Mic2 size={14} />
            <span>Voice</span>
          </button>
          <Badge variant="neutral" className="hidden border border-[var(--color-border)] bg-[var(--color-surface)] md:inline-flex">
            <Icon size={13} className="mr-1.5" />
            {themeMode === "auto" ? `${activeTheme} mode` : `${themeMode} override`}
          </Badge>
          <span className="metric-mono hos-clock-readout hidden text-sm text-[var(--color-text-muted)] md:inline-flex">
            {timeLabel}
          </span>
          <Button variant="ghost" className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]" onClick={onThemeToggle}>
            {activeTheme === "night" || activeTheme === "dusk" ? <SunMedium size={18} /> : <MoonStar size={18} />}
          </Button>
          <Button
            variant={notificationPermission === "granted" ? "secondary" : "primary"}
            className="hos-alert-button rounded-full"
            onClick={onEnableNotifications}
          >
            <Bell size={18} />
            <span className="hos-alert-label">
              {notificationPermission === "granted" ? "Notifications on" : "Enable alerts"}
            </span>
          </Button>
          <Button variant="secondary" className="rounded-full md:hidden" onClick={onCreateAccount}>
            New
          </Button>
        </div>
      </div>
    </header>
  );
}
