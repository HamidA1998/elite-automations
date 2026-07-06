import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Clock3, ExternalLink, Mail, Phone, Search, ShieldCheck, User } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchClient360 } from "@/services/api";
import type { Client360Account } from "@/types/frontend";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface ContactRow {
  id: string;
  clientId: string;
  businessName: string;
  businessType: string;
  area: string;
  fullName: string;
  role: string;
  email: string | null;
  phone: string | null;
  status: string;
  isPrimary: boolean;
  source: "contact" | "account";
  bestTime: string;
  contactPreference: string;
  notes: string;
  accountStatus: string;
  relationshipScore: number;
  dossierCompleteness: number;
  latestActivityAt: string | null;
  nextBestAction: string;
}

function healthVariant(score: number): "success" | "warning" | "error" | "info" {
  if (score >= 75) return "success";
  if (score >= 55) return "info";
  if (score >= 35) return "warning";
  return "error";
}

function contactRowsFromAccount(account: Client360Account): ContactRow[] {
  if (account.contacts.length) {
    return account.contacts.map((contact) => ({
      id: contact.id,
      clientId: account.clientId,
      businessName: account.businessName,
      businessType: account.businessType,
      area: account.area,
      fullName: contact.fullName,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      status: contact.status,
      isPrimary: contact.isPrimary,
      source: "contact",
      bestTime: contact.bestTime,
      contactPreference: contact.contactPreference,
      notes: contact.notes,
      accountStatus: account.accountStatus,
      relationshipScore: account.relationshipScore,
      dossierCompleteness: account.dossierCompleteness,
      latestActivityAt: account.latestActivityAt,
      nextBestAction: account.nextBestAction,
    }));
  }
  return [{
    id: `${account.clientId}-fallback`,
    clientId: account.clientId,
    businessName: account.businessName,
    businessType: account.businessType,
    area: account.area,
    fullName: account.businessName,
    role: account.emailAddress || account.phoneNumber ? "Account-level contact route" : "Stakeholder research required",
    email: account.emailAddress,
    phone: account.phoneNumber,
    status: account.emailAddress || account.phoneNumber ? "account route only" : "needs-research",
    isPrimary: false,
    source: "account",
    bestTime: "Unknown",
    contactPreference: account.emailAddress && account.phoneNumber ? "Both" : account.emailAddress ? "Email first" : account.phoneNumber ? "Call first" : "Research",
    notes: "No named stakeholder has been captured yet. This is the verified business-level route only.",
    accountStatus: account.accountStatus,
    relationshipScore: account.relationshipScore,
    dossierCompleteness: account.dossierCompleteness,
    latestActivityAt: account.latestActivityAt,
    nextBestAction: account.nextBestAction,
  }];
}

function formatLastTouch(value: string | null) {
  if (!value) return "No touch logged";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "Touched today";
  if (days === 1) return "Touched yesterday";
  return `${days}d since touch`;
}

export function ContactsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["client-360"],
    queryFn: fetchClient360,
    staleTime: 60_000,
  });

  const contacts = useMemo(
    () => (data?.accounts ?? []).flatMap(contactRowsFromAccount),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) =>
      [
        contact.fullName,
        contact.role,
        contact.email ?? "",
        contact.phone ?? "",
        contact.businessName,
        contact.businessType,
        contact.area,
        contact.status,
        contact.nextBestAction,
      ].some((field) => field.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  const namedContacts = contacts.filter((contact) => contact.source === "contact").length;
  const decisionMakers = contacts.filter((contact) => contact.status === "decision-maker" || contact.isPrimary).length;
  const missingRoutes = contacts.filter((contact) => !contact.email && !contact.phone).length;

  return (
    <PageWrapper
      eyebrow="HAMID.OS · CRM"
      title="Contact Intelligence"
      description="Search every stakeholder route, account fallback, contact preference, and relationship signal in one place."
      actions={<Link to="/crm" className="text-xs text-[var(--color-accent)] hover:underline">Back to CRM</Link>}
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {label: "Named contacts", value: namedContacts, icon: User, tone: "var(--color-accent)"},
            {label: "Decision routes", value: decisionMakers, icon: ShieldCheck, tone: "var(--color-success)"},
            {label: "Missing routes", value: missingRoutes, icon: Search, tone: "var(--color-warning)"},
          ].map(({label, value, icon: Icon, tone}) => (
            <Card key={label} className="metric-panel p-5">
              <div className="flex items-center justify-between">
                <p className="section-kicker">{label}</p>
                <Icon size={16} style={{color: tone}} />
              </div>
              <p className="metric-mono mt-3 text-3xl font-semibold" style={{color: tone}}>{isLoading ? "-" : value}</p>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-[var(--color-border)] px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-kicker">Relationship ledger</p>
              <h2 className="display-title !text-[var(--text-lg)]">Contacts and stakeholder routes</h2>
            </div>
            <div className="relative w-full md:max-w-md">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search name, company, email, phone, area..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({length: 6}).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-[var(--radius-xl)] bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map((contact) => (
                <Link
                  key={contact.id}
                  to={`/leads/${contact.clientId}`}
                  className="grid gap-4 px-6 py-5 transition-colors hover:bg-[var(--color-surface-2)] lg:grid-cols-[minmax(0,1.1fr)_0.9fr_0.8fr_0.55fr]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-accent)]">
                        {contact.source === "contact" ? <User size={15} /> : <Building2 size={15} />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{contact.fullName}</p>
                        <p className="truncate text-xs text-[var(--color-text-muted)]">{contact.role}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={contact.isPrimary ? "success" : contact.source === "account" ? "warning" : "neutral"}>
                        {contact.isPrimary ? "primary" : contact.source === "account" ? "account route" : contact.status}
                      </Badge>
                      <Badge variant={healthVariant(contact.relationshipScore)}>{contact.relationshipScore}</Badge>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-2 text-xs text-[var(--color-text-muted)]">
                    <p className="flex items-center gap-2 text-[var(--color-text)]">
                      <Building2 size={12} />
                      <span className="truncate">{contact.businessName}</span>
                    </p>
                    <p className="truncate">{contact.businessType} · {contact.area}</p>
                    <p className="line-clamp-1">{contact.nextBestAction}</p>
                  </div>

                  <div className="space-y-2 text-xs text-[var(--color-text-muted)]">
                    <p className="flex items-center gap-2">
                      <Mail size={12} />
                      <span className="truncate">{contact.email ?? "No email captured"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone size={12} />
                      <span>{contact.phone ?? "No phone captured"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock3 size={12} />
                      <span>{contact.bestTime} · {contact.contactPreference}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <ExternalLink size={14} className="ml-auto text-[var(--color-text-muted)]" />
                    <p className="metric-mono mt-2 text-sm text-[var(--color-accent)]">{contact.dossierCompleteness}%</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatLastTouch(contact.latestActivityAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-sm text-[var(--color-text-muted)]">
              No contacts match your search.
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
