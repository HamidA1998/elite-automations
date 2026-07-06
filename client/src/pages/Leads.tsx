import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/stores/appStore";
import { Badge, statusBadge, healthBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { SkeletonRow } from "@/components/ui/Skeleton";
import type { ClientRecord, AccountStatus } from "@/types";
import {
  Search, Filter, SortAsc, SortDesc, ExternalLink,
  ChevronRight, Users, TrendingUp, Star, Globe,
  Phone, Mail, MoreVertical,
} from "lucide-react";

const STATUS_COLUMNS: AccountStatus[] = [
  "prospect", "contacted", "replied", "proposal_sent", "negotiating", "won", "lost",
];

const STATUS_LABELS: Record<AccountStatus, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  replied: "Replied",
  proposal_sent: "Proposal Sent",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

function LeadCard({ account }: { account: ClientRecord }) {
  const score = account.audit?.totalScore ?? 0;

  return (
    <Link
      to={`/leads/${account.id}`}
      className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3.5 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-2">
          <div className="text-sm font-semibold text-[var(--color-text)] truncate group-hover:text-[var(--color-accent)] transition-colors">
            {account.businessName}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] truncate">{account.businessType}</div>
        </div>
        <Badge {...healthBadge(account.healthBand)} />
      </div>

      <div className="flex items-center gap-1 mb-2.5 text-xs text-[var(--color-text-muted)]">
        <Globe size={10} className="flex-shrink-0" />
        <span className="truncate">{account.area}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Star size={11} className="text-[var(--color-gold)]" />
          <span className="text-xs font-mono text-[var(--color-text-muted)]">{score}</span>
        </div>
        {account.metrics?.estimatedValue != null && (
          <span className="text-xs font-mono font-semibold text-emerald-400">
            £{Math.round(account.metrics.estimatedValue).toLocaleString()}
          </span>
        )}
      </div>

      {score > 0 && (
        <div className="mt-2">
          <Progress value={score} max={100} size="sm" variant={score >= 70 ? "success" : score >= 50 ? "accent" : "warning"} />
        </div>
      )}
    </Link>
  );
}

function KanbanView({ accounts }: { accounts: ClientRecord[] }) {
  const grouped = useMemo(() => {
    const map: Record<AccountStatus, ClientRecord[]> = {} as any;
    STATUS_COLUMNS.forEach((s) => (map[s] = []));
    accounts.forEach((a) => {
      if (map[a.status]) map[a.status].push(a);
      else map["prospect"].push(a);
    });
    return map;
  }, [accounts]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_COLUMNS.map((status) => {
        const items = grouped[status];
        return (
          <div key={status} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--color-text)]">{STATUS_LABELS[status]}</span>
                <span className="text-xs font-mono bg-[var(--color-surface-2)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {items.map((a) => <LeadCard key={a.id} account={a} />)}
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableView({ accounts }: { accounts: ClientRecord[] }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Business</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden md:table-cell">Type / Area</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden lg:table-cell">Health</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden lg:table-cell">Score</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden xl:table-cell">Value</th>
            <th className="px-4 py-3 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {accounts.map((a) => (
            <tr key={a.id} className="hover:bg-[var(--color-surface-2)] transition-colors group">
              <td className="px-4 py-3">
                <div className="font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                  {a.businessName}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2 mt-0.5">
                  {a.email && <Mail size={10} />}
                  {a.phone && <Phone size={10} />}
                  {a.website && <Globe size={10} />}
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="text-xs text-[var(--color-text)]">{a.businessType}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{a.area}</div>
              </td>
              <td className="px-4 py-3">
                <Badge {...statusBadge(a.status)} />
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <Badge {...healthBadge(a.healthBand)} />
              </td>
              <td className="px-4 py-3 text-right hidden lg:table-cell">
                <span className="font-mono text-xs text-[var(--color-text-muted)]">
                  {a.audit?.totalScore ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-right hidden xl:table-cell">
                <span className="font-mono text-xs text-emerald-400 font-semibold">
                  {a.metrics?.estimatedValue != null
                    ? `£${Math.round(a.metrics.estimatedValue).toLocaleString()}`
                    : "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link to={`/leads/${a.id}`}>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={14} />
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {accounts.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
          No leads match your filters.
        </div>
      )}
    </div>
  );
}

type SortKey = "score" | "value" | "name" | "status";

export function Leads() {
  const { state, isLoading } = useAppStore();
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);

  const accounts = state?.accounts ?? [];

  const filtered = useMemo(() => {
    let list = accounts.filter((a) => {
      const q = search.toLowerCase();
      if (q && !a.businessName.toLowerCase().includes(q) && !a.area?.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "score") { av = a.audit?.totalScore ?? 0; bv = b.audit?.totalScore ?? 0; }
      else if (sortKey === "value") { av = a.metrics?.estimatedValue ?? 0; bv = b.metrics?.estimatedValue ?? 0; }
      else if (sortKey === "name") return sortAsc ? a.businessName.localeCompare(b.businessName) : b.businessName.localeCompare(a.businessName);
      return sortAsc ? av - bv : bv - av;
    });

    return list;
  }, [accounts, search, statusFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Leads Pipeline</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {filtered.length} of {accounts.length} accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("table")}
          >
            Table
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            Kanban
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "all")}
          className="h-9 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        >
          <option value="all">All Statuses</option>
          {STATUS_COLUMNS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {view === "table" && (
          <div className="flex items-center gap-1">
            {(["score", "value", "name"] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => toggleSort(k)}
                className={`flex items-center gap-1 h-9 px-3 rounded-lg border text-xs font-medium transition-colors
                  ${sortKey === k
                    ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  }`}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
                {sortKey === k && (sortAsc ? <SortAsc size={11} /> : <SortDesc size={11} />)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : view === "kanban" ? (
        <KanbanView accounts={filtered} />
      ) : (
        <TableView accounts={filtered} />
      )}
    </div>
  );
}
