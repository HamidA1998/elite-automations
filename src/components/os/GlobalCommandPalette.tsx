import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckSquare,
  Command,
  CreditCard,
  FileText,
  Mail,
  Phone,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { filterCommandItems, type OsCommandItem, type OsObjectType } from "@/os/os-spine";

interface GlobalCommandPaletteProps {
  open: boolean;
  items: OsCommandItem[];
  onClose: () => void;
  onCreateAccount: () => void;
  onSelectItem?: (item: OsCommandItem) => void;
}

const typeIcon: Record<OsObjectType, typeof Search> = {
  client: Users,
  lead: Users,
  agent: Bot,
  approval: CheckSquare,
  call: Phone,
  mail: Mail,
  payment: CreditCard,
  task: CheckSquare,
  project: FileText,
  command: Sparkles,
  route: Zap,
};

export function GlobalCommandPalette({
  open,
  items,
  onClose,
  onCreateAccount,
  onSelectItem,
}: GlobalCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => filterCommandItems(items, query).slice(0, 12), [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const selectItem = (item: OsCommandItem) => {
    onSelectItem?.(item);
    if (item.actionId === "new-account") {
      onCreateAccount();
      onClose();
      return;
    }
    if (item.href) navigate(item.href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/48 px-4 pt-[10vh] backdrop-blur-xl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elite OS command palette"
        className="os-command-panel w-full max-w-3xl overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-accent)]">
            <Command size={18} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clients, agents, approvals, calls, mail, pay..."
            className="min-w-0 flex-1 bg-transparent text-[var(--text-lg)] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
          />
          <Badge variant="neutral">Cmd K</Badge>
        </div>
        <div className="max-h-[58vh] overflow-y-auto p-3">
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((item) => {
                const Icon = typeIcon[item.type];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className="group flex w-full items-center gap-4 rounded-[22px] border border-transparent px-4 py-3 text-left transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-all group-hover:text-[var(--color-accent)]">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-semibold text-[var(--color-text)]"
                        title={item.title}
                      >
                        {item.title}
                      </span>
                      <span
                        className="block truncate text-xs text-[var(--color-text-muted)]"
                        title={item.subtitle}
                      >
                        {item.subtitle}
                      </span>
                    </span>
                    <Badge
                      variant={
                        item.priority === "critical" ? "error" : item.priority === "high" ? "warning" : "neutral"
                      }
                    >
                      {item.type}
                    </Badge>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--color-border)] text-center">
              <Search size={22} className="text-[var(--color-text-muted)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">No matching OS object</p>
              <p className="mt-1 max-w-sm text-xs text-[var(--color-text-muted)]">
                Try a client name, agent role, approval, call, invoice, or system route.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">Enter opens. Escape closes. This is the cockpit search layer.</p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
