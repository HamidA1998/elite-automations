import {
  BarChart3,
  CreditCard,
  Crown,
  Film,
  Mail,
  Moon,
  Phone,
  Settings,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";

export type ModuleId = "ea" | "crm" | "ai" | "ops" | "vid" | "mail" | "pay" | "calls" | "personal";

const modules: { id: ModuleId; label: string; icon: typeof BarChart3; root: string }[] = [
  { id: "ea",       label: "EA",      icon: Zap,        root: "/" },
  { id: "crm",      label: "CRM",     icon: Users,      root: "/crm" },
  { id: "ai",       label: "AI",      icon: Sparkles,   root: "/ai" },
  { id: "ops",      label: "OPS",     icon: BarChart3,  root: "/ops" },
  { id: "vid",      label: "VID",     icon: Film,       root: "/vid" },
  { id: "mail",     label: "MAIL",    icon: Mail,       root: "/mail" },
  { id: "pay",      label: "PAY",     icon: CreditCard, root: "/pay" },
  { id: "calls",    label: "CALLS",   icon: Phone,      root: "/calls" },
  { id: "personal", label: "ME",      icon: Moon,       root: "/personal" },
];

export function getActiveModule(pathname: string): ModuleId {
  if (pathname.startsWith("/crm"))      return "crm";
  if (pathname.startsWith("/ai"))       return "ai";
  if (pathname.startsWith("/ops"))      return "ops";
  if (pathname.startsWith("/vid"))      return "vid";
  if (pathname.startsWith("/mail"))     return "mail";
  if (pathname.startsWith("/pay"))      return "pay";
  if (pathname.startsWith("/calls"))    return "calls";
  if (pathname.startsWith("/personal")) return "personal";
  return "ea";
}

export function ModuleRail() {
  const location = useLocation();
  const active = getActiveModule(location.pathname);

  return (
    <div className="hos-rail">
      <div className="hos-rail-logo" title="Elite Automations">
        <Crown size={17} />
        <span>EA</span>
      </div>
      {modules.map(({ id, label, icon: Icon, root }) => {
        const isActive = active === id;
        return (
          <Link
            key={id}
            to={root}
            title={label}
            className={clsx(
              "hos-rail-link",
              isActive && "is-active",
            )}
          >
            <Icon size={16} />
            <span className="mt-1">{label}</span>
          </Link>
        );
      })}
      <div className="flex-1" />
      <Link
        to="/settings"
        title="Settings"
        className={clsx(
          "hos-rail-link",
          location.pathname === "/settings" && "is-active",
        )}
      >
        <Settings size={16} />
        <span className="mt-1">CFG</span>
      </Link>
    </div>
  );
}
