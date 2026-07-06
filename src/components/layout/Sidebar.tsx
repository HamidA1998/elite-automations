import { Bot, Command, LayoutDashboard, Settings, Sparkles, CalendarRange, BriefcaseBusiness, BarChart3 } from "lucide-react";
import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import type { TimeMode } from "@/types/frontend";

const navItems = [
  { to: "/", label: "Command centre", icon: LayoutDashboard, short: "EA" },
  { to: "/agents", label: "Agents", icon: Bot, short: "Agents" },
  { to: "/leads", label: "Leads pipeline", icon: BriefcaseBusiness, short: "Leads" },
  { to: "/planner", label: "Daily planner", icon: CalendarRange, short: "Plan" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, short: "Stats" },
  { to: "/settings", label: "System settings", icon: Settings, short: "Config" },
];

export interface SidebarProps {
  timeMode: TimeMode;
}

export function Sidebar({ timeMode }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="hidden h-screen w-[var(--shell-sidebar)] shrink-0 border-r border-[var(--color-border)] px-5 py-6 lg:flex lg:flex-col lg:justify-between">
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="glass-panel rounded-[28px] px-5 py-6">
            <p className="section-kicker">Hamid Enterprise</p>
            <h1 className="display-title mt-3 !text-[2.1rem] !leading-[0.95]">
              H/OS
            </h1>
            <p className="mt-3 max-w-[20ch] text-sm text-[var(--color-text-muted)]">
              Your personal enterprise operating system for Greater Manchester growth.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">{timeMode}</Badge>
            <Badge variant="neutral">Phase 1 foundation</Badge>
          </div>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  "group flex items-center gap-3 rounded-[var(--radius-xl)] px-4 py-3 transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:bg-[var(--color-surface-2)]",
                  active && "bg-[var(--color-surface-2)] shadow-[var(--shadow-sm)]",
                )}
              >
                <span
                  className={clsx(
                    "inline-flex size-11 items-center justify-center rounded-full border border-[var(--color-border)] transition-all duration-[var(--duration-base)]",
                    active
                      ? "border-[transparent] bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]",
                  )}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="section-kicker !tracking-[0.02em]">{item.short}</p>
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{item.label}</p>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="glass-panel rounded-[var(--radius-2xl)] p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
            <Command size={18} className="text-[var(--color-accent)]" />
          </span>
          <div>
            <p className="section-kicker">Operating note</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              H/OS — Hamid Enterprise v3.0. Pipeline, agents, and analytics unified.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
