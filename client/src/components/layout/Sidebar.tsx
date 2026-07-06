import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, BarChart3,
  Bot, Settings, Zap, ChevronLeft, ChevronRight, Mail, ShieldCheck, Clock3,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";

const nav = [
  { to: "/",         icon: LayoutDashboard, label: "Command Centre" },
  { to: "/leads",    icon: Users,           label: "Leads" },
  { to: "/leads",    icon: Mail,            label: "Outreach" },
  { to: "/leads",    icon: ShieldCheck,     label: "Proof Vault" },
  { to: "/schedule", icon: CalendarDays,    label: "Schedule" },
  { to: "/analytics",icon: BarChart3,       label: "Analytics" },
  { to: "/agents",   icon: Bot,             label: "Agents" },
  { to: "/analytics",icon: Clock3,          label: "Revenue" },
  { to: "/settings", icon: Settings,        label: "Settings" },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={`
        flex flex-col border-r border-[var(--color-border)]
        bg-[#080707] backdrop-blur-xl
        transition-all duration-300 ease-out
        ${sidebarCollapsed ? "w-16" : "w-64"}
        sticky top-0 h-screen z-30
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-6 border-b border-[var(--color-border)] ${sidebarCollapsed ? "justify-center" : ""}`}>
        <div className="w-12 h-12 rounded-none flex items-center justify-center text-[var(--color-bronze)] font-display text-4xl flex-shrink-0">
          EA
        </div>
        {!sidebarCollapsed && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-bronze)] leading-none">Hamid Enterprise</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mt-2">Elite Automations</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={to === "/"}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-md
              text-sm font-medium transition-all duration-200
              ${sidebarCollapsed ? "justify-center" : ""}
              ${isActive
                ? "bg-[var(--color-bronze)]/12 text-[var(--color-bronze)] ring-1 ring-inset ring-[var(--color-bronze)]/35"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              }
            `}
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-4 border-t border-[var(--color-border)]">
        <button
          onClick={toggleSidebar}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-md
            text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]
            transition-all duration-200 text-sm
            ${sidebarCollapsed ? "justify-center" : ""}
          `}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
        </button>
        {!sidebarCollapsed && (
          <div className="mt-3 px-3 py-2 rounded-md bg-[var(--color-bronze)]/10 ring-1 ring-inset ring-[var(--color-bronze)]/20 flex items-center gap-2">
            <Zap size={13} className="text-[var(--color-bronze)] flex-shrink-0" />
            <span className="text-xs text-[var(--color-bronze)]">Pipeline ready</span>
          </div>
        )}
      </div>
    </aside>
  );
}
