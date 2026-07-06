import {
  BarChart3,
  CreditCard,
  Film,
  Mail,
  Phone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import { getActiveModule } from "./ModuleRail";

const modules = [
  { id: "ea",    icon: Zap,        root: "/",      label: "EA" },
  { id: "crm",   icon: Users,      root: "/crm",   label: "CRM" },
  { id: "ai",    icon: Sparkles,   root: "/ai",    label: "AI" },
  { id: "calls", icon: Phone,      root: "/calls", label: "CALLS" },
  { id: "mail",  icon: Mail,       root: "/mail",  label: "MAIL" },
  { id: "pay",   icon: CreditCard, root: "/pay",   label: "PAY" },
  { id: "ops",   icon: BarChart3,  root: "/ops",   label: "OPS" },
] as const;

export function MobileNav() {
  const location = useLocation();
  const active = getActiveModule(location.pathname);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg)_88%,transparent)] backdrop-blur-2xl">
      <div className="flex items-center justify-around px-2 py-2 pb-safe overflow-x-auto">
        {modules.map(({ id, icon: Icon, root, label }) => {
          const isActive = active === id;
          return (
            <Link
              key={id}
              to={root}
              className={clsx(
                "flex flex-col items-center justify-center gap-0.5 min-w-[46px] px-1 py-1.5 rounded-xl transition-all duration-150",
                isActive
                  ? "bg-[color-mix(in_oklab,var(--color-accent)_15%,transparent)] text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)]",
              )}
            >
              <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={clsx(
                "text-[8px] font-bold tracking-widest",
                isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]",
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
