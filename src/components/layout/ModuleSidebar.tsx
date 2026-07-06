import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarRange,
  CandlestickChart,
  CheckSquare,
  GitBranch,
  Globe,
  HeartPulse,
  Heart,
  Moon,
  Package,
  Phone,
  PhoneCall,
  Radar,
  CreditCard,
  Film,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  Link2,
  Mail,
  MessageSquare,
  PieChart,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Users,
  Video,
  Wrench,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import type { ModuleId } from "./ModuleRail";
import { getActiveModule } from "./ModuleRail";

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
}

const moduleNav: Record<ModuleId, { title: string; items: NavItem[] }> = {
  ea: {
    title: "H/OS",
    items: [
      { to: "/",          label: "Command centre", short: "CMD",     icon: LayoutDashboard },
      { to: "/agency",    label: "Agency launch",  short: "Launch",  icon: BriefcaseBusiness },
      { to: "/agents",    label: "Agent fleet",    short: "Agents",  icon: Bot },
      { to: "/leads",     label: "Leads pipeline", short: "Leads",   icon: BriefcaseBusiness },
      { to: "/timeline",  label: "Timeline",       short: "History", icon: Activity },
      { to: "/planner",   label: "Daily planner",  short: "Planner", icon: CalendarRange },
      { to: "/analytics", label: "Analytics",      short: "Stats",   icon: BarChart3 },
      { to: "/markets",   label: "Markets",        short: "Live",    icon: CandlestickChart },
    ],
  },
  crm: {
    title: "CRM",
    items: [
      { to: "/crm",          label: "Overview",   short: "CRM",      icon: LayoutDashboard },
      { to: "/crm/contacts", label: "Contacts",   short: "People",   icon: Users },
      { to: "/crm/pipeline", label: "Pipeline",   short: "Deals",    icon: BriefcaseBusiness },
      { to: "/crm/activity", label: "Activity",   short: "Feed",     icon: Zap },
    ],
  },
  ai: {
    title: "AI",
    items: [
      { to: "/ai",           label: "AI command",   short: "AI",     icon: Sparkles },
      { to: "/ai/intel",     label: "Intel",        short: "Intel",  icon: Search },
      { to: "/ai/scraper",   label: "Research",     short: "Scrape", icon: Search },
      { to: "/ai/imagegen",  label: "Media studio", short: "Media",  icon: ImageIcon },
      { to: "/ai/agents",    label: "Agent runner", short: "Agents", icon: Bot },
    ],
  },
  ops: {
    title: "OPS",
    items: [
      { to: "/ops",              label: "Operations",  short: "OPS",      icon: LayoutDashboard },
      { to: "/ops/revenue-radar", label: "Revenue radar", short: "Money", icon: Radar },
      { to: "/ops/metrics",      label: "Metrics",     short: "Stats",    icon: PieChart },
      { to: "/ops/automation",   label: "Automation",  short: "Auto",     icon: Zap },
      { to: "/ops/workflows",    label: "Workflows",   short: "Flows",    icon: GitBranch },
      { to: "/ops/approvals",    label: "Approvals",   short: "Approve",  icon: CheckSquare },
      { to: "/ops/tools",        label: "Tool forge",  short: "Tools",    icon: Wrench },
      { to: "/ops/tunnel",       label: "Tunnel",      short: "Tunnel",   icon: Globe },
      { to: "/ops/health",       label: "System health", short: "Health", icon: HeartPulse },
    ],
  },
  calls: {
    title: "CALLS",
    items: [
      { to: "/calls",            label: "Overview",    short: "CALLS", icon: Phone },
      { to: "/calls/outbound",   label: "Dialer",      short: "Dial",  icon: PhoneCall },
      { to: "/calls/logs",       label: "Call logs",   short: "Logs",  icon: BarChart3 },
      { to: "/calls/messages",   label: "Messages",    short: "SMS",   icon: MessageSquare },
      { to: "/calls/agents",     label: "AI agent",    short: "Agent", icon: Bot },
    ],
  },
  vid: {
    title: "VID",
    items: [
      { to: "/vid",        label: "Video library", short: "VID",    icon: Film },
      { to: "/vid/assets", label: "Assets",        short: "Files",  icon: Video },
    ],
  },
  mail: {
    title: "MAIL",
    items: [
      { to: "/mail",            label: "Inbox",       short: "Inbox",  icon: Inbox },
      { to: "/mail/compose",    label: "Compose",     short: "Write",  icon: MessageSquare },
      { to: "/mail/templates",  label: "Templates",   short: "Tmpls",  icon: Mail },
      { to: "/mail/campaigns",  label: "Campaigns",   short: "Camps",  icon: Send },
    ],
  },
  pay: {
    title: "PAY",
    items: [
      { to: "/pay",                label: "Revenue",       short: "PAY",    icon: CreditCard },
      { to: "/pay/invoices",       label: "Invoices",      short: "Invs",   icon: BriefcaseBusiness },
      { to: "/pay/subscriptions",  label: "Subscriptions", short: "Subs",   icon: RefreshCw },
      { to: "/pay/products",       label: "Products",      short: "Prods",  icon: Package },
      { to: "/pay/links",          label: "Payment links", short: "Links",  icon: Link2 },
      { to: "/pay/customers",      label: "Customers",     short: "Custs",  icon: Users },
    ],
  },
  personal: {
    title: "PERSONAL",
    items: [
      { to: "/personal", label: "My space", short: "ME", icon: Moon },
    ],
  },
};

export function ModuleSidebar() {
  const location = useLocation();
  const activeModule = getActiveModule(location.pathname);
  const { title, items } = moduleNav[activeModule];

  return (
    <aside className="hos-sidebar">
      <div className="hos-sidebar-brand">
        <p className="section-kicker">Elite Automations</p>
        <h2>{title}</h2>
        <p>
          Operating system for acquisition, delivery, finance, calls, and agent control.
        </p>
      </div>
      <div className="hos-sidebar-status">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">System status</p>
            <p className="mt-1 text-sm font-medium text-[var(--color-text)]">Nominal</p>
          </div>
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-success)] shadow-[0_0_18px_rgba(16,185,129,0.55)]" />
        </div>
      </div>
      <p className="hos-sidebar-label">Workspace views</p>
      <nav className="hos-sidebar-nav">
        {items.map((item) => {
          const exact = item.to === "/";
          const isActive = exact
            ? location.pathname === "/"
            : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                "hos-sidebar-link",
                isActive && "is-active",
              )}
            >
              <span
                className={clsx(
                  "hos-sidebar-icon",
                  isActive && "is-active",
                )}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <p className="section-kicker !text-[9px] !tracking-[0.18em]">{item.short}</p>
                <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{item.label}</p>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="hos-sidebar-note">
        <p className="section-kicker">Operating note</p>
        <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-muted)]">
          Keep decisions close to the data. No decorative views. Everything should route to live work.
        </p>
      </div>
    </aside>
  );
}
