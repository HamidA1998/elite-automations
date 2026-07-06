import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bot, ImageIcon, Search, Send, Sparkles, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { fetchLeadPipeline, sendAiCommand } from "@/services/api";

const tools = [
  {
    to: "/ai/scraper",
    icon: Search,
    label: "Web scraper",
    desc: "Scrape websites and search businesses using Firecrawl, then turn findings into usable CRM intelligence.",
    badge: "Firecrawl",
    color: "#f59e0b",
  },
  {
    to: "/ai/imagegen",
    icon: ImageIcon,
    label: "Media studio",
    desc: "Generate hero images and video assets from KIE.ai models with lead context attached.",
    badge: "KIE.ai",
    color: "var(--color-accent)",
  },
  {
    to: "/ai/agents",
    icon: Bot,
    label: "Agent runner",
    desc: "Trigger and monitor OpenClaw agents for research, qualification, outreach, and follow-up.",
    badge: "OpenClaw",
    color: "#22c55e",
  },
];

export function AICommandPage() {
  const [message, setMessage] = useState("What should I focus on next to get the first paying client?");
  const [selectedLead, setSelectedLead] = useState("");
  const [mode, setMode] = useState<"operator" | "sales" | "technical" | "strategy">("operator");
  const leadsQuery = useQuery({
    queryKey: ["lead-pipeline"],
    queryFn: fetchLeadPipeline,
    staleTime: 60_000,
  });
  const commandMutation = useMutation({
    mutationFn: () => sendAiCommand({
      message,
      mode,
      clientId: selectedLead || undefined,
    }),
  });

  return (
    <PageWrapper
      eyebrow="HAMID.OS · AI"
      title="AI Command"
      description="Ask the operating assistant about live CRM data, leads, metrics, audits, and next actions."
      actions={<Badge variant={commandMutation.data ? "success" : "info"}>{commandMutation.data?.model ?? "OpenAI ready"}</Badge>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <Card className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Operator assistant</p>
              <h2 className="display-title !text-[var(--text-lg)]">Ask with full business context</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
                The assistant receives current metrics, client files, risk flags, next best actions, and the selected lead dossier when you attach one.
              </p>
            </div>
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-accent)]">
              <TerminalSquare size={18} />
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.7fr_1fr]">
            <label className="space-y-2">
              <span className="section-kicker">Mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
                className="min-h-12 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="operator">Operator</option>
                <option value="sales">Sales</option>
                <option value="technical">Technical</option>
                <option value="strategy">Strategy</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="section-kicker">Attach lead context</span>
              <select
                value={selectedLead}
                onChange={(event) => setSelectedLead(event.target.value)}
                className="min-h-12 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">Whole business OS</option>
                {(leadsQuery.data?.leads ?? []).map((lead) => (
                  <option key={lead.clientId} value={lead.clientId}>{lead.businessName}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="section-kicker">Command</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm leading-6 text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]"
              placeholder="Ask what to do next, how to position an offer, which lead needs action, or what the data means."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => commandMutation.mutate()} disabled={!message.trim() || commandMutation.isPending}>
              <Send size={16} />
              {commandMutation.isPending ? "Thinking..." : "Run command"}
            </Button>
            {selectedLead ? (
              <Link to={`/leads/${selectedLead}`} className="text-xs text-[var(--color-accent)] hover:underline">
                Open attached client file
              </Link>
            ) : null}
          </div>

          {commandMutation.error ? (
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-4 text-sm text-[var(--color-error)]">
              {commandMutation.error instanceof Error ? commandMutation.error.message : "AI command failed."}
            </div>
          ) : null}

          {commandMutation.data ? (
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="success">live reply</Badge>
                <Badge variant="neutral">{commandMutation.data.context.accountsIncluded} accounts in context</Badge>
                {commandMutation.data.context.selectedLead ? <Badge variant="info">{commandMutation.data.context.selectedLead}</Badge> : null}
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-muted)]">{commandMutation.data.reply}</pre>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          {tools.map(({ to, icon: Icon, label, desc, badge, color }) => (
            <Link
              key={to}
              to={to}
              className="group block rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)]/35 hover:bg-[var(--color-surface-2)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-xl" style={{ background: `${color}20`, color }}>
                  <Icon size={20} />
                </span>
                <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ background: `${color}20`, color }}>
                  {badge}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[var(--color-text)]">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{desc}</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
                <Sparkles size={12} />
                <span>Open tool</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
